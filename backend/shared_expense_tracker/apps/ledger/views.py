from django.db.models import Sum, Value
from django.db.models.functions import Coalesce, TruncMonth
from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from .models import Category, Expense, ExpenseParticipant, Friend, Payment, Receivable
from .serializers import CategorySerializer, ExpenseSerializer, FriendSerializer, PaymentSerializer, ReceivableSerializer


class FriendViewSet(viewsets.ModelViewSet):
    serializer_class = FriendSerializer
    queryset = Friend.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    queryset = Category.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    queryset = Expense.objects.select_related("category", "paid_by").prefetch_related("items__participants", "receivables")

    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)

    def perform_destroy(self, instance):
        if instance.receivables.filter(amount_paid__gt=0).exists() or instance.receivables.filter(allocations__isnull=False).exists():
            raise ValidationError("This expense has applied payments and cannot be deleted until payments are reversed.")
        instance.delete()


class ReceivableViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReceivableSerializer
    queryset = Receivable.objects.select_related("expense", "friend")

    def get_queryset(self):
        queryset = super().get_queryset().filter(expense__owner=self.request.user)
        friend_id = self.request.query_params.get("friend")
        status = self.request.query_params.get("status")
        if friend_id:
            queryset = queryset.filter(friend_id=friend_id)
        if status:
            queryset = queryset.filter(status=status)
        return queryset


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related("friend").prefetch_related("allocations__receivable")

    def get_queryset(self):
        return super().get_queryset().filter(friend__owner=self.request.user)


class DashboardView(APIView):
    def get(self, request):
        receivables = Receivable.objects.filter(expense__owner=request.user)
        owed_to_me = receivables.filter(direction=Receivable.Direction.OWED_TO_ME)
        owed_by_me = receivables.filter(direction=Receivable.Direction.OWED_BY_ME)

        total_owed = owed_to_me.aggregate(total=Sum("amount_owed"))["total"] or 0
        total_paid = owed_to_me.aggregate(total=Sum("amount_paid"))["total"] or 0
        total_owed_by_me = owed_by_me.aggregate(total=Sum("amount_owed"))["total"] or 0
        total_paid_by_me = owed_by_me.aggregate(total=Sum("amount_paid"))["total"] or 0

        my_share = (
            ExpenseParticipant.objects.filter(
                expense_item__expense__owner=request.user, is_owner_share=True
            ).aggregate(total=Sum("computed_amount"))["total"]
            or 0
        )

        friend_map = {}
        for row in owed_to_me.values("friend_id", "friend__name").annotate(owed=Sum("amount_owed"), paid=Sum("amount_paid")):
            entry = friend_map.setdefault(row["friend_id"], {"friend__name": row["friend__name"], "owed_to_me": 0, "paid_to_me": 0, "owed_by_me": 0, "paid_by_me": 0})
            entry["owed_to_me"] = row["owed"] or 0
            entry["paid_to_me"] = row["paid"] or 0
        for row in owed_by_me.values("friend_id", "friend__name").annotate(owed=Sum("amount_owed"), paid=Sum("amount_paid")):
            entry = friend_map.setdefault(row["friend_id"], {"friend__name": row["friend__name"], "owed_to_me": 0, "paid_to_me": 0, "owed_by_me": 0, "paid_by_me": 0})
            entry["owed_by_me"] = row["owed"] or 0
            entry["paid_by_me"] = row["paid"] or 0

        by_friend = [
            {
                "friend_id": friend_id,
                "friend__name": data["friend__name"],
                "total_owed": data["owed_to_me"],
                "total_paid": data["paid_to_me"],
                "owed_by_me": data["owed_by_me"],
                "paid_by_me": data["paid_by_me"],
                "balance": (data["owed_to_me"] - data["paid_to_me"]) - (data["owed_by_me"] - data["paid_by_me"]),
            }
            for friend_id, data in friend_map.items()
        ]
        by_friend.sort(key=lambda row: row["balance"], reverse=True)

        monthly_expense = (
            Expense.objects.filter(owner=request.user)
            .annotate(month=TruncMonth("date"))
            .values("month")
            .annotate(total=Sum("total_amount"))
            .order_by("month")
        )
        spending_by_category = (
            Expense.objects.filter(owner=request.user)
            .annotate(category_label=Coalesce("category__name", Value("Uncategorized")))
            .values("category_label")
            .annotate(total=Sum("total_amount"))
            .order_by("-total")
        )

        recent_expenses = Expense.objects.filter(owner=request.user).order_by("-date", "-created_at")[:8]
        recent_payments = (
            Payment.objects.filter(friend__owner=request.user).select_related("friend").order_by("-date", "-created_at")[:8]
        )
        recent_activity = sorted(
            [
                {
                    "type": "expense",
                    "id": expense.id,
                    "date": expense.date,
                    "description": expense.description,
                    "amount": expense.total_amount,
                }
                for expense in recent_expenses
            ]
            + [
                {
                    "type": "payment_received" if payment.direction == Payment.Direction.RECEIVED else "payment_sent",
                    "id": payment.id,
                    "date": payment.date,
                    "description": (
                        f"Payment from {payment.friend.name}"
                        if payment.direction == Payment.Direction.RECEIVED
                        else f"Payment to {payment.friend.name}"
                    ),
                    "amount": payment.amount,
                }
                for payment in recent_payments
            ],
            key=lambda entry: (entry["date"], entry["id"]),
            reverse=True,
        )[:8]

        return Response(
            {
                "total_owed": total_owed,
                "total_paid": total_paid,
                "outstanding": total_owed - total_paid,
                "total_owed_by_me": total_owed_by_me,
                "total_paid_by_me": total_paid_by_me,
                "outstanding_by_me": total_owed_by_me - total_paid_by_me,
                "my_share": my_share,
                "by_friend": by_friend,
                "monthly_expense": list(monthly_expense),
                "spending_by_category": list(spending_by_category),
                "recent_activity": recent_activity,
            }
        )


class MonthlyReportView(APIView):
    def get(self, request):
        now = timezone.now()
        try:
            year = int(request.query_params.get("year", now.year))
            month = int(request.query_params.get("month", now.month))
        except ValueError:
            raise ValidationError("year and month must be integers.")
        if not 1 <= month <= 12:
            raise ValidationError("month must be between 1 and 12.")

        expense_years = Expense.objects.filter(owner=request.user).dates("date", "year")
        available_years = sorted({date.year for date in expense_years}, reverse=True)
        if year not in available_years:
            available_years = sorted(set(available_years) | {year}, reverse=True)

        receivables = Receivable.objects.filter(
            expense__owner=request.user,
            expense__date__year=year,
            expense__date__month=month,
            direction=Receivable.Direction.OWED_TO_ME,
        )
        payables = Receivable.objects.filter(
            expense__owner=request.user,
            expense__date__year=year,
            expense__date__month=month,
            direction=Receivable.Direction.OWED_BY_ME,
        )
        total_owed = receivables.aggregate(total=Sum("amount_owed"))["total"] or 0
        total_owed_by_me = payables.aggregate(total=Sum("amount_owed"))["total"] or 0
        collected_amount = (
            Payment.objects.filter(
                friend__owner=request.user, date__year=year, date__month=month, direction=Payment.Direction.RECEIVED
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        paid_out_amount = (
            Payment.objects.filter(
                friend__owner=request.user, date__year=year, date__month=month, direction=Payment.Direction.SENT
            ).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        friends_borrowed = list(
            receivables.values("friend_id", "friend__name")
            .annotate(amount_owed=Sum("amount_owed"), amount_paid=Sum("amount_paid"))
            .order_by("friend__name")
        )

        expenses_qs = (
            Expense.objects.filter(owner=request.user, date__year=year, date__month=month)
            .select_related("category")
            .prefetch_related("items__participants__friend")
            .order_by("date")
        )
        expenses_data = [
            {
                "id": expense.id,
                "date": expense.date,
                "description": expense.description,
                "category_name": expense.category.name if expense.category_id else None,
                "total_amount": expense.total_amount,
                "items": [
                    {
                        "name": item.name,
                        "price": item.price,
                        "participants": [
                            {
                                "friend_name": participant.friend.name if participant.friend_id else "You",
                                "share": participant.computed_amount,
                            }
                            for participant in item.participants.all()
                        ],
                    }
                    for item in expense.items.all()
                ],
            }
            for expense in expenses_qs
        ]

        return Response(
            {
                "year": year,
                "month": month,
                "available_years": available_years,
                "total_owed": total_owed,
                "total_owed_by_me": total_owed_by_me,
                "collected_amount": collected_amount,
                "paid_out_amount": paid_out_amount,
                "friends_borrowed": friends_borrowed,
                "expenses": expenses_data,
            }
        )

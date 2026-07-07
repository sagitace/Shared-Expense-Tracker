from django.db.models import DecimalField, ExpressionWrapper, Sum
from django.db.models.functions import TruncMonth
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from .models import Category, Expense, Friend, Payment, Receivable
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
        total_owed = receivables.aggregate(total=Sum("amount_owed"))["total"] or 0
        total_paid = receivables.aggregate(total=Sum("amount_paid"))["total"] or 0
        by_friend = (
            receivables.values("friend_id", "friend__name")
            .annotate(
                total_owed=Sum("amount_owed"),
                total_paid=Sum("amount_paid"),
                balance=ExpressionWrapper(
                    Sum("amount_owed") - Sum("amount_paid"),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                ),
            )
            .order_by("-balance")
        )
        monthly_expense = (
            Expense.objects.filter(owner=request.user)
            .annotate(month=TruncMonth("date"))
            .values("month")
            .annotate(total=Sum("total_amount"))
            .order_by("month")
        )
        return Response(
            {
                "total_owed": total_owed,
                "total_paid": total_paid,
                "outstanding": total_owed - total_paid,
                "by_friend": list(by_friend),
                "monthly_expense": list(monthly_expense),
            }
        )

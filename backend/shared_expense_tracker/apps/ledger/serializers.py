from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from shared_expense_tracker.apps.accounts.models import User

from .models import Category, Expense, ExpenseItem, ExpenseParticipant, Friend, Payment, PaymentAllocation, Receivable
from .services.splits import calculate_equal_split, calculate_weighted_split, money


class FriendSerializer(serializers.ModelSerializer):
    class Meta:
        model = Friend
        fields = ("id", "name", "email", "phone", "is_active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")

    def create(self, validated_data):
        return Friend.objects.create(owner=self.context["request"].user, **validated_data)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "is_active", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")

    def create(self, validated_data):
        return Category.objects.create(owner=self.context["request"].user, **validated_data)


class ExpenseParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseParticipant
        fields = ("id", "friend", "share_value", "computed_amount", "is_owner_share")
        read_only_fields = ("computed_amount",)


class ExpenseItemSerializer(serializers.ModelSerializer):
    participants = ExpenseParticipantSerializer(many=True)

    class Meta:
        model = ExpenseItem
        fields = ("id", "name", "price", "split_type", "participants")


class ExpenseSerializer(serializers.ModelSerializer):
    items = ExpenseItemSerializer(many=True)

    class Meta:
        model = Expense
        fields = (
            "id",
            "owner",
            "paid_by",
            "date",
            "description",
            "category",
            "total_amount",
            "receipt",
            "is_locked",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("owner", "paid_by", "total_amount", "is_locked", "created_at", "updated_at")

    def validate(self, attrs):
        items = attrs.get("items", [])
        if not items:
            raise serializers.ValidationError({"items": "At least one expense item is required."})
        for item in items:
            participants = item.get("participants", [])
            if not any(participant.get("is_owner_share") for participant in participants):
                raise serializers.ValidationError({"items": "Each item must include the owner share."})
        return attrs

    def _ensure_not_locked(self, expense):
        if expense.receivables.filter(amount_paid__gt=0).exists() or expense.receivables.filter(allocations__isnull=False).exists():
            raise serializers.ValidationError("This expense has applied payments and cannot be changed until payments are reversed.")

    def _write_items(self, expense, items_data):
        total_amount = Decimal("0.00")
        receivable_totals = {}

        for item_data in items_data:
            participants_data = item_data.pop("participants")
            item = ExpenseItem.objects.create(expense=expense, **item_data)
            total_amount += item.price

            split_type = item.split_type
            if split_type == ExpenseItem.SplitType.EQUAL:
                computed_shares = calculate_equal_split(item.price, participants_data)
            elif split_type in (ExpenseItem.SplitType.CUSTOM, ExpenseItem.SplitType.PERCENTAGE, ExpenseItem.SplitType.QUANTITY):
                computed_shares = calculate_weighted_split(item.price, participants_data, split_type)
            else:
                raise serializers.ValidationError("Unsupported split type.")

            for participant_data, computed_amount in zip(participants_data, computed_shares):
                participant = ExpenseParticipant.objects.create(
                    expense_item=item,
                    friend=participant_data.get("friend"),
                    share_value=participant_data.get("share_value") or Decimal("0.00"),
                    computed_amount=computed_amount,
                    is_owner_share=bool(participant_data.get("is_owner_share")),
                )
                if participant.friend_id:
                    receivable_totals.setdefault(participant.friend_id, Decimal("0.00"))
                    receivable_totals[participant.friend_id] += participant.computed_amount

        return total_amount, receivable_totals

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop("items")
        validated_data.setdefault("paid_by", self.context["request"].user)
        expense = Expense.objects.create(owner=self.context["request"].user, **validated_data)
        total_amount, receivable_totals = self._write_items(expense, items_data)
        expense.total_amount = money(total_amount)
        expense.save(update_fields=["total_amount"])

        for friend_id, amount_owed in receivable_totals.items():
            Receivable.objects.create(expense=expense, friend_id=friend_id, amount_owed=money(amount_owed))
        return expense

    @transaction.atomic
    def update(self, instance, validated_data):
        self._ensure_not_locked(instance)
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is None:
            return instance

        instance.items.all().delete()
        instance.receivables.all().delete()
        total_amount, receivable_totals = self._write_items(instance, items_data)
        instance.total_amount = money(total_amount)
        instance.save(update_fields=["total_amount"])
        for friend_id, amount_owed in receivable_totals.items():
            Receivable.objects.create(expense=instance, friend_id=friend_id, amount_owed=money(amount_owed))
        return instance


class ReceivableSerializer(serializers.ModelSerializer):
    friend_name = serializers.CharField(source="friend.name", read_only=True)
    expense_description = serializers.CharField(source="expense.description", read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Receivable
        fields = ("id", "expense", "expense_description", "friend", "friend_name", "amount_owed", "amount_paid", "status", "balance", "created_at")


class PaymentAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAllocation
        fields = ("id", "receivable", "amount_allocated")


class PaymentSerializer(serializers.ModelSerializer):
    friend_name = serializers.CharField(source="friend.name", read_only=True)
    allocations = PaymentAllocationSerializer(many=True, required=False)

    class Meta:
        model = Payment
        fields = ("id", "friend", "friend_name", "amount", "date", "method", "notes", "allocations", "created_at")
        read_only_fields = ("created_at",)

    def validate(self, attrs):
        allocations = self.initial_data.get("allocations")
        if allocations:
            if money(sum(Decimal(str(item.get("amount_allocated", 0))) for item in allocations)) != money(attrs["amount"]):
                raise serializers.ValidationError({"allocations": "Allocated amounts must equal the payment amount."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        allocations_data = validated_data.pop("allocations", [])
        payment = Payment.objects.create(**validated_data)
        if allocations_data:
            self._create_manual_allocations(payment, allocations_data)
        else:
            self._create_oldest_first_allocations(payment)
        return payment

    def _create_manual_allocations(self, payment, allocations_data):
        for allocation_data in allocations_data:
            receivable_ref = allocation_data["receivable"]
            receivable = Receivable.objects.select_for_update().get(pk=receivable_ref.pk if hasattr(receivable_ref, "pk") else receivable_ref)
            amount_allocated = money(allocation_data["amount_allocated"])
            if receivable.friend_id != payment.friend_id:
                raise serializers.ValidationError("Allocations must belong to the same friend as the payment.")
            if amount_allocated > receivable.balance:
                raise serializers.ValidationError("Payment allocation cannot exceed the receivable balance.")
            PaymentAllocation.objects.create(payment=payment, receivable=receivable, amount_allocated=amount_allocated)
            receivable.amount_paid = money(receivable.amount_paid + amount_allocated)
            receivable.save(update_fields=["amount_paid", "status"])

    def _create_oldest_first_allocations(self, payment):
        remaining = money(payment.amount)
        receivables = Receivable.objects.select_for_update().filter(friend=payment.friend).exclude(status=Receivable.Status.PAID).order_by("created_at", "id")
        total_outstanding = sum((receivable.balance for receivable in receivables), Decimal("0.00"))
        if remaining > total_outstanding:
            raise serializers.ValidationError("Payment exceeds the outstanding balance for this friend.")

        for receivable in receivables:
            if remaining <= 0:
                break
            allocation = min(remaining, receivable.balance)
            if allocation <= 0:
                continue
            PaymentAllocation.objects.create(payment=payment, receivable=receivable, amount_allocated=allocation)
            receivable.amount_paid = money(receivable.amount_paid + allocation)
            receivable.save(update_fields=["amount_paid", "status"])
            remaining = money(remaining - allocation)

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


MONEY_PLACES = Decimal("0.01")


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Friend(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friends")
    name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["owner", "is_active"])]

    def __str__(self):
        return self.name


class Category(TimeStampedModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categories",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="unique_category_name_per_owner")]

    def __str__(self):
        return self.name


class Expense(TimeStampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expenses")
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="paid_expenses",
    )
    paid_by_friend = models.ForeignKey(
        "Friend",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="expenses_paid",
        help_text="If set, this friend paid for the expense instead of the owner.",
    )
    date = models.DateField(db_index=True)
    description = models.CharField(max_length=255)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    receipt = models.FileField(upload_to="receipts/", null=True, blank=True)
    is_locked = models.BooleanField(default=False)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["owner", "date"])]

    def __str__(self):
        return self.description


class ExpenseItem(TimeStampedModel):
    class SplitType(models.TextChoices):
        EQUAL = "equal", "Equal"
        CUSTOM = "custom", "Custom Amount"
        PERCENTAGE = "percentage", "Percentage"
        QUANTITY = "quantity", "Quantity"

    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="items")
    name = models.CharField(max_length=150)
    price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    split_type = models.CharField(max_length=20, choices=SplitType.choices)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class ExpenseParticipant(TimeStampedModel):
    expense_item = models.ForeignKey(ExpenseItem, on_delete=models.CASCADE, related_name="participants")
    friend = models.ForeignKey(Friend, on_delete=models.PROTECT, null=True, blank=True, related_name="expense_participants")
    share_value = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal("0.00"))
    computed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    is_owner_share = models.BooleanField(default=False)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["expense_item", "friend"], name="unique_friend_per_item"),
        ]

    def __str__(self):
        return f"{self.expense_item} - {self.friend or 'owner'}"


class Receivable(TimeStampedModel):
    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"

    class Direction(models.TextChoices):
        OWED_TO_ME = "owed_to_me", "Owed to me"
        OWED_BY_ME = "owed_by_me", "Owed by me"

    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name="receivables")
    friend = models.ForeignKey(Friend, on_delete=models.PROTECT, related_name="receivables")
    direction = models.CharField(max_length=20, choices=Direction.choices, default=Direction.OWED_TO_ME, db_index=True)
    amount_owed = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNPAID, db_index=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["expense", "friend"], name="unique_receivable_per_expense_friend")]
        indexes = [models.Index(fields=["friend", "status"]), models.Index(fields=["expense"])]

    @property
    def balance(self):
        return (self.amount_owed - self.amount_paid).quantize(MONEY_PLACES)

    def update_status(self):
        if self.amount_paid <= 0:
            self.status = self.Status.UNPAID
        elif self.amount_paid < self.amount_owed:
            self.status = self.Status.PARTIAL
        else:
            self.status = self.Status.PAID

    def save(self, *args, **kwargs):
        self.update_status()
        super().save(*args, **kwargs)


class Payment(TimeStampedModel):
    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK = "bank", "Bank Transfer"
        GCASH = "gcash", "GCash"
        OTHER = "other", "Other"

    class Direction(models.TextChoices):
        RECEIVED = "received", "Received from friend"
        SENT = "sent", "Sent to friend"

    friend = models.ForeignKey(Friend, on_delete=models.PROTECT, related_name="payments")
    direction = models.CharField(max_length=20, choices=Direction.choices, default=Direction.RECEIVED, db_index=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    date = models.DateField(db_index=True)
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.CASH)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["friend", "date"])]

    def __str__(self):
        return f"{self.friend} - {self.amount}"


class PaymentAllocation(TimeStampedModel):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="allocations")
    receivable = models.ForeignKey(Receivable, on_delete=models.PROTECT, related_name="allocations")
    amount_allocated = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["payment", "receivable"], name="unique_payment_receivable_allocation")]

    def __str__(self):
        return f"{self.payment_id} -> {self.receivable_id}"

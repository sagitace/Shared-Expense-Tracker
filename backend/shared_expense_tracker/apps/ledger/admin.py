from django.contrib import admin

from .models import Category, Expense, ExpenseItem, ExpenseParticipant, Friend, Payment, PaymentAllocation, Receivable

admin.site.register(Friend)
admin.site.register(Category)
admin.site.register(Expense)
admin.site.register(ExpenseItem)
admin.site.register(ExpenseParticipant)
admin.site.register(Receivable)
admin.site.register(Payment)
admin.site.register(PaymentAllocation)

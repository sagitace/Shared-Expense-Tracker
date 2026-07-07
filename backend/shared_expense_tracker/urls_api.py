from django.urls import include, path

urlpatterns = [
    path("auth/", include("shared_expense_tracker.apps.accounts.urls")),
    path("ledger/", include("shared_expense_tracker.apps.ledger.urls")),
]

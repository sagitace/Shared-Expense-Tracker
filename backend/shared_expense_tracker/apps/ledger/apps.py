from django.apps import AppConfig


class LedgerConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "shared_expense_tracker.apps.ledger"
    label = "ledger"

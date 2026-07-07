import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shared_expense_tracker.settings")

app = Celery("shared_expense_tracker")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

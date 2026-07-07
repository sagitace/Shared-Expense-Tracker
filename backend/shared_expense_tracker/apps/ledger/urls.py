from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CategoryViewSet, DashboardView, ExpenseViewSet, FriendViewSet, PaymentViewSet, ReceivableViewSet

router = DefaultRouter()
router.register(r"friends", FriendViewSet, basename="friend")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"expenses", ExpenseViewSet, basename="expense")
router.register(r"receivables", ReceivableViewSet, basename="receivable")
router.register(r"payments", PaymentViewSet, basename="payment")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]

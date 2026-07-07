from decimal import Decimal

from rest_framework.exceptions import ValidationError

from shared_expense_tracker.apps.ledger.services.splits import calculate_equal_split, calculate_weighted_split


def test_equal_split_assigns_remainder_to_owner():
    participants = [
        {"friend": 1, "share_value": None, "is_owner_share": False},
        {"friend": 2, "share_value": None, "is_owner_share": False},
        {"friend": None, "share_value": None, "is_owner_share": True},
    ]
    shares = calculate_equal_split(Decimal("100.00"), participants)
    assert sum(shares) == Decimal("100.00")
    assert shares[-1] == Decimal("33.34")


def test_custom_split_requires_exact_sum():
    participants = [
        {"friend": 1, "share_value": Decimal("40.00"), "is_owner_share": False},
        {"friend": None, "share_value": Decimal("59.99"), "is_owner_share": True},
    ]
    try:
        calculate_weighted_split(Decimal("100.00"), participants, "custom")
        assert False, "Expected ValidationError"
    except ValidationError:
        assert True


def test_percentage_split_requires_hundred_percent():
    participants = [
        {"friend": 1, "share_value": Decimal("25"), "is_owner_share": False},
        {"friend": None, "share_value": Decimal("74"), "is_owner_share": True},
    ]
    try:
        calculate_weighted_split(Decimal("100.00"), participants, "percentage")
        assert False, "Expected ValidationError"
    except ValidationError:
        assert True

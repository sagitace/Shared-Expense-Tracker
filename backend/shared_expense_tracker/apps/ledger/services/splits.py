from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers

MONEY_PLACES = Decimal("0.01")


def money(value):
    return Decimal(value).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def validate_exact_sum(total, expected, message):
    if money(total) != money(expected):
        raise serializers.ValidationError(message)


def calculate_equal_split(price, participants):
    if not participants:
        raise serializers.ValidationError("At least one participant is required.")
    if not any(participant.get("is_owner_share") for participant in participants):
        raise serializers.ValidationError("Equal splits must include the owner's share.")

    base_share = (price / Decimal(len(participants))).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)
    shares = [base_share for _ in participants]
    remainder = money(price - sum(shares, Decimal("0.00")))
    owner_index = next(index for index, participant in enumerate(participants) if participant.get("is_owner_share"))
    shares[owner_index] = money(shares[owner_index] + remainder)
    return shares


def calculate_weighted_split(price, participants, split_type):
    if not participants:
        raise serializers.ValidationError("At least one participant is required.")
    if not any(participant.get("is_owner_share") for participant in participants):
        raise serializers.ValidationError("Each item must include the owner's share.")

    total_input = sum(Decimal(str(participant.get("share_value", 0))) for participant in participants)
    if split_type == "custom":
        validate_exact_sum(total_input, price, "Custom amounts must sum exactly to the item price.")
        return [money(participant.get("share_value", 0)) for participant in participants]

    if split_type == "percentage":
        validate_exact_sum(total_input, Decimal("100.00"), "Percentages must sum exactly to 100%.")
        raw_shares = [money(price * Decimal(str(participant.get("share_value", 0))) / Decimal("100")) for participant in participants]
    elif split_type == "quantity":
        if total_input <= 0:
            raise serializers.ValidationError("Quantity total must be greater than zero.")
        raw_shares = [money(price * Decimal(str(participant.get("share_value", 0))) / total_input) for participant in participants]
    else:
        raise serializers.ValidationError("Unsupported split type.")

    remainder = money(price - sum(raw_shares, Decimal("0.00")))
    owner_index = next(index for index, participant in enumerate(participants) if participant.get("is_owner_share"))
    raw_shares[owner_index] = money(raw_shares[owner_index] + remainder)
    return raw_shares

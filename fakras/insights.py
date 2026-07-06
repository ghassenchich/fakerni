"""Spend-intelligence helpers.

Pure-Python analysis over the items a user already has — no AI, no extra
storage. Every completed item with a price is historical data we can learn
from, so these helpers derive:

  * predictive restock — items the household buys repeatedly but that aren't
    on any current (pending) list right now.
  * price stats — average / most-recent price seen for an item, which powers
    both the restock hints and price-anomaly detection.
"""

from .models import Item


def normalize_name(name):
    """Case-insensitive, whitespace-collapsed key so 'Milk' and 'milk ' match."""
    return " ".join((name or "").lower().split())


def predict_restock(fakras, limit=8, min_times=2):
    """Suggest items the user regularly buys but hasn't listed yet.

    `fakras` is a queryset of Fakras visible to the user. An item qualifies if
    it has been marked done at least `min_times` times across those Fakras and
    is not currently pending on any of them. Results are ranked by how often
    the item is bought (most frequent first).
    """
    done = (
        Item.objects.filter(fakra__in=fakras, status="done")
        .order_by("done_at")
    )

    # names already on a current list — don't re-suggest those.
    pending_names = {
        normalize_name(n)
        for n in Item.objects.filter(fakra__in=fakras, status="pending")
        .values_list("name", flat=True)
    }

    stats = {}
    for item in done:
        key = normalize_name(item.name)
        if not key:
            continue
        entry = stats.setdefault(
            key,
            {"name": item.name, "count": 0, "unit": "", "category": "", "prices": []},
        )
        entry["count"] += 1
        entry["name"] = item.name  # keep the most recent spelling
        if item.unit:
            entry["unit"] = item.unit
        if item.category:
            entry["category"] = item.category
        if item.estimated_price is not None:
            entry["prices"].append(item.estimated_price)

    suggestions = []
    for key, entry in stats.items():
        if entry["count"] < min_times or key in pending_names:
            continue
        prices = entry["prices"]
        avg = round(sum(prices) / len(prices), 2) if prices else None
        suggestions.append(
            {
                "name": entry["name"],
                "times_bought": entry["count"],
                "unit": entry["unit"],
                "category": entry["category"],
                "avg_price": float(avg) if avg is not None else None,
                "last_price": float(prices[-1]) if prices else None,
            }
        )

    suggestions.sort(key=lambda s: s["times_bought"], reverse=True)
    return suggestions[:limit]


def price_anomaly(fakras, name, price, threshold=0.20):
    """Compare `price` for an item `name` against its historical average.

    Returns a dict describing whether the price is unusually high (more than
    `threshold` above the average of past prices for that item), or None when
    there isn't enough history to judge. Powers "Milk is usually ~2.5, this
    one's 3.2" style warnings.
    """
    if price is None:
        return None

    key = normalize_name(name)
    past = [
        p
        for (n, p) in Item.objects.filter(fakra__in=fakras, status="done")
        .exclude(estimated_price__isnull=True)
        .values_list("name", "estimated_price")
        if normalize_name(n) == key
    ]
    if not past:
        return None

    avg = sum(past) / len(past)
    if avg <= 0:
        return None

    ratio = (float(price) - float(avg)) / float(avg)
    return {
        "name": name,
        "price": float(price),
        "avg_price": round(float(avg), 2),
        "samples": len(past),
        "is_high": ratio > threshold,
        "pct_above_avg": round(ratio * 100, 1),
    }

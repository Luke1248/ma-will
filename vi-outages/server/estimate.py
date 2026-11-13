"""Restoration estimates and per-feeder outage history.

WAPA's map carries an estimatedTimeOfRestoral field, but in the 530,018 record
sightings archived between March and November 2026 it was never filled in. So
the estimate here is statistical: given how long an outage has already lasted,
how much longer did past outages of the same kind (same district, feeder-level
or local) stay on WAPA's map? It is a range from history, not a promise, and
"left the map" is WAPA clearing the record, not a meter-level reading.
"""
from datetime import datetime, timedelta, timezone

MIN_SAMPLES = 12


def _dt(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def _q(sorted_vals, p):
    if not sorted_vals:
        return None
    i = min(len(sorted_vals) - 1, max(0, int(round(p * (len(sorted_vals) - 1)))))
    return sorted_vals[i]


def remaining(durations, elapsed_hours):
    """Quantiles of remaining hours among past outages that lasted longer than elapsed.

    Returns None when history is too thin to say anything.
    """
    longer = sorted(d - elapsed_hours for d in durations if d > elapsed_hours)
    if len(longer) < MIN_SAMPLES:
        return None
    return {"low": round(_q(longer, 0.25), 2), "mid": round(_q(longer, 0.5), 2),
            "high": round(_q(longer, 0.75), 2), "sample": len(longer)}


def estimate_for(record, durations_by_class, now, rotation_end=None):
    """Estimate for one open record.

    Order of trust: WAPA's own restoration time, then the end of a rotation
    slot WAPA scheduled for this feeder, then the range from history.
    """
    start = _dt(record.get("start"))
    if record.get("etr"):
        return {"basis": "wapa", "at": record["etr"]}
    if rotation_end and rotation_end > now:
        return {"basis": "rotation", "at": _iso(rotation_end)}
    if not start:
        return {"basis": "none"}
    elapsed = max(0.0, (now - start).total_seconds() / 3600.0)
    r = remaining(durations_by_class.get((record.get("district"), record.get("level")), []), elapsed)
    if not r:
        return {"basis": "none", "elapsed_hours": round(elapsed, 2)}
    return {
        "basis": "history",
        "elapsed_hours": round(elapsed, 2),
        "low": _iso(now + timedelta(hours=r["low"])),
        "mid": _iso(now + timedelta(hours=r["mid"])),
        "high": _iso(now + timedelta(hours=r["high"])),
        "sample": r["sample"],
    }


def _iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def union_hours(intervals):
    """Total hours covered by possibly-overlapping (start, end) intervals."""
    total, cur_s, cur_e = 0.0, None, None
    for s, e in sorted(intervals):
        if cur_e is None or s > cur_e:
            if cur_e is not None:
                total += (cur_e - cur_s).total_seconds()
            cur_s, cur_e = s, e
        elif e > cur_e:
            cur_e = e
    if cur_e is not None:
        total += (cur_e - cur_s).total_seconds()
    return total / 3600.0


def feeder_history(records, now, windows=(7, 30, 90)):
    """{(district, feeder): {'d7': {...}, 'd30': {...}, 'd90': {...}, 'last': iso}}

    count  = feeder-level outage records WAPA posted that started in the window
    hours  = hours in the window during which at least part of the feeder was
             out (overlapping records are merged, not double counted)
    """
    by = {}
    for r in records:
        s, e = _dt(r["start"]), (now if r["open"] else _dt(r["last_seen"]))
        if not s or not e or e < s:
            continue
        by.setdefault((r["district"], r["feeder"]), []).append((s, e))
    out = {}
    for key, ivs in by.items():
        h = {"last": _iso(max(s for s, _ in ivs))}
        for w in windows:
            lo = now - timedelta(days=w)
            clipped = [(max(s, lo), e) for s, e in ivs if e > lo]
            h["d%d" % w] = {
                "count": sum(1 for s, _ in ivs if s >= lo),
                "hours": round(union_hours(clipped), 1),
                "longest": round(max([(e - s).total_seconds() / 3600 for s, e in clipped] or [0]), 1),
            }
        out[key] = h
    return out

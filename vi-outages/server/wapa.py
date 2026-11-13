"""Fetch and normalise WAPA's public outage map feed.

The map at http://outageviewer.viwapa.vi:7575/ serves three JSON endpoints under
/data/: outages, outageSummary and outagePolygons. This module reads the first
two. Field names are WAPA's; see README.md for what each one does and does not
tell you.
"""
import json
import re
import urllib.request
from datetime import datetime, timezone

DEFAULT_BASE = "http://outageviewer.viwapa.vi:7575/data/"
USER_AGENT = "vi-outage-tracker/1.0 (public-interest outage dashboard)"

FEEDER_RE = re.compile(r"^(?:STX\s+)?Feeder\s+0*(\d{1,2}[A-E])\b", re.I)


def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def fetch_poll(base=DEFAULT_BASE, timeout=20):
    """Return (summary, outages) as WAPA sent them."""
    base = base.rstrip("/") + "/"
    summary = fetch_json(base + "outageSummary", timeout)
    outages = fetch_json(base + "outages", timeout)
    if not isinstance(summary, dict) or not isinstance(outages, list):
        raise ValueError("unexpected response shape from WAPA")
    return summary, outages


def parse_time(value):
    """Parse one of WAPA's ISO timestamps to an aware UTC datetime, or None."""
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        m = re.match(r"(.*\.\d{6})\d+(.*)", value)  # trim >6 fractional digits
        if not m:
            return None
        try:
            dt = datetime.fromisoformat(m.group(1) + m.group(2))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def feeder_of(name):
    """'Feeder 06A' / 'STX Feeder 9A' -> '6A'. Transformer-level names -> None."""
    m = FEEDER_RE.match(name or "")
    return m.group(1).upper() if m else None


def district_of(name, lat, lng):
    """STX (St. Croix) or STTJ (St. Thomas, St. John, Water Island: one grid)."""
    n = (name or "").upper()
    if n.startswith(("T-C-", "STX", "FUSC")):
        return "STX"
    if n.startswith(("T-T-", "T-J-", "FEEDER", "STT", "STJ", "FUST")):
        return "STTJ"
    if lat is not None:
        if lat < 17.9:
            return "STX"
        if lat > 18.2:
            return "STTJ"
    return None


def island_of(name, district, feeder, lng):
    if district == "STX":
        return "STX"
    if district != "STTJ":
        return None
    n = (name or "").upper()
    if n.startswith(("T-J-", "STJ")) or feeder in ("7E", "9E"):
        return "STJ"
    if n.startswith(("T-T-", "STT")):
        return "STT"
    if lng is not None and lng > -64.81:
        return "STJ"
    return "STT"


def estate_of(street_labels):
    """A coarse place name from WAPA's street labels.

    Labels are parcel-level and can carry a person's name, so the raw labels are
    never stored or shown. This keeps the leading words before the first token
    with a digit, e.g. 'EST NAZARETH 2W-40' -> 'Nazareth'.
    """
    counts = {}
    for label in street_labels or []:
        words = []
        for w in str(label).split():
            if any(c.isdigit() for c in w):
                break
            if w.upper().strip(".") in ("ESTATE", "EST", "REM", "REMAINDER"):
                continue
            words.append(w)
            if len(words) == 2:
                break
        if words:
            key = " ".join(words).title()
            counts[key] = counts.get(key, 0) + 1
    if not counts:
        return None
    return max(counts.items(), key=lambda kv: kv[1])[0]


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def normalise(outages):
    """WAPA outage records -> the fields this app keeps."""
    out = []
    for r in outages:
        rid = r.get("outageRecID")
        if not rid:
            continue
        name = r.get("outageName") or ""
        pt = r.get("outagePoint") or {}
        lat, lng = pt.get("lat"), pt.get("lng")
        feeder = feeder_of(name)
        district = district_of(name, lat, lng)
        out.append({
            "id": str(rid),
            "feeder": feeder,
            "level": "feeder" if feeder else "local",
            "district": district,
            "island": island_of(name, district, feeder, lng),
            "area": estate_of(r.get("streetsAffected")),
            "lat": round(lat, 3) if isinstance(lat, (int, float)) else None,  # ~100 m; not a house
            "lng": round(lng, 3) if isinstance(lng, (int, float)) else None,
            "start": iso(parse_time(r.get("outageStartTime"))),
            "etr": iso(parse_time(r.get("estimatedTimeOfRestoral"))),
            "out_now": _int(r.get("customersOutNow")),
            "out_initially": _int(r.get("customersOutInitially")),
            "cause": (r.get("cause") or "").strip() or None,
            "crew": bool(r.get("crewAssigned")),
            "verified": bool(r.get("verified")),
        })
    return out

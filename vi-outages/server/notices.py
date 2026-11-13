"""WAPA's published notices: alert banner, news releases, rotation schedule.

Sources, all on www.viwapa.vi:
  /news-information/advisory-details   alert banner + link to the rotation PDF
  /news-information/press-releases     news release titles and dates
The rotation schedule is a PDF; reading it needs `pdftotext` (poppler-utils).
Without it the app still links to the PDF.
"""
import html
import re
import shutil
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from wapa import USER_AGENT

SITE = "https://www.viwapa.vi"
ADVISORY_URL = SITE + "/news-information/advisory-details"
RELEASES_URL = SITE + "/news-information/press-releases"
AST = timezone(timedelta(hours=-4))

POWER_WORDS = re.compile(
    r"outage|rotation|rotating|rotational|interruption|feeder|generation|unit \d|restor|"
    r"power|electric|conserv|blackout|load shed", re.I)
MONTHS = {m: i for i, m in enumerate(
    ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER",
     "OCTOBER", "NOVEMBER", "DECEMBER"], 1)}


def _get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _text(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def parse_banner(page):
    """The 'ALERTS' strip at the top of every WAPA page."""
    m = re.search(r'(?is)id="[^"]*lblProgrammedServiceInterruption"[^>]*>(.*?)</span>', page)
    if not m:
        m = re.search(r"(?s)>\s*ALERTS\s*</[^>]+>(.*?)SIGN UP FOR WAPA ALERTS", page)
    if not m:
        return None
    text = _text(m.group(1))
    return text or None


def parse_schedule_links(page):
    links = re.findall(r'href="([^"]*outage-schedule/[^"]+\.pdf[^"]*)"', page, re.I)
    return list(dict.fromkeys(urllib.parse.urljoin(SITE, html.unescape(l)) for l in links))


def parse_releases(page, limit=12):
    """News releases whose title is about power supply."""
    out = []
    pat = re.compile(
        r'(?is)<a[^>]+href="([^"]*press-release-details/(\d{4})/(\d{2})/(\d{2})/[^"]+)"[^>]*>(.*?)</a>')
    seen = set()
    for href, y, mo, d, inner in pat.findall(page):
        title = _text(inner)
        url = urllib.parse.urljoin(RELEASES_URL.rsplit("/", 1)[0] + "/", html.unescape(href))
        if not title or url in seen:
            continue
        seen.add(url)
        if POWER_WORDS.search(title):
            out.append({"title": title, "date": "%s-%s-%s" % (y, mo, d), "url": url})
    return out[:limit]


# -- rotation schedule ---------------------------------------------------------

SLOT_RE = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*([AP]M)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*([AP]M)", re.I)
FEEDER_TOKEN = re.compile(r"Feeder\s+0*(\d{1,2}[A-E])(\s+Partial)?", re.I)
DATE_RE = re.compile(r"\b(" + "|".join(MONTHS) + r")\s+(\d{1,2}),\s*(\d{4})", re.I)


def _hour(h, m, ap):
    h = int(h) % 12 + (12 if ap.upper() == "PM" else 0)
    return h * 60 + int(m or 0)


def parse_rotation_text(text):
    """Read WAPA's rotation schedule from `pdftotext -layout` output.

    The PDF is a grid: a row of time slots, with the feeders for each slot
    stacked in the column beneath it. Layout mode keeps horizontal position, so
    each 'Feeder NN' is assigned to the slot header nearest above it.
    Returns {'date', 'district', 'slots': [{'start','end','feeders':[{'feeder','partial'}]}]}.
    """
    date = None
    m = DATE_RE.search(text)
    if m:
        date = "%04d-%02d-%02d" % (int(m.group(3)), MONTHS[m.group(1).upper()], int(m.group(2)))
    dm = re.search(r"(STT\s*/\s*STJ|ST\.?\s*CROIX|STX)\s+DISTRICT", text, re.I)
    district = None
    if dm:
        district = "STX" if re.search(r"croix|stx", dm.group(1), re.I) else "STTJ"

    slots, current = [], []  # current: [(center_column, slot_dict)]
    for line in text.replace("\f", "\n").split("\n"):
        headers = list(SLOT_RE.finditer(line))
        if headers:
            current = []
            for h in headers:
                slot = {"start": _hour(h.group(1), h.group(2), h.group(3)),
                        "end": _hour(h.group(4), h.group(5), h.group(6)), "feeders": []}
                if slot["end"] <= slot["start"]:
                    slot["end"] += 24 * 60  # '10 PM - 12 AM'
                slots.append(slot)
                current.append(((h.start() + h.end()) / 2.0, slot))
            continue
        if not current:
            continue
        for f in FEEDER_TOKEN.finditer(line):
            center = (f.start() + f.end()) / 2.0
            slot = min(current, key=lambda cs: abs(cs[0] - center))[1]
            entry = {"feeder": f.group(1).upper(), "partial": bool(f.group(2))}
            if entry not in slot["feeders"]:
                slot["feeders"].append(entry)
    slots = [s for s in slots if s["feeders"]]
    slots.sort(key=lambda s: s["start"])
    tentative = bool(re.search(r"tentative|only be activated if needed", text, re.I))
    return {"date": date, "district": district, "slots": slots, "tentative": tentative}


def pdf_to_text(pdf_bytes):
    if not shutil.which("pdftotext"):
        return None
    try:
        p = subprocess.run(["pdftotext", "-layout", "-", "-"], input=pdf_bytes,
                           capture_output=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    return p.stdout.decode("utf-8", "replace") if p.returncode == 0 else None


def rotation_end_for(schedules, district, feeder, now):
    """If `feeder` is in a rotation slot covering `now`, return that slot's end.

    WAPA's schedule says restoration may lag by up to 15 minutes; that is added.
    """
    local = now.astimezone(AST)
    for sch in schedules or []:
        if sch.get("district") != district or sch.get("date") != local.strftime("%Y-%m-%d"):
            continue
        minute = local.hour * 60 + local.minute
        for s in sch["slots"]:
            if s["start"] <= minute < s["end"] and any(f["feeder"] == feeder for f in s["feeders"]):
                midnight = local.replace(hour=0, minute=0, second=0, microsecond=0)
                return (midnight + timedelta(minutes=s["end"] + 15)).astimezone(timezone.utc)
    return None


def fetch_all():
    """Fetch and parse everything. Each part fails independently."""
    out = {"banner": None, "releases": [], "schedules": [], "schedule_links": [],
           "fetched": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "errors": []}
    try:
        page = _get(ADVISORY_URL).decode("utf-8", "replace")
        out["banner"] = parse_banner(page)
        out["schedule_links"] = parse_schedule_links(page)
    except Exception as e:  # network, parse: report and carry on
        out["errors"].append("advisories: %s" % e)
    for link in out["schedule_links"]:
        try:
            text = pdf_to_text(_get(link))
            if text:
                sch = parse_rotation_text(text)
                if sch["slots"]:
                    sch["url"] = link
                    out["schedules"].append(sch)
        except Exception as e:
            out["errors"].append("schedule: %s" % e)
    try:
        out["releases"] = parse_releases(_get(RELEASES_URL).decode("utf-8", "replace"))
    except Exception as e:
        out["errors"].append("releases: %s" % e)
    return out

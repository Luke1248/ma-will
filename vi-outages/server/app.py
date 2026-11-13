"""VI Power Watch server: polls WAPA, keeps history, serves the app and its API.

Standard library only. Run: python3 server/app.py
Environment:
  PORT            port to listen on (default 8080)
  DB_PATH         SQLite file (default ./vi-outages.db). Put it on a persistent disk.
  WAPA_BASE       outage map data URL (default http://outageviewer.viwapa.vi:7575/data/)
  POLL_SECONDS    seconds between polls (default 300)
  REPORT_SALT     secret mixed into device hashes for community reports
  NO_POLL=1       serve what is in the database without polling (for tests)
"""
import csv
import gzip
import json
import mimetypes
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import estimate
import notices as notices_mod
import wapa
from store import AST, Store

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "..", "web")
LINGER_HOURS = 72          # a record open this long is probably a stale map entry
REPORT_WINDOW_MIN = 90     # community reports count for this long
MAX_LOCAL = 300


def load_json(name):
    with open(os.path.join(HERE, "data", name), encoding="utf-8") as f:
        return json.load(f)


FEEDERS = load_json("feeders.json")
GENERATION = load_json("generation.json")
FEEDER_IDS = {d: {f["id"] for f in FEEDERS[d]} for d in ("STTJ", "STX")}


def utcnow():
    return datetime.now(timezone.utc)


def import_seed(store):
    """Load archived history on first run so the app does not start empty."""
    if store.get_meta("seeded"):
        return 0
    n = 0
    rec_path = os.path.join(HERE, "seed", "records.csv.gz")
    if os.path.exists(rec_path):
        with gzip.open(rec_path, "rt", encoding="utf-8") as f, store.lock:
            for r in csv.DictReader(f):
                store.db.execute(
                    "INSERT OR IGNORE INTO records(id,feeder,level,district,island,lat,lng,start,first_seen,"
                    "last_seen,max_out,out_now,cause,crew,verified,open,source) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,0,?,0,0,0,'archive')",
                    (r["id"], r["feeder"] or None, r["level"], r["district"] or None, r["island"] or None,
                     r["lat"] or None, r["lng"] or None, r["start"] or None, r["first_seen"], r["last_seen"],
                     int(r["max_out"] or 0), r["cause"] or None))
                n += 1
            store.db.commit()
    day_path = os.path.join(HERE, "seed", "daily.csv")
    if os.path.exists(day_path):
        with open(day_path, encoding="utf-8") as f, store.lock:
            for r in csv.DictReader(f):
                store.db.execute("INSERT OR IGNORE INTO daily VALUES(?,?,?,?,?)",
                                 (r["date"], r["district"], float(r["customer_hours"] or 0),
                                  int(float(r["max_out"] or 0)), float(r["covered_hours"] or 0)))
            store.db.commit()
    store.set_meta("seeded", "1")
    return n


class Service:
    def __init__(self, store, base=wapa.DEFAULT_BASE, salt=""):
        self.store = store
        self.base = base
        self.salt = salt
        self.notices = json.loads(store.get_meta("notices", "null") or "null")
        self.last_error = None
        self.last_attempt = None
        self._cache = None
        self._lock = threading.Lock()

    # -- polling ------------------------------------------------------------
    def poll_once(self, now=None, fetched=None):
        """One poll. `fetched` = (summary, outages) lets tests replay archived responses."""
        now = now or utcnow()
        self.last_attempt = now
        try:
            summary, outages = fetched or wapa.fetch_poll(self.base)
            records = wapa.normalise(outages)
            fresh = self.store.save_poll(
                now, wapa.parse_time(summary.get("updateTime")),
                int(summary.get("customersServed") or 0), int(summary.get("customersOutNow") or 0), records)
            hourly = [{"t": wapa.iso(wapa.parse_time(h.get("eventTime"))), "out": int(h.get("customers") or 0)}
                      for h in (summary.get("hourlyCustomersOut") or [])]
            if fresh:
                self.store.set_meta("hourly", json.dumps([h for h in hourly if h["t"]]))
            self.last_error = None
        except Exception as e:  # network or shape error: keep serving the last good data
            self.last_error = "%s: %s" % (type(e).__name__, e)
        self.invalidate()
        return self.last_error is None

    def refresh_notices(self):
        n = notices_mod.fetch_all()
        prev = self.notices or {}
        for k in ("banner", "releases", "schedules", "schedule_links"):  # keep last good part on failure
            if not n.get(k) and n["errors"] and prev.get(k):
                n[k] = prev[k]
        self.notices = n
        self.store.set_meta("notices", json.dumps(n))
        self.invalidate()

    def invalidate(self):
        with self._lock:
            self._cache = None

    # -- status payload -----------------------------------------------------
    def status_bytes(self, now=None):
        with self._lock:
            if self._cache and now is None and time.time() - self._cache[0] < 30:
                return self._cache[1]
        body = json.dumps(self.build_status(now or utcnow()), separators=(",", ":")).encode()
        with self._lock:
            self._cache = (time.time(), body)
        return body

    def build_status(self, now):
        st = self.store
        latest = st.latest_poll()
        fresh = st.latest_poll(fresh_only=True)
        opens = st.open_records() if fresh else []
        durations = st.closed_durations()
        history = estimate.feeder_history(st.feeder_records_since(now - timedelta(days=90)), now)
        crowd = st.report_counts(now - timedelta(minutes=REPORT_WINDOW_MIN))
        schedules = (self.notices or {}).get("schedules") or []

        def age_min(ts):
            return None if not ts else round((now - datetime.fromisoformat(ts.replace("Z", "+00:00"))).total_seconds() / 60)

        feed_age = age_min(fresh["update_time"]) if fresh else None
        state = "ok"
        if not fresh:
            state = "no_data"
        elif (latest and not latest["fresh"]) or (feed_age is not None and feed_age > 45):
            state = "stale"

        def with_estimate(r):
            rot_end = notices_mod.rotation_end_for(schedules, r["district"], r["feeder"], now) if r["feeder"] else None
            hours = None
            if r["start"]:
                hours = (now - datetime.fromisoformat(r["start"].replace("Z", "+00:00"))).total_seconds() / 3600
            return {
                "id": r["id"], "district": r["district"], "island": r["island"], "area": r["area"],
                "out": r["out_now"], "max_out": r["max_out"], "start": r["start"],
                "cause": r["cause"], "crew": bool(r["crew"]), "lat": r["lat"], "lng": r["lng"],
                "lingering": bool(hours is not None and hours > LINGER_HOURS),
                "estimate": estimate.estimate_for(r, durations, now, rot_end),
            }

        feeders = {}
        for d in ("STTJ", "STX"):
            feeders[d] = []
            for f in FEEDERS[d]:
                act = [with_estimate(r) for r in opens if r["district"] == d and r["feeder"] == f["id"]]
                c = crowd.get((d, f["id"]), {"out": 0, "on": 0})
                feeders[d].append({
                    "id": f["id"], "island": f["island"], "span": f.get("span"), "areas": f.get("areas", []),
                    "out": sum(a["out"] for a in act), "active": act,
                    "history": history.get((d, f["id"])),
                    "reports": c,
                })
        local = [with_estimate(r) for r in opens if not r["feeder"]]

        def dsum(d):
            rs = [r for r in opens if r["district"] == d]
            return {"out": sum(r["out_now"] for r in rs), "records": len(rs),
                    "feeder_records": sum(1 for r in rs if r["feeder"]),
                    "feeders_out": len({r["feeder"] for r in rs if r["feeder"]}),
                    "reports": crowd.get((d, None), {"out": 0, "on": 0})}

        islands = {}
        for r in opens:
            k = r["island"] or "unknown"
            islands.setdefault(k, {"out": 0, "records": 0})
            islands[k]["out"] += r["out_now"]
            islands[k]["records"] += 1

        since = (now.astimezone(AST) - timedelta(days=30)).strftime("%Y-%m-%d")
        return {
            "generated": wapa.iso(now),
            "feed": {
                "state": state,
                "wapa_updated": fresh["update_time"] if fresh else None,
                "polled": fresh["ts"] if fresh else None,
                "age_min": feed_age,
                "error": self.last_error,
            },
            "totals": {
                "out": fresh["out_now"] if fresh else None,
                "served": fresh["served"] if fresh else None,
                "records": len(opens),
                "lingering": sum(1 for r in local if r["lingering"]),
            },
            "districts": {"STTJ": dsum("STTJ"), "STX": dsum("STX")},
            "islands": islands,
            "hourly": json.loads(st.get_meta("hourly", "[]") or "[]")[-48:],
            "feeders": feeders,
            "local": local[:MAX_LOCAL],
            "daily": st.daily_since(since),
            "notices": {k: (self.notices or {}).get(k) for k in ("banner", "releases", "schedules", "schedule_links", "fetched")},
            "generation": GENERATION,
            "typical": {
                "%s_%s" % (d or "NA", lvl): {"median_hours": round(estimate._q(v, 0.5), 2), "n": len(v)}
                for (d, lvl), v in durations.items() if len(v) >= estimate.MIN_SAMPLES},
        }

    # -- community reports --------------------------------------------------
    def add_report(self, body, now=None):
        district, feeder, status = body.get("district"), body.get("feeder") or None, body.get("status")
        device = str(body.get("device") or "")
        if district not in FEEDER_IDS or status not in ("out", "on"):
            return "district must be STTJ or STX and status 'out' or 'on'"
        if feeder is not None and feeder not in FEEDER_IDS[district]:
            return "unknown feeder for that district"
        if not (8 <= len(device) <= 64):
            return "missing device id"
        self.store.add_report(device, district, feeder, status, now or utcnow(), self.salt)
        self.invalidate()
        return None


class RateLimit:
    def __init__(self, per_minute):
        self.per_minute, self.hits, self.lock = per_minute, {}, threading.Lock()

    def allow(self, key):
        t = time.time()
        with self.lock:
            q = [x for x in self.hits.get(key, []) if t - x < 60]
            ok = len(q) < self.per_minute
            if ok:
                q.append(t)
            self.hits[key] = q
            if len(self.hits) > 5000:
                self.hits = {k: v for k, v in self.hits.items() if v and t - v[-1] < 60}
            return ok


def make_handler(service):
    limiter = RateLimit(6)

    class Handler(BaseHTTPRequestHandler):
        server_version = "VIPowerWatch/1.0"

        def log_message(self, *a):  # quiet
            pass

        def _send(self, code, body, ctype="application/json", cache="no-store"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", cache)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def do_GET(self):
            path = self.path.split("?", 1)[0]
            if path == "/api/status":
                return self._send(200, service.status_bytes(), cache="public, max-age=30")
            if path == "/healthz":
                return self._send(200, b'{"ok":true}')
            rel = "index.html" if path in ("/", "") else path.lstrip("/")
            full = os.path.realpath(os.path.join(WEB, rel))
            if not full.startswith(os.path.realpath(WEB) + os.sep) or not os.path.isfile(full):
                return self._send(404, b'{"error":"not found"}')
            with open(full, "rb") as f:
                body = f.read()
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            if full.endswith(".webmanifest"):
                ctype = "application/manifest+json"
            cache = "no-cache" if rel in ("index.html", "sw.js") else "public, max-age=3600"
            self._send(200, body, ctype, cache)

        do_HEAD = do_GET

        def do_POST(self):
            if self.path.split("?", 1)[0] != "/api/report":
                return self._send(404, b'{"error":"not found"}')
            ip = (self.headers.get("X-Forwarded-For") or self.client_address[0]).split(",")[0].strip()
            if not limiter.allow(ip):
                return self._send(429, b'{"error":"too many reports, try again in a minute"}')
            try:
                n = int(self.headers.get("Content-Length") or 0)
                if not 0 < n <= 2048:
                    raise ValueError
                body = json.loads(self.rfile.read(n))
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                return self._send(400, b'{"error":"bad request"}')
            err = service.add_report(body)
            if err:
                return self._send(400, json.dumps({"error": err}).encode())
            self._send(200, b'{"ok":true}')

    return Handler


def poll_loop(service, seconds):
    last_notices = 0
    while True:
        service.poll_once()
        if time.time() - last_notices > 1800:
            try:
                service.refresh_notices()
            except Exception:
                pass
            last_notices = time.time()
            service.store.prune(utcnow())
        time.sleep(seconds)


def main():
    store = Store(os.environ.get("DB_PATH", "vi-outages.db"))
    n = import_seed(store)
    if n:
        print("imported %d archived records" % n, flush=True)
    service = Service(store, os.environ.get("WAPA_BASE", wapa.DEFAULT_BASE), os.environ.get("REPORT_SALT", ""))
    if not os.environ.get("NO_POLL"):
        threading.Thread(target=poll_loop, args=(service, int(os.environ.get("POLL_SECONDS", "300"))),
                         daemon=True).start()
    port = int(os.environ.get("PORT", "8080"))
    print("listening on :%d" % port, flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), make_handler(service)).serve_forever()


if __name__ == "__main__":
    main()

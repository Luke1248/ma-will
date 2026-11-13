"""SQLite storage: polls, outage records, daily district totals, community reports."""
import hashlib
import sqlite3
import threading
from datetime import datetime, timedelta, timezone

from wapa import iso

SCHEMA = """
CREATE TABLE IF NOT EXISTS polls (
  ts TEXT PRIMARY KEY, update_time TEXT, served INTEGER, out_now INTEGER,
  out_stx INTEGER, out_sttj INTEGER, records INTEGER, fresh INTEGER
);
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY, feeder TEXT, level TEXT, district TEXT, island TEXT, area TEXT,
  lat REAL, lng REAL, start TEXT, first_seen TEXT, last_seen TEXT,
  max_out INTEGER, out_now INTEGER, cause TEXT, crew INTEGER, verified INTEGER,
  etr TEXT, open INTEGER, source TEXT DEFAULT 'live'
);
CREATE INDEX IF NOT EXISTS records_open ON records(open);
CREATE INDEX IF NOT EXISTS records_feeder ON records(district, feeder, start);
CREATE TABLE IF NOT EXISTS daily (
  date TEXT, district TEXT, customer_hours REAL, max_out INTEGER, covered_hours REAL,
  PRIMARY KEY (date, district)
);
CREATE TABLE IF NOT EXISTS reports (
  device TEXT, district TEXT, feeder TEXT, status TEXT, ts TEXT,
  PRIMARY KEY (device)
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
"""

AST = timezone(timedelta(hours=-4))  # Atlantic Standard Time, no daylight saving
STALE_MINUTES = 30      # WAPA's own updateTime older than this: feed is stale
GAP_CAP_MINUTES = 15    # a poll stands for at most this long when summing


class Store:
    def __init__(self, path):
        self.lock = threading.RLock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.commit()

    # -- meta ---------------------------------------------------------------
    def get_meta(self, k, default=None):
        with self.lock:
            row = self.db.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
        return row["v"] if row else default

    def set_meta(self, k, v):
        with self.lock:
            self.db.execute("INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, v))
            self.db.commit()

    # -- polls --------------------------------------------------------------
    def save_poll(self, now, summary_update, served, out_now, records):
        """Store one poll. Returns True when the poll was fresh (usable).

        A stale poll is WAPA's old content: it is recorded, but it never closes
        a record and never adds to a total. Missing time is not zero outage.
        """
        fresh = bool(summary_update and (now - summary_update) <= timedelta(minutes=STALE_MINUTES))
        out_stx = sum(r["out_now"] for r in records if r["district"] == "STX")
        out_sttj = sum(r["out_now"] for r in records if r["district"] == "STTJ")
        with self.lock:
            prev = self.db.execute("SELECT ts, out_stx, out_sttj FROM polls WHERE fresh=1 ORDER BY ts DESC LIMIT 1").fetchone()
            self.db.execute(
                "INSERT OR REPLACE INTO polls VALUES(?,?,?,?,?,?,?,?)",
                (iso(now), iso(summary_update), served, out_now, out_stx, out_sttj, len(records), int(fresh)),
            )
            if fresh:
                self._upsert_records(now, records)
                if prev:
                    self._add_daily(datetime.fromisoformat(prev["ts"].replace("Z", "+00:00")), now,
                                    {"STX": prev["out_stx"], "STTJ": prev["out_sttj"]})
            self.db.commit()
        return fresh

    def _upsert_records(self, now, records):
        # WAPA renames records while they are open: an outage first posted under a
        # transformer name can become 'Feeder 06A' a poll later. Once a record has
        # carried a feeder name it keeps it.
        ts = iso(now)
        seen = set()
        for r in records:
            seen.add(r["id"])
            self.db.execute(
                """INSERT INTO records(id,feeder,level,district,island,area,lat,lng,start,first_seen,last_seen,
                                       max_out,out_now,cause,crew,verified,etr,open,source)
                   VALUES(:id,:feeder,:level,:district,:island,:area,:lat,:lng,:start,:ts,:ts,
                          :out_now,:out_now,:cause,:crew,:verified,:etr,1,'live')
                   ON CONFLICT(id) DO UPDATE SET
                     last_seen=:ts, out_now=:out_now, max_out=MAX(max_out,:out_now), open=1,
                     start=COALESCE(:start,start), cause=COALESCE(:cause,cause), crew=:crew,
                     verified=:verified, etr=:etr, area=COALESCE(:area,area),
                     district=COALESCE(:district,district), island=COALESCE(:island,island),
                     feeder=COALESCE(:feeder,feeder),
                     level=CASE WHEN :feeder IS NOT NULL THEN 'feeder' ELSE level END""",
                dict(r, ts=ts, crew=int(r["crew"]), verified=int(r["verified"])),
            )
        # A record missing from a fresh poll has left WAPA's map.
        for row in self.db.execute("SELECT id FROM records WHERE open=1").fetchall():
            if row["id"] not in seen:
                self.db.execute("UPDATE records SET open=0, out_now=0 WHERE id=?", (row["id"],))

    def _add_daily(self, prev_ts, now, prev_out):
        minutes = min((now - prev_ts).total_seconds() / 60.0, GAP_CAP_MINUTES)
        if minutes <= 0:
            return
        day = prev_ts.astimezone(AST).strftime("%Y-%m-%d")
        for district, out in prev_out.items():
            out = out or 0
            self.db.execute(
                """INSERT INTO daily VALUES(?,?,?,?,?)
                   ON CONFLICT(date,district) DO UPDATE SET
                     customer_hours=customer_hours+excluded.customer_hours,
                     max_out=MAX(max_out,excluded.max_out),
                     covered_hours=covered_hours+excluded.covered_hours""",
                (day, district, out * minutes / 60.0, out, minutes / 60.0),
            )

    # -- reads --------------------------------------------------------------
    def rows(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def latest_poll(self, fresh_only=False):
        q = "SELECT * FROM polls %s ORDER BY ts DESC LIMIT 1" % ("WHERE fresh=1" if fresh_only else "")
        rows = self.rows(q)
        return rows[0] if rows else None

    def open_records(self):
        return self.rows("SELECT * FROM records WHERE open=1 ORDER BY out_now DESC")

    def closed_durations(self):
        """Hours each finished record stayed on the map, by district and level."""
        out = {}
        for r in self.rows("SELECT district, level, start, last_seen FROM records WHERE open=0 AND start IS NOT NULL"):
            h = _hours(r["start"], r["last_seen"])
            if h is not None and 0 < h < 24 * 30:
                out.setdefault((r["district"], r["level"]), []).append(h)
        for v in out.values():
            v.sort()
        return out

    def feeder_records_since(self, since):
        return self.rows(
            "SELECT district, feeder, start, last_seen, open, max_out FROM records "
            "WHERE feeder IS NOT NULL AND start IS NOT NULL AND last_seen>=?", (iso(since),))

    def daily_since(self, date):
        return self.rows("SELECT * FROM daily WHERE date>=? ORDER BY date", (date,))

    # -- community reports --------------------------------------------------
    def add_report(self, device_id, district, feeder, status, now, salt=""):
        device = hashlib.sha256((salt + device_id).encode()).hexdigest()[:32]
        with self.lock:
            self.db.execute("INSERT OR REPLACE INTO reports VALUES(?,?,?,?,?)",
                            (device, district, feeder, status, iso(now)))
            self.db.commit()

    def report_counts(self, since):
        """{(district, feeder): {'out': n, 'on': n}} from reports newer than `since`."""
        out = {}
        for r in self.rows("SELECT district, feeder, status, COUNT(*) n FROM reports WHERE ts>=? "
                           "GROUP BY district, feeder, status", (iso(since),)):
            out.setdefault((r["district"], r["feeder"]), {"out": 0, "on": 0})[r["status"]] = r["n"]
        return out

    def prune(self, now):
        with self.lock:
            self.db.execute("DELETE FROM reports WHERE ts<?", (iso(now - timedelta(days=2)),))
            self.db.execute("DELETE FROM polls WHERE ts<?", (iso(now - timedelta(days=14)),))
            self.db.commit()


def _hours(a, b):
    try:
        da = datetime.fromisoformat(a.replace("Z", "+00:00"))
        db = datetime.fromisoformat(b.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None
    return (db - da).total_seconds() / 3600.0

"""Replay archived WAPA responses through the server and check what it reports.

Run: python3 -m unittest discover -s tests -v
Fixtures: tests/fixtures/replay.json is 18 real polls of WAPA's map from the
evening of 3 Nov 2026 (AST), from VI Update's CC0 archive, with street labels
trimmed. The rotation, advisories and press-release fixtures are WAPA's pages.
"""
import json, os, sys, unittest
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "server"))
import app, estimate, notices, wapa
from store import Store

FIX = os.path.join(HERE, "fixtures")
UTC = timezone.utc


def load(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as f:
        return f.read()


def replay(service, polls):
    for p in polls:
        now = wapa.parse_time(p["fetchedAt"])
        assert service.poll_once(now, (p["summary"], p["outages"])), service.last_error
    return wapa.parse_time(polls[-1]["fetchedAt"])


class WapaParsing(unittest.TestCase):
    def test_feeder_names(self):
        self.assertEqual(wapa.feeder_of("Feeder 06A"), "6A")
        self.assertEqual(wapa.feeder_of("STX Feeder 9A"), "9A")
        self.assertEqual(wapa.feeder_of("Feeder 10B"), "10B")
        self.assertIsNone(wapa.feeder_of("T-T-14319"))

    def test_districts_and_islands(self):
        self.assertEqual(wapa.district_of("T-C-00318", 17.75, -64.6), "STX")
        self.assertEqual(wapa.district_of("Feeder 07E", 18.33, -64.75), "STTJ")
        self.assertEqual(wapa.district_of("", 17.7, -64.8), "STX")
        self.assertIsNone(wapa.district_of("", 18.0, -64.8))
        self.assertEqual(wapa.island_of("Feeder 07E", "STTJ", "7E", -64.9), "STJ")
        self.assertEqual(wapa.island_of("T-T-1", "STTJ", None, -64.93), "STT")

    def test_estate_drops_parcel_detail(self):
        self.assertEqual(wapa.estate_of(["EST NAZARETH 2W-40", "NAZARETH 2W-39", "NAZARETH 2W-44"]), "Nazareth")
        self.assertEqual(wapa.estate_of(["AGNES FANCY 5-A", "AGNES FANCY"]), "Agnes Fancy")
        self.assertIsNone(wapa.estate_of([]))

    def test_time_with_seven_fraction_digits(self):
        t = wapa.parse_time("2026-11-07T08:40:06.7246410-04:00")
        self.assertEqual(wapa.iso(t), "2026-11-07T12:40:06Z")
        self.assertIsNone(wapa.parse_time(None))


class Replay(unittest.TestCase):
    def setUp(self):
        self.polls = json.loads(load("replay.json"))
        self.svc = app.Service(Store(":memory:"))

    def test_totals_match_wapa_summary(self):
        now = replay(self.svc, self.polls[:8])
        s = self.svc.build_status(now)
        p = self.polls[7]
        self.assertEqual(s["feed"]["state"], "ok")
        self.assertEqual(s["totals"]["out"], p["summary"]["customersOutNow"])
        self.assertEqual(s["totals"]["records"], len(p["outages"]))
        self.assertEqual(s["districts"]["STTJ"]["out"] + s["districts"]["STX"]["out"],
                         sum(r["customersOutNow"] for r in p["outages"]))

    def test_feeder_outage_is_attributed_and_then_closed(self):
        mid = next(i for i, p in enumerate(self.polls)
                   if sum("Feeder" in (r["outageName"] or "") for r in p["outages"]) >= 2)
        now = replay(self.svc, self.polls[:mid + 1])
        s = self.svc.build_status(now)
        f = {x["id"]: x for x in s["feeders"]["STTJ"]}
        self.assertGreater(f["7A"]["out"], 1000)
        self.assertGreater(f["6A"]["out"], 1000)
        self.assertEqual(f["7B"]["out"], 0)
        self.assertEqual(s["districts"]["STTJ"]["feeders_out"], 2)
        self.assertEqual(f["7A"]["history"]["d7"]["count"], 1)
        # play to the end: WAPA cleared both records
        now = replay(self.svc, self.polls[mid + 1:])
        s = self.svc.build_status(now)
        f = {x["id"]: x for x in s["feeders"]["STTJ"]}
        self.assertEqual(f["7A"]["out"], 0)
        self.assertEqual(f["7A"]["active"], [])
        h = f["7A"]["history"]["d7"]
        self.assertEqual(h["count"], 1)
        self.assertTrue(1.0 < h["hours"] < 4.0, h)

    def test_stale_feed_never_closes_records_or_counts_as_zero(self):
        now = replay(self.svc, self.polls[:6])
        open_before = len(self.svc.store.open_records())
        day_before = self.svc.store.daily_since("2026-01-01")
        # WAPA answers hours later with the same old updateTime and no records
        later = now + timedelta(hours=3)
        self.svc.poll_once(later, (dict(self.polls[5]["summary"]), []))
        self.assertEqual(len(self.svc.store.open_records()), open_before)
        self.assertEqual(self.svc.store.daily_since("2026-01-01"), day_before)
        self.assertEqual(self.svc.build_status(later)["feed"]["state"], "stale")

    def test_fetch_failure_keeps_last_good_data(self):
        now = replay(self.svc, self.polls[:4])
        self.svc.base = "http://127.0.0.1:9/"  # nothing listens here
        self.assertFalse(self.svc.poll_once(now + timedelta(minutes=5)))
        s = self.svc.build_status(now + timedelta(minutes=5))
        self.assertIsNotNone(s["feed"]["error"])
        self.assertEqual(s["totals"]["out"], self.polls[3]["summary"]["customersOutNow"])

    def test_no_street_labels_leave_the_server(self):
        now = replay(self.svc, self.polls[:8])
        body = self.svc.status_bytes(now).decode()
        for p in self.polls[:8]:
            for r in p["outages"]:
                for label in r["streetsAffected"]:
                    if any(c.isdigit() for c in label):
                        self.assertNotIn(label, body)

    def test_reports(self):
        now = replay(self.svc, self.polls[:3])
        self.assertIsNone(self.svc.add_report({"district": "STTJ", "feeder": "7A", "status": "out", "device": "a" * 16}, now))
        self.assertIsNone(self.svc.add_report({"district": "STTJ", "feeder": "7A", "status": "out", "device": "b" * 16}, now))
        # same device again replaces its earlier report
        self.assertIsNone(self.svc.add_report({"district": "STTJ", "feeder": "7A", "status": "on", "device": "a" * 16}, now))
        self.assertIsNotNone(self.svc.add_report({"district": "STTJ", "feeder": "1A", "status": "out", "device": "c" * 16}, now))
        self.assertIsNotNone(self.svc.add_report({"district": "XX", "status": "out", "device": "c" * 16}, now))
        f = {x["id"]: x for x in self.svc.build_status(now)["feeders"]["STTJ"]}
        self.assertEqual(f["7A"]["reports"], {"out": 1, "on": 1})
        old = self.svc.build_status(now + timedelta(hours=2))
        self.assertEqual({x["id"]: x for x in old["feeders"]["STTJ"]}["7A"]["reports"], {"out": 0, "on": 0})


class Seed(unittest.TestCase):
    def test_seed_gives_history_and_estimates(self):
        st = Store(":memory:")
        self.assertGreater(app.import_seed(st), 7000)
        self.assertEqual(app.import_seed(st), 0)  # only once
        d = st.closed_durations()
        self.assertGreater(len(d[("STTJ", "feeder")]), 400)
        now = datetime(2026, 11, 7, 12, 0, tzinfo=UTC)
        rec = {"district": "STTJ", "level": "feeder", "start": "2026-11-07T11:00:00Z", "etr": None}
        e = estimate.estimate_for(rec, d, now)
        self.assertEqual(e["basis"], "history")
        self.assertLess(e["low"], e["mid"])
        self.assertLess(e["mid"], e["high"])
        h = estimate.feeder_history(st.feeder_records_since(now - timedelta(days=90)), now)
        self.assertGreater(h[("STTJ", "7A")]["d90"]["count"], 5)


class Estimates(unittest.TestCase):
    def test_remaining_conditions_on_elapsed(self):
        d = sorted([1.0] * 30 + [10.0] * 12)
        self.assertEqual(estimate.remaining(d, 0.5)["mid"], 0.5)
        self.assertEqual(estimate.remaining(d, 2.0)["mid"], 8.0)   # short ones no longer apply
        self.assertIsNone(estimate.remaining(d, 11.0))              # nothing lasted this long

    def test_wapa_time_then_rotation_then_history(self):
        now = datetime(2026, 11, 12, 15, 0, tzinfo=UTC)
        rec = {"district": "STTJ", "level": "feeder", "start": "2026-11-12T14:00:00Z", "etr": "2026-11-12T16:00:00Z"}
        self.assertEqual(estimate.estimate_for(rec, {}, now)["basis"], "wapa")
        rec["etr"] = None
        self.assertEqual(estimate.estimate_for(rec, {}, now, now + timedelta(hours=1))["basis"], "rotation")
        self.assertEqual(estimate.estimate_for(rec, {}, now)["basis"], "none")

    def test_union_hours_merges_overlap(self):
        t = lambda h: datetime(2026, 1, 1, tzinfo=UTC) + timedelta(hours=h)
        self.assertEqual(estimate.union_hours([(t(0), t(2)), (t(1), t(3)), (t(5), t(6))]), 4.0)


class Notices(unittest.TestCase):
    def test_rotation_schedule(self):
        s = notices.parse_rotation_text(load("rotation-2026-11-12.txt"))
        self.assertEqual(s["date"], "2026-11-12")
        self.assertEqual(s["district"], "STTJ")
        self.assertTrue(s["tentative"])
        slots = {(x["start"] // 60, x["end"] // 60): [f["feeder"] for f in x["feeders"]] for x in s["slots"]}
        self.assertEqual(sorted(slots[(8, 10)]), ["7B", "7E"])
        self.assertEqual(sorted(slots[(10, 12)]), ["10B", "6A", "7C"])
        self.assertEqual(sorted(slots[(18, 20)]), ["6B", "8A", "9C"])
        self.assertEqual(sorted(slots[(22, 24)]), ["10B", "7A", "8A"])
        self.assertEqual(len(s["slots"]), 8)
        partial = [f for x in s["slots"] for f in x["feeders"] if f["partial"]]
        self.assertEqual([f["feeder"] for f in partial], ["9C"])

    def test_rotation_end_adds_wapa_grace(self):
        s = [notices.parse_rotation_text(load("rotation-2026-11-12.txt"))]
        at = datetime(2026, 11, 12, 13, 0, tzinfo=UTC)  # 9:00 AST, inside 8-10 AM
        self.assertEqual(wapa.iso(notices.rotation_end_for(s, "STTJ", "7B", at)), "2026-11-12T14:15:00Z")
        self.assertIsNone(notices.rotation_end_for(s, "STTJ", "6A", at))
        self.assertIsNone(notices.rotation_end_for(s, "STX", "7B", at))
        self.assertIsNone(notices.rotation_end_for(s, "STTJ", "7B", at + timedelta(days=1)))

    def test_pages(self):
        adv = load("advisories.html")
        self.assertEqual(notices.parse_banner(adv), "No programmed service interruptions at this moment.")
        links = notices.parse_schedule_links(adv)
        self.assertEqual(len(links), 1)
        self.assertTrue(links[0].startswith("https://www.viwapa.vi/docs/default-source/outage-schedule/"))
        rel = notices.parse_releases(load("press-releases.html"))
        titles = [r["title"] for r in rel]
        self.assertIn("WAPA Advises of Continued Rotations as Unit Repairs Progress; Some Relief Expected by Monday", titles)
        self.assertNotIn("WAPA Announces November Business Office Closures", titles)
        self.assertTrue(all(r["url"].startswith("https://www.viwapa.vi/news-information/press-releases/press-release-details/") for r in rel))
        self.assertRegex(rel[0]["date"], r"^2026-\d\d-\d\d$")


if __name__ == "__main__":
    unittest.main()

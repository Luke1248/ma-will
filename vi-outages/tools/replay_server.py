"""Stand-in for WAPA's outage map, for development and demos.

Serves /data/outageSummary and /data/outages from tests/fixtures/replay.json
with every timestamp shifted so the chosen poll looks like it happened now.
Usage: python3 tools/replay_server.py [poll_index] [port]
Then:  WAPA_BASE=http://127.0.0.1:7575/data/ python3 server/app.py
"""
import json, os, re, sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
polls = json.load(open(os.path.join(HERE, "..", "tests", "fixtures", "replay.json"), encoding="utf-8"))
INDEX = int(sys.argv[1]) if len(sys.argv) > 1 else 6
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 7575
TS = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)")

def shifted(obj, delta):
    def fix(m):
        s = re.sub(r"(\.\d{6})\d+", r"\1", m.group(0)).replace("Z", "+00:00")
        return (datetime.fromisoformat(s) + delta).isoformat()
    return json.loads(TS.sub(fix, json.dumps(obj)))

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        p = polls[INDEX]
        fetched = datetime.fromisoformat(p["fetchedAt"].replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - fetched
        key = {"/data/outageSummary": "summary", "/data/outages": "outages"}.get(self.path)
        if not key:
            self.send_response(404); self.end_headers(); return
        body = json.dumps(shifted(p[key], delta)).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

if __name__ == "__main__":
    print("replaying poll %d on :%d" % (INDEX, PORT), flush=True)
    HTTPServer(("127.0.0.1", PORT), H).serve_forever()

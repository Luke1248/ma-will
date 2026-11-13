"""Build server/seed/ from VI Update's public-domain archive of WAPA's outage map.

Source: Louden, Brian. "What WAPA's outage map recorded, 23 March to 7 November
2026: the data behind the report", v1.0. https://doi.org/10.5281/zenodo.24094228
(CC0 1.0). WAPA is the original source of the records.

Usage: python3 tools/build_seed.py /path/to/wapa-outage-record-v1.0.zip
"""
import csv, gzip, io, os, sys, zipfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "server"))
from wapa import feeder_of, district_of, island_of, parse_time, iso

P = "wapa-outage-record-v1.0/"
OUT = os.path.join(os.path.dirname(__file__), "..", "server", "seed")

def rows(zf, name):
    return csv.DictReader(io.StringIO(zf.read(P + name).decode("utf-8", "replace")))

def main(path):
    zf = zipfile.ZipFile(path)
    os.makedirs(OUT, exist_ok=True)
    n = 0
    with gzip.open(os.path.join(OUT, "records.csv.gz"), "wt", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "feeder", "level", "district", "island", "lat", "lng", "start",
                    "first_seen", "last_seen", "max_out", "cause"])
        for r in rows(zf, "labeled/records.csv"):
            name = r["wapa_name"]
            lat = float(r["lat"]) if r["lat"] else None
            lng = float(r["lng"]) if r["lng"] else None
            feeder = feeder_of(name)
            district = r["district"] or district_of(name, lat, lng)
            w.writerow([r["record_id"], feeder or "", "feeder" if feeder else "local", district,
                        island_of(name, district, feeder, lng) or "",
                        "" if lat is None else round(lat, 3), "" if lng is None else round(lng, 3),
                        iso(parse_time(r["wapa_start_time"])) or "", r["first_seen_poll_utc"][:19] + "Z",
                        r["last_seen_poll_utc"][:19] + "Z", r["max_customers_out"], r["cause"]])
            n += 1
    d = 0
    with open(os.path.join(OUT, "daily.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "district", "customer_hours", "max_out", "covered_hours"])
        for r in rows(zf, "labeled/daily.csv"):
            w.writerow([r["date_ast"], r["district"], r["customer_hours"], r["max_out"], r["covered_hours"]])
            d += 1
    print("records", n, "daily rows", d)

if __name__ == "__main__":
    main(sys.argv[1])

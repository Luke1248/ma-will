# VI Power Watch

A free, installable web app (iOS and Android, via "Add to Home Screen") that shows
power outages in the U.S. Virgin Islands: customers out now, by district, island
and feeder; WAPA's rotation schedule and notices; a restoration estimate; anonymous
neighbour reports; and a running record of how often and how long each feeder is out.

Independent. Not affiliated with WAPA.

## Run it

```bash
python3 server/app.py            # http://localhost:8080, polls WAPA every 5 minutes
python3 -m unittest discover -s tests
```

No Python packages needed. `pdftotext` (poppler-utils) is optional: with it the
server reads WAPA's rotation schedule PDF, without it the app links to the PDF.

To see it with data when WAPA's map is unreachable:

```bash
python3 tools/replay_server.py 6 7575 &
WAPA_BASE=http://127.0.0.1:7575/data/ DB_PATH=/tmp/demo.db python3 server/app.py
```

Settings are environment variables, listed at the top of `server/app.py`.

## Deploy

One small always-on container with a persistent disk:

```bash
docker build -t vi-power-watch .
docker run -p 8080:8080 -v vipw-data:/data -e REPORT_SALT=<random string> vi-power-watch
```

Put it behind HTTPS (the host's own TLS, or Cloudflare). HTTPS is required for
"Add to Home Screen" to install it as an app. The host must be able to make
plain-HTTP requests to port 7575, where WAPA's map lives. The database must be on
a persistent disk or history is lost on every redeploy.

## Where each number comes from

| In the app | Source | Limits |
|---|---|---|
| Customers out, outage records | WAPA's outage map, `outageviewer.viwapa.vi:7575/data/` (`outageSummary`, `outages`), every 5 minutes | WAPA's own report, not a measurement. A "customer" is a meter. |
| District and island split | Record name prefix (`T-C-`, `T-T-`, `T-J-`, `Feeder`, `STX Feeder`), then latitude | St. Thomas, St. John and Water Island are one grid. |
| Per-feeder outages | Records whose name is `Feeder NN` or `STX Feeder NN` | About 1 record in 10. The rest are transformer-level and carry no feeder, so they are listed by estate under "Smaller outages". |
| Restoration estimate | 1. WAPA's `estimatedTimeOfRestoral` if present. 2. End of WAPA's rotation slot. 3. How long similar past outages lasted, given time already elapsed | WAPA never filled in a restoration time in 530,018 archived sightings, so in practice it is 2 or 3. |
| Rotation schedule, alert banner, news | `www.viwapa.vi` advisories page, schedule PDF, news releases | WAPA calls the schedule tentative. |
| Generation vs demand | `server/data/generation.json`, edited by hand | WAPA publishes no live capacity or load. Figures are dated and come from news coverage. |
| Feeder areas | `server/data/feeders.json`, transcribed from WAPA's feeder listings (June 2024) | Major locations only; some estates are split across feeders. |
| History before launch | `server/seed/`, built by `tools/build_seed.py` from VI Update's archive | 23 March to 7 November 2026. |
| Neighbour reports | `POST /api/report` | One per device, counted for 90 minutes. Not sent to WAPA. |

Rules the server follows:

- A poll whose WAPA `updateTime` is over 30 minutes old is stale. Stale and failed
  polls never close an outage and never count as zero customers out.
- WAPA renames records while they are open (a transformer-level record can become
  `Feeder 06A`). A record keeps a feeder name once it has had one.
- Street labels from WAPA can contain a person's name. They are never stored or
  served. Only the estate name is kept, and map points are rounded to about 100 m.

## Not verified

The server was tested by replaying archived WAPA responses, not against the live
map: the build environment could not reach port 7575. The endpoint paths
(`/data/outageSummary`, `/data/outages`) are taken from the archive's
documentation. Check the first live poll after deploying (`/api/status`, field
`feed`), and set `WAPA_BASE` if the paths differ.

## Credits

History and test fixtures: Louden, Brian. "What WAPA's outage map recorded,
23 March to 7 November 2026: the data behind the report", v1.0, VI Update.
https://doi.org/10.5281/zenodo.24094228 (CC0 1.0). WAPA is the original source
of the outage records.

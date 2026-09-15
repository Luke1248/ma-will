This project attempts to reduce the burdens that the creation of testamentary instruments often cause marginalized populations.
This project employs Python to create a will in accordance with the Massachusetts Law Libraries' template for a single person.

## Citation Rules

A reference and drafting aid for citations under *The Bluebook: A Uniform System
of Citation* (22d ed. 2025) and the Virgin Islands courts' own citation rules.

It is a self-contained static app in `citations/` — HTML, a JSON corpus, a
manifest, a service worker and icons, with no backend — so it is delivered two
ways from one source:

- **As an installable app on GitHub Pages**, at `/citations/`. Add it to your
  home screen from Safari and it runs full screen and works offline. The
  flashcards app stays at the Pages root, so its existing icon keeps working.
- **From the Flask dashboard** at `/citations/`, linked in the sidebar.

Every path inside the app is relative, which is what lets the same files work
under a repo subpath on Pages and at the server root under Flask.

- **Build** — fills in a correctly shaped full citation and short form for V.I.
  Supreme Court, Superior Court, District Court, Third Circuit, the Virgin
  Islands Code, the local court rules, and the 22nd edition's new source types
  (web-based sources, AI-generated content, Tribal Nations).
- **Check** — flags the citation mistakes that are detectable in plain text: a
  page pinpoint on a public domain citation, periods in the `VI` designator, a
  spelled-out court parenthetical, `V.I.C.A.`, a URL with no archived link, and
  others.
- **Rules** — searchable notes on what changed in the 22nd edition and on the
  Virgin Islands rules that sit on top of it.
- **Courts** — abbreviations and citation forms, with the court-renaming history
  that decides which parenthetical a given decision takes.

The rule corpus lives in `citations/data/citation_rules.json`. Every entry carries a
confidence badge (`verified`, `reported`, `unverified`) and links to its sources,
because none of it has been checked against a licensed copy of The Bluebook. It
is a drafting aid, not legal authority and not legal advice.

## Tests

```
pip install -r requirements.txt -r requirements-dev.txt
python -m playwright install chromium

python tests/check_citation_data.py   # fast, no browser
python tests/smoke_citations.py       # starts the app, drives headless Chromium
```

`check_citation_data.py` validates the structure of
`citations/data/citation_rules.json`: confidence levels, unique ids, required
keys, and that every `{token}` in a builder pattern resolves to a declared
field. A malformed corpus leaves `/citations` blank with only a console error
to show for it, so this runs first.

`smoke_citations.py` drives the app twice: once served by Flask at
`/citations/`, and once as a plain static directory under a repo-style subpath,
the way Pages publishes it. Each pass exercises the builder's rendering rules,
every checker rule, the rules browser, the courts table, and layout at 390px;
the static pass also checks that the manifest, service worker and icons all
resolve. That second pass is what catches an absolute path that works under
Flask and 404s on Pages. It fails on uncaught JavaScript errors and on failed
same-origin requests, but tolerates blocked CDN fonts and icons, which some
sandboxes refuse to fetch.

Both run on every pull request and on pushes to `main`
(`.github/workflows/smoke-test.yml`).

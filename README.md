This project attempts to reduce the burdens that the creation of testamentary instruments often cause marginalized populations.
This project employs Python to create a will in accordance with the Massachusetts Law Libraries' template for a single person.

---

## Bluebook Citation Accuracy Tester

An interactive app that drills citation accuracy under **The Bluebook: A Uniform
System of Citation (22nd ed.)**. It quizzes you on real cases and sources across
**every category of authority** the Bluebook covers, on a **1&ndash;5 difficulty
scale**.

### How it works

For each citation you decide whether it is correct. When you answer:

- The **incorrect portion** of a flawed citation is shown in **red** (struck
  through), and the **corrected Bluebook form** is displayed beneath it.
- A **properly formatted** citation is marked with a **✅** next to the cite.
- A short explanation cites the governing Bluebook rule (e.g., Rule 10.2.2, T13).

You can filter by source category and by difficulty, and a running scoreboard
tracks your accuracy.

### Source categories tested

| Category | Bluebook rule(s) |
| --- | --- |
| Cases | Rule 10 (incl. T1, T6, T10) |
| Constitutions | Rule 11 |
| Statutes (code & session laws) | Rule 12 |
| Legislative materials (bills, reports) | Rule 13 |
| Administrative & regulatory (C.F.R., Fed. Reg.) | Rule 14 |
| Books & treatises | Rule 15 |
| Periodicals / law reviews | Rule 16 (incl. T13) |
| Internet & electronic sources | Rule 18 |
| Court & litigation documents | Bluepages B17 (incl. BT1) |

Citations use real authorities — *Brown v. Board of Education*, *Marbury v.
Madison*, *N.Y. Times Co. v. Sullivan*, 42 U.S.C. § 1983, *The Right to Privacy*
(Warren & Brandeis), and more.

### Running it

The app is fully self-contained — you can simply open **`bluebook.html`** in any
browser. To serve it the same way as the rest of the project:

```bash
pip install -r requirements.txt
python bluebook_app.py
# then open http://localhost:5001
```

### Install on your phone (PWA)

The app in [`docs/`](docs/) is an installable **Progressive Web App** — add it to
your home screen and it runs full‑screen and offline, just like a native app.

**Hosting (one‑time):** in this repo, open **Settings → Pages → Build and
deployment → Source: "GitHub Actions."** The included workflow
(`.github/workflows/pages.yml`) then publishes `docs/` automatically. Your URL
will be:

```
https://luke1248.github.io/ma-will/
```

**On your iPhone:** open that URL in **Safari**, tap **Share**, then **Add to
Home Screen**. (On Android/Chrome, use the **Install app** prompt.)

### iOS app

A native **SwiftUI** version lives in [`ios/`](ios/) as a ready-to-open Xcode
project, grounded in the supplied text of the Bluebook's 22nd edition (50
citations across 13 categories, including the new Rule 22 Tribal Nations and
Rule 23 Archival Sources). See [`ios/README.md`](ios/README.md) to build and run
it. Open with:

```bash
open ios/BluebookCiteTester/BluebookCiteTester.xcodeproj
```

> **Note:** Educational tool. Citation forms reflect widely taught Bluebook
> conventions for the listed authorities. Always confirm against the current
> printed Bluebook for graded or filed work, as local court rules and editorial
> updates may govern.

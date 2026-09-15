#!/usr/bin/env python3
"""Browser smoke test for the citation app.

The app is a self-contained static app in citations/, delivered two ways, so
this drives it twice with headless Chromium:

  1. Served by the Flask dashboard at /citations/ (reached from the sidebar).
  2. Served as a plain static directory under a repo-style subpath, the way
     GitHub Pages publishes it at /<repo>/citations/.

The second pass is what catches an absolute path (/static/..., href="/") that
works under Flask and 404s on Pages.

Usage:  python tests/smoke_citations.py
Env:    CHROMIUM_PATH  explicit Chromium binary, when Playwright's own
                       download is not where it expects (as in some
                       sandboxes). Unset on CI, where `playwright install`
                       puts it in the default place.
"""

import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

failures = []
PHASE = ""


def check(label, condition, detail=""):
    label = ("[%s] %s" % (PHASE, label)) if PHASE else label
    print(("PASS  " if condition else "FAIL  ") + label
          + (("  -> " + str(detail)) if detail and not condition else ""))
    if not condition:
        failures.append(label)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def wait_for(url, proc, what):
    for _ in range(60):
        if proc.poll() is not None:
            raise RuntimeError("%s exited early:\n%s"
                               % (what, proc.stdout.read().decode("utf-8", "replace")))
        try:
            urllib.request.urlopen(url, timeout=1).read()
            return proc
        except (urllib.error.URLError, OSError):
            time.sleep(0.5)
    proc.kill()
    raise RuntimeError("%s did not come up on %s" % (what, url))


def start_static_server(port):
    """Serve a Pages-shaped tree: <root>/<repo>/citations/ ."""
    root = tempfile.mkdtemp(prefix="pages-")
    dest = os.path.join(root, "ma-will", "citations")
    shutil.copytree(os.path.join(REPO, "citations"), dest)
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    wait_for("http://127.0.0.1:%d/ma-will/citations/" % port, proc, "static server")
    return proc, root


def start_server(port):
    env = dict(os.environ, FLASK_RUN_PORT=str(port), PYTHONUNBUFFERED="1")
    proc = subprocess.Popen(
        [sys.executable, "-c",
         "import app; app.app.run(host='127.0.0.1', port=%d, debug=False, use_reloader=False)" % port],
        cwd=REPO, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    return wait_for("http://127.0.0.1:%d/" % port, proc, "flask server")


def enter_via_dashboard(page, base):
    """Flask delivery: the app is reached from the dashboard sidebar."""
    page.goto(base, wait_until="domcontentloaded")
    check("dashboard links to the citation app",
          page.locator('a.nav-item[href="/citations/"]').count() == 1)
    page.click('a.nav-item[href="/citations/"]')
    page.wait_for_load_state("domcontentloaded")
    check("that link navigates to /citations/", page.url.endswith("/citations/"), page.url)
    page.wait_for_selector("#tpl-select option", state="attached", timeout=15000)
    check("the back link is shown when the dashboard is there",
          page.locator("#back-link").is_visible())


def enter_standalone(page, base):
    """Pages delivery: opened directly, under a repo subpath."""
    page.goto(base, wait_until="domcontentloaded")
    page.wait_for_selector("#tpl-select option", state="attached", timeout=15000)
    check("the back link is hidden when there is no dashboard",
          not page.locator("#back-link").is_visible())

    # A manifest and worker that 404 mean the app cannot be installed.
    for asset in ("manifest.webmanifest", "sw.js", "icons/icon-192.png",
                  "icons/icon-512.png", "icons/maskable-512.png",
                  "icons/apple-touch-icon.png"):
        status = page.evaluate(
            "a => fetch(a).then(r => r.status).catch(() => 0)", asset)
        check("standalone serves %s" % asset, status == 200, status)

    name = page.evaluate(
        "() => fetch('manifest.webmanifest').then(r => r.json()).then(m => m.name)")
    check("the manifest names the app", name == "Citation Rules", name)


def run(page):
    # ---- corpus loaded ----
    check("disclaimer is shown", "drafting aid" in page.inner_text("#disclaimer"))
    options = page.locator("#tpl-select option").count()
    check("every template is offered", options >= 14, options)

    # ---- builder ----
    page.select_option("#tpl-select", "vi-sup-neutral")
    page.fill("#fld-case", "Smith v. Jones")
    page.fill("#fld-year", "2019")
    page.fill("#fld-seq", "22")
    page.fill("#fld-pin", "13-14")
    check("a paragraph range takes ¶¶ and an en dash",
          page.inner_text("#out-full") == "Smith v. Jones, 2019 VI 22, ¶¶ 13–14",
          repr(page.inner_text("#out-full")))
    check("the short form derives the first party",
          page.inner_text("#out-short").startswith("Smith,"), repr(page.inner_text("#out-short")))

    page.fill("#fld-pin", "13")
    check("a single paragraph takes one ¶",
          page.inner_text("#out-full") == "Smith v. Jones, 2019 VI 22, ¶ 13",
          repr(page.inner_text("#out-full")))

    page.check("#fld-unpub")
    check("the unpublished suffix attaches to the number",
          page.inner_text("#out-full") == "Smith v. Jones, 2019 VI 22U, ¶ 13",
          repr(page.inner_text("#out-full")))
    page.uncheck("#fld-unpub")

    page.fill("#fld-pin", "")
    check("an empty optional field drops its own separator",
          page.inner_text("#out-full") == "Smith v. Jones, 2019 VI 22",
          repr(page.inner_text("#out-full")))

    page.fill("#fld-seq", "")
    check("an empty required field renders a blank", "___" in page.inner_text("#out-full"))
    check("that blank is marked", page.locator("#out-full .blank").count() >= 1)

    page.select_option("#tpl-select", "vi-sup-reports")
    page.fill("#fld-case", "Banks v. Int'l Rental & Leasing Corp.")
    page.fill("#fld-vol", "55")
    page.fill("#fld-page", "967")
    page.fill("#fld-pin", "978")
    page.fill("#fld-year", "2011")
    check("V.I. Reports citation",
          page.inner_text("#out-full")
          == "Banks v. Int'l Rental & Leasing Corp., 55 V.I. 967, 978 (V.I. 2011)",
          repr(page.inner_text("#out-full")))
    check("the case name is italicized", page.locator("#out-full .it").count() >= 1)

    page.select_option("#tpl-select", "vi-code")
    page.fill("#fld-title", "4")
    page.fill("#fld-section", "244")
    check("V.I. Code long form",
          page.inner_text("#out-full") == "V.I. Code Ann. tit. 4, § 244",
          repr(page.inner_text("#out-full")))
    check("V.I. Code short form moves the title number",
          page.inner_text("#out-short") == "4 V.I.C. § 244",
          repr(page.inner_text("#out-short")))

    # No template should ever render a literal {token}.
    for tpl_id in page.eval_on_selector_all("#tpl-select option", "ns => ns.map(n => n.value)"):
        page.select_option("#tpl-select", tpl_id)
        rendered = page.inner_text("#out-full") + page.inner_text("#out-short")
        check("template %s resolves every token" % tpl_id, "{" not in rendered, repr(rendered))

    # ---- checker ----
    page.click('.tab[data-panel="check"]')

    # Every regex in the corpus must be constructible by the browser.
    bad = page.evaluate("""() => fetch('data/citation_rules.json')
        .then(r => r.json())
        .then(d => d.checks.filter(c => {
            if (!c.re) return false;
            try { new RegExp(c.re, c.flags || 'g'); return false; }
            catch (e) { return true; }
        }).map(c => c.id))""")
    check("every checker regex compiles in the browser", bad == [], bad)

    page.click("#load-example")
    page.wait_for_selector(".finding")
    msgs = page.eval_on_selector_all(".finding-msg", "ns => ns.map(n => n.textContent)")
    blob = " | ".join(msgs)
    expected = [
        ("a page pinpoint on a neutral cite", "paragraph, not by page"),
        ("periods in the VI designator", "no periods"),
        ("a spelled-out court parenthetical", "Abbreviate the court"),
        ("V.I.C.A.", "V.I.C.A."),
        ("a code cite missing its title", "names the title"),
        ("the V.I. Super. abbreviation", "V.I. Super. Ct."),
        ("Territorial Court naming", "renamed the Superior Court"),
        ("F.3d after 2021", "F.3d to F.4th"),
        ("a URL with no archive", "no archived link"),
        ("a last-visited parenthetical", "last visited"),
        ("a named AI tool", "save a PDF"),
    ]
    for label, needle in expected:
        check("flags " + label, any(needle in m for m in msgs), blob)

    rules = page.eval_on_selector_all(".finding .badge.b-rule", "ns => ns.map(n => n.textContent)")
    check("every finding cites a rule", rules and all(r.strip() for r in rules), rules)

    classes = page.eval_on_selector_all(".finding", "ns => ns.map(n => n.className)")
    check("findings are ordered errors first", classes == sorted(
        classes, key=lambda c: 0 if "error" in c else (1 if "warn" in c else 2)))

    page.fill("#check-input",
              "Banks v. Int'l Rental & Leasing Corp., 55 V.I. 967, 978 (V.I. 2011).")
    page.click("#run-check")
    check("a clean citation is not flagged", page.locator(".finding").count() == 0,
          page.eval_on_selector_all(".finding-msg", "ns => ns.map(n => n.textContent)"))
    check("a clean result still warns against complacency",
          "not the same as correct" in page.inner_text(".tally"))

    page.fill("#check-input",
              "Rules, Sup. Ct. V.I. (2019), https://example.gov/x [https://perma.cc/AB12-CD34].")
    page.click("#run-check")
    msgs = page.eval_on_selector_all(".finding-msg", "ns => ns.map(n => n.textContent)")
    check("an archived link silences the URL check",
          not any("no archived link" in m for m in msgs), msgs)

    page.fill("#check-input", "Smith v. Jones, 2019 VI 22, ¶ 13, 71 V.I. 500, 510.")
    page.click("#run-check")
    msgs = page.eval_on_selector_all(".finding-msg", "ns => ns.map(n => n.textContent)")
    check("the parallel citation note fires",
          any("both a public domain citation" in m for m in msgs), msgs)

    # ---- rules browser ----
    page.click('.tab[data-panel="rules"]')
    total = page.locator(".rule-card").count()
    check("rule cards render", total >= 20, total)
    page.fill("#rule-search", "perma")
    check("search narrows the list", 0 < page.locator(".rule-card").count() < total,
          page.locator(".rule-card").count())
    page.fill("#rule-search", "")
    page.click('#rule-filters .chip:has-text("Virgin Islands")')
    check("the category filter narrows the list",
          0 < page.locator(".rule-card").count() < total, page.locator(".rule-card").count())
    page.fill("#rule-search", "zzzzz")
    check("a no-match search says so", page.locator(".empty").count() == 1)

    # ---- courts ----
    page.click('.tab[data-panel="courts"]')
    rows = page.locator("#courts-table tbody tr").count()
    check("the courts table is populated", rows >= 6, rows)
    check("the confidence key is rendered", page.locator("#confidence-key .badge").count() == 3)

    # ---- narrow viewport ----
    page.set_viewport_size({"width": 390, "height": 780})
    page.click('.tab[data-panel="build"]')
    overflow = page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("no horizontal overflow at 390px", overflow <= 0, overflow)


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("FAIL  playwright is not installed: pip install playwright "
              "&& playwright install chromium")
        return 1

    global PHASE
    flask_port, static_port = free_port(), free_port()
    flask_base = "http://127.0.0.1:%d" % flask_port
    static_base = "http://127.0.0.1:%d/ma-will/citations/" % static_port

    server = start_server(flask_port)
    static_server, static_root = start_static_server(static_port)

    # Only same-origin failures matter. The page pulls its font and icon CSS
    # from public CDNs, which some sandboxes block; that is not a regression.
    page_errors = []
    origin_failures = []

    try:
        with sync_playwright() as pw:
            launch = {}
            if os.environ.get("CHROMIUM_PATH"):
                launch["executable_path"] = os.environ["CHROMIUM_PATH"]
            browser = pw.chromium.launch(**launch)
            try:
                for phase, base, enter in (
                    ("flask", flask_base, enter_via_dashboard),
                    ("pages", static_base, enter_standalone),
                ):
                    PHASE = phase
                    origin = base if phase == "flask" else static_base.split("/ma-will")[0]
                    # A fresh context per phase so neither delivery inherits the
                    # other's service worker, cache or storage.
                    context = browser.new_context(viewport={"width": 1100, "height": 900})
                    page = context.new_page()
                    page.on("pageerror", lambda e: page_errors.append(str(e)))
                    page.on("requestfailed",
                            lambda r, o=origin: origin_failures.append(r.url)
                            if r.url.startswith(o) else None)
                    try:
                        enter(page, base)
                        run(page)
                    finally:
                        context.close()
                PHASE = ""
            finally:
                browser.close()
    finally:
        for proc in (server, static_server):
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
        shutil.rmtree(static_root, ignore_errors=True)

    check("no uncaught JavaScript errors", not page_errors, page_errors)
    check("every same-origin request succeeded", not origin_failures, origin_failures)

    print()
    if failures:
        print("FAILURES (%d): %s" % (len(failures), ", ".join(failures)))
        return 1
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())

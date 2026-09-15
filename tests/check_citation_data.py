#!/usr/bin/env python3
"""Structural checks on the citation rule corpus.

Runs in well under a second and needs no browser, because the failure this
guards against is cheap to cause and expensive to notice: a malformed
citation_rules.json leaves the /citations page blank with only a console
error to show for it.

Usage: python tests/check_citation_data.py [path/to/citation_rules.json]
"""

import json
import os
import re
import sys

DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "static", "data", "citation_rules.json",
)

# Tokens the page resolves itself rather than reading off a field.
DERIVED_TOKENS = {"shortcase", "pinshort"}
SEVERITIES = {"error", "warn", "info"}

failures = []


def fail(message):
    failures.append(message)


def require(mapping, keys, where):
    for key in keys:
        if key not in mapping or mapping[key] in (None, "", [], {}):
            fail("%s: missing or empty %r" % (where, key))


def check_unique(ids, where):
    seen = set()
    for value in ids:
        if value in seen:
            fail("%s: duplicate id %r" % (where, value))
        seen.add(value)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DATA_PATH
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, ValueError) as err:
        print("FAIL  %s does not load: %s" % (path, err))
        return 1

    # ---- meta ----
    meta = data.get("meta", {})
    require(meta, ["title", "bluebook_edition", "vi_rules_note", "disclaimer"], "meta")
    levels = set(meta.get("confidence_key", {}))
    if levels != {"verified", "reported", "unverified"}:
        fail("meta.confidence_key: expected the three levels, got %s" % sorted(levels))

    for section in ("rules", "courts", "templates", "checks"):
        if not isinstance(data.get(section), list) or not data[section]:
            fail("%s: expected a non-empty list" % section)
    if failures:
        return report()

    # ---- rules ----
    check_unique([r.get("id") for r in data["rules"]], "rules")
    for rule in data["rules"]:
        where = "rule %r" % rule.get("id")
        require(rule, ["id", "cat", "title", "summary", "detail", "tags", "confidence", "refs"], where)
        if rule.get("confidence") not in levels:
            fail("%s: confidence %r is not one of %s" % (where, rule.get("confidence"), sorted(levels)))
        for ref in rule.get("refs", []):
            require(ref, ["label", "url"], where + " ref")
            if not str(ref.get("url", "")).startswith("http"):
                fail("%s: ref url is not a URL: %r" % (where, ref.get("url")))

    # ---- courts ----
    for court in data["courts"]:
        where = "court %r" % court.get("court")
        require(court, ["court", "abbrev", "example", "neutral", "notes", "confidence"], where)
        if court.get("confidence") not in levels:
            fail("%s: confidence %r is not one of %s" % (where, court.get("confidence"), sorted(levels)))

    # ---- templates ----
    check_unique([t.get("id") for t in data["templates"]], "templates")
    for tpl in data["templates"]:
        where = "template %r" % tpl.get("id")
        require(tpl, ["id", "cat", "name", "rule", "confidence", "fields", "full", "short"], where)
        if tpl.get("confidence") not in levels:
            fail("%s: confidence %r is not one of %s" % (where, tpl.get("confidence"), sorted(levels)))

        keys = []
        for field in tpl.get("fields", []):
            require(field, ["k", "label"], where + " field")
            keys.append(field.get("k"))
            if field.get("type") == "check" and not field.get("val"):
                fail("%s: checkbox field %r has no val to emit" % (where, field.get("k")))
        check_unique(keys, where + " fields")

        # Every token in a pattern must resolve, or the page renders "{foo}".
        known = set(keys) | DERIVED_TOKENS
        for which in ("full", "short"):
            for token in re.findall(r"\{(\w+)\}", tpl.get(which, "")):
                if token not in known:
                    fail("%s: %s pattern uses {%s}, which is neither a field nor derived"
                         % (where, which, token))
        if "pinshort" in re.findall(r"\{(\w+)\}", tpl.get("short", "")) and "pin" not in keys:
            fail("%s: short pattern uses {pinshort} but the template has no 'pin' field" % where)

        # A required field is the only thing that renders a visible blank.
        if not any(f.get("req") for f in tpl.get("fields", [])):
            fail("%s: no field is marked required" % where)

    # ---- checks ----
    check_unique([c.get("id") for c in data["checks"]], "checks")
    for chk in data["checks"]:
        where = "check %r" % chk.get("id")
        require(chk, ["id", "sev", "msg", "rule", "fix"], where)
        if chk.get("sev") not in SEVERITIES:
            fail("%s: sev %r is not one of %s" % (where, chk.get("sev"), sorted(SEVERITIES)))
        if not chk.get("re") and not chk.get("kind"):
            fail("%s: needs either a regex ('re') or a special 'kind'" % where)
        if chk.get("re"):
            # Python and JS disagree on some syntax, so this is a sanity check
            # only. The browser test compiles every pattern with new RegExp,
            # which is the authoritative one.
            try:
                re.compile(chk["re"])
            except re.error as err:
                fail("%s: regex does not compile in Python (%s) — confirm it is "
                     "deliberate JS-only syntax" % (where, err))

    return report(data)


def report(data=None):
    if failures:
        for message in failures:
            print("FAIL  %s" % message)
        print("\n%d problem(s) in citation_rules.json" % len(failures))
        return 1
    print("PASS  citation_rules.json is well formed "
          "(%d rules, %d courts, %d templates, %d checks)"
          % (len(data["rules"]), len(data["courts"]),
             len(data["templates"]), len(data["checks"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())

# Deploying `attorney-schema.jsonld`

## Why this matters to the directory work

The `founder.sameAs` array is the load-bearing part. It tells Google that the
person on your site, the person on Avvo, and the person on Justia are one
entity. Without it, your directory profiles and your site compete as strangers;
with it, they reinforce each other. Fill those URLs in as soon as you have them
— that is the one field to come back and update after claiming each profile.

## How to deploy

Paste the completed JSON inside a script tag in the `<head>` of your site's
homepage and attorney bio page:

```html
<script type="application/ld+json">
  ... contents of attorney-schema.jsonld ...
</script>
```

## Before you ship

1. Replace **every** `{{PLACEHOLDER}}`. Unreplaced placeholders are worse than
   omitting the property — delete any property you cannot fill truthfully.
2. Remove properties that do not apply. An empty or invented `priceRange`,
   `geo`, or `knowsLanguage` is noise. `sameAs` should not list a Super Lawyers
   URL unless you have actually been selected.
3. The `address` and `telephone` must match `citation-tracker.csv` **exactly** —
   same abbreviations, same formatting. That is the whole point of the canonical
   record.
4. Validate at https://validator.schema.org/ and check Google Search Console's
   rich results report after deploy.

## A caution

Structured data describes your site to search engines; it does not make claims
to the public. But the same accuracy standard applies — an inflated
`hasCredential` or a fabricated `sameAs` is a misrepresentation whether a human
reads it or not.

## Not applicable to this repository

This file is a deliverable for your practice's website. The Flask app in this
repository is a will-generation tool, not a firm site, so do not paste this
schema into `templates/index.html`.

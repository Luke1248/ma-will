# Ready-to-Paste Profile Content

I cannot create these profiles — Avvo and Justia require an authenticated
account and bar-license verification tied to you personally. What follows turns
it into roughly 30 minutes of copy-paste.

---

## The six facts I need to finish this

Every `{{SLOT}}` below is one of these. Reply with them and I will return a
version with nothing left to fill:

1. **Employer / firm name** (or "solo practitioner")
2. **Office address and phone** — the ones you want public
3. **Law school and graduation year**
4. **Year admitted in Massachusetts**, plus any other bars/courts (D. Mass.,
   First Circuit, SJC, other states)
5. **Bar associations / sections** you belong to
6. **Social media class actions — plaintiff or defense side?**

I will not guess at any of these. An invented admission year or credential is a
Rule 7.1 problem, not a typo.

---

## Step 1 — Avvo

**Entry point:** avvo.com → footer → **"For Lawyers"** →
https://www.avvo.com/for-lawyers/avvo-profile

Search your name first to confirm nothing exists (it does not, as of September
2026). Then create a new profile. **Have your Massachusetts bar license
information on hand** — Avvo verifies against it. Claiming via LinkedIn is
reportedly the fastest verification route if you have a LinkedIn profile.

### Fields, in order

| Field | Value |
| --- | --- |
| Full name | {{FULL_LEGAL_NAME}} |
| Bar number | {{BBO_NUMBER}} (Massachusetts) |
| City | {{CITY}}, MA |
| Practice areas | **Appeals 50% / Professional Ethics (or Legal Malpractice) 30% / Antitrust & Trade Law 20%** |
| Headline | see below |
| Bio | see below |
| Photo | professional headshot — same image as Justia and LinkedIn |

Avvo surfaces you only in categories you select, so resist adding more. Five
areas at 20% each ranks in none of them.

## Step 2 — Justia

**Entry point:** https://lawyers.justia.com/lawyer-directory-listings → request
a free profile. Allow a few business days; verification is by email, text,
phone, or photo, and email/text are near-instant.

**Worth knowing:** a Justia profile also appears in the **LII (Cornell) Lawyer
Directory**. One form, two listings, both free.

### Justia-specific fields

| Field | Value |
| --- | --- |
| Practice areas | **Appeals & Appellate** (select the *Federal Appeals* sub-service), **Professional Ethics**, **Antitrust Law** |
| Jurisdictions admitted | Massachusetts ({{YEAR}}); {{OTHER COURTS}} |
| Education | {{LAW_SCHOOL}}, J.D. {{YEAR}} |
| Professional associations | {{BAR_ASSOCIATIONS}} |
| Websites / blog | {{URL}} — include the GitHub project, see below |
| Languages | {{IF APPLICABLE}} |

Justia's template is more structured than Avvo's, so completeness shows up
directly in how the page renders and indexes. Fill every field you truthfully can.

---

## Headline

Use the same one on both platforms. Pick one:

```
Appellate and Antitrust Litigator | {{CITY}}, Massachusetts
```
```
{{CITY}} Appellate Litigator — Antitrust, Complex Commercial, Legal Ethics
```
```
Appellate & Antitrust Attorney | AI and Professional Responsibility | {{CITY}}
```

The third is the differentiated one — few attorneys in any market claim that
intersection, and it is the niche with actual search demand.

---

## Biography

Paste as-is once the slots are filled. Third person, which is the directory
convention.

```
{{FULL_LEGAL_NAME}} is a {{CITY}} attorney whose practice centers on appellate
litigation and antitrust, with related work in cross-border sovereign debt
disputes and in the professional-responsibility questions raised by artificial
intelligence in legal practice.

Admitted to the Massachusetts bar in {{YEAR_ADMITTED}} (BBO #{{BBO_NUMBER}}),
{{LAST_NAME}}
{{ROLE — e.g. "is an associate at" / "practices at" / "is a solo practitioner
in"}} {{FIRM_NAME}}, where he {{ROLE VERB — "handles" / "works on teams
handling" / "second-chairs"}} {{MATTER DESCRIPTION}}. He is a graduate of
{{LAW_SCHOOL}} and is admitted to practice in {{JURISDICTIONS}}.

[CLASS ACTION SENTENCE — pick one:]
  [Defense] His class action work concerns litigation arising from social media
  platform practices, including {{privacy, consumer protection, or platform
  liability}} claims.
  [Plaintiff] He represents claimants in class litigation arising from social
  media platform practices, including {{privacy / consumer protection /
  platform liability}} claims.

{{LAST_NAME}} also develops open-source legal technology, including a tool that
generates Massachusetts wills from the Massachusetts Law Libraries' template
for single individuals, intended to reduce the barriers that testamentary
drafting imposes on people who cannot readily access counsel. That work informs
his interest in how automation and AI tools intersect with lawyers' duties of
competence, supervision, and candor to tribunals.

{{BAR_ASSOCIATIONS_SENTENCE — e.g. "He is a member of the {{LOCAL}} Bar
Association's Antitrust and Appellate Practice sections."}}

Contact: {{PHONE}} | {{EMAIL}}
```

### Why the open-source paragraph is in there

It is true, it is verifiable, and it does three things at once: it
differentiates you from every other appellate litigator in your market, it
demonstrates access-to-justice commitment without claiming it, and it gives you
earned standing in the AI-and-professional-ethics niche. A lawyer who has
actually built automated legal document tooling has something to say about AI
competence duties that a commentator does not.

Cut it if you would rather not associate the project with your practice — but
it is the strongest non-credential asset you have here.

---

## Practice area descriptions

Most attorneys leave these blank. Filling them is free ranking surface.

**Appeals & Appellate**
```
Appellate practice in {{state and federal courts — e.g. the Massachusetts
Appeals Court, the Supreme Judicial Court, and the United States Court of
Appeals for the First Circuit}}, including {{brief writing, oral argument,
post-trial motions, amicus work}}. {{Accepts referrals from trial counsel
seeking appellate support — include only if true}}.
```

**Antitrust**
```
{{Civil antitrust litigation, including Sherman Act and Clayton Act claims —
adjust to match your actual work}}. Experience with {{conduct type —
e.g. monopolization, price-fixing, distribution and dealer termination
disputes}}.
```

**Professional Ethics**
```
Advises on professional responsibility questions, with particular attention to
the duties implicated by generative AI and automated tools in legal practice —
competence under Rule 1.1, supervision under Rules 5.1 and 5.3, and candor to
tribunals under Rule 3.3. {{Adjust to your actual engagements.}}
```

Sovereign debt and social media class action work stays in the bio free text.
Neither platform has a category for it, and forcing it into an ill-fitting
category dilutes the three that do rank.

---

## Before you paste — compliance pass

Run every line against this. Full version in `profile-copy-templates.md`.

- [ ] No *specialist*, *expert*, *certified*, *best*, *top*, *leading*
- [ ] Every credential, date, and admission verified — especially the
      admission year, which I could not confirm
- [ ] Your **role** is described, not just the matter type. This is the Rule 7.1
      omission-clause risk in a practice mix like yours: "sovereign debt
      litigation" reads differently from lead counsel than from a team member
- [ ] Name and office address present (Rule 7.2)
- [ ] Same headshot on Avvo, Justia, and LinkedIn — it is an entity signal

## After both are live

Add the two profile URLs to `citation-tracker.csv` and to the `sameAs` array in
`attorney-schema.jsonld`. That array is what tells Google the person on your
site, on Avvo, and on Justia is one entity. Without it the profiles compete with
your own site instead of reinforcing it.

Then stop. Per `channel-strategy.md`, this is a bounded defensive task, not a
program — the recurring effort belongs in scholarship, bar sections, CLE
speaking, and Chambers/Legal 500 submissions.

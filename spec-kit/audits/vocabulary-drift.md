# AI Audit: vocabulary drift

This is an official AI Audit of the company. It runs every week. The rule it enforces is
`0019-controlled-vocabulary` FR-010: do not invent a term when an existing term will work.

## What it covers

Every class, property, concept scheme and concept in every ontology of:

- `intellectual-frontiers/.github` (`ontology/`, including the platform vocabularies and the Opsfolio platform);
- `intellectual-frontiers/eidolon` (`ontology/`, including `physia.ttl`, `compliance.ttl`, `domains.ttl`, `elenchus.ttl`, `publishing.ttl`, `imprint.ttl`, `ifpriv.ttl`, `works.ttl`).

A work's generated concepts (`*.concepts.ttl`) are not part of this audit; `eid check terms` covers them.

## Procedure

1. Check out both repositories on their default branches.
2. Run the scan: `python3 -I tools/agora/vocabulary_scan.py --root .github=<path> --root eidolon=<path> --json`.
   It lists each term as `reused` (tied to an established term), `excepted` (a `Decision` names it) or `unmapped`.
   Unmapped means "not yet shown to be reused". It does not mean "invented".
3. Compare with the previous report in `spec-kit/audits/vocabulary-drift/`. New unmapped terms come first.
4. Judge each unmapped class, property and scheme, and each concept whose label looks like a coined phrase.
   Look for the established term in PROV-O, schema.org, SKOS, Dublin Core, ODRL, the W3C Organization Ontology,
   NIST, ISO, the AICPA Trust Services Criteria, and the ordinary words of the field. Search the web and cite the source and its URL.
   Do not decide from memory. If you could not verify, say so.
5. Give each term one verdict:
   - **keep, map**: the term is the established concept under a local name. Propose the `rdfs:subClassOf`, `rdfs:subPropertyOf` or `skos:*Match` line.
   - **replace**: an established term works. Name it, and list what would change.
   - **exception**: the term is the company's own research and differs in meaning from any standard term. A `Decision` must name it
     (`dcterms:subject`, with `ifcore:consideredAlternative` for each standard term considered). A name chosen for brand, brevity or
     distinctiveness is never a reason. A word borrowed from another language is not original for that reason.
   - **not verified**: say what was tried.
6. Check each existing exception: its Decision still lists the alternatives, and a standard term has not appeared since.
   A Decision that names many terms as kept (`PlainWordClassesKept`, `PlainWordPropertiesKept`, `PlainWordSchemesKept`, `VaultPlainWordPropertiesKept`,
   `PublishedStandardSchemesKept`) stands for a judgement of the whole group. Re-judge at least ten terms of each such Decision per run, chosen
   at random, by searching for an established term, and list them under "Exceptions to re-check". A term that now has an established
   equivalent moves to "Candidates to replace" or "Candidates to map".
   The scan counts a term as excepted only when a Decision names it. A new term under an excepted parent is a new, unmapped term.
7. Write the report to `spec-kit/audits/vocabulary-drift/<YYYY-MM-DD>.md` in `intellectual-frontiers/.github`
   (sections: Summary, New since the last report, Candidates to replace, Candidates to map, Exceptions needing a Decision,
   Exceptions to re-check, Not verified). Commit it to the session's branch.
8. Email a short summary and the report's location to shahid.shah@intellectualfrontiers.com.

## Limits

- Flag only. Do not rename, remove or edit any ontology term, spec or Decision (`0019` FR-008). A person decides each candidate.
- Write plain, literal English. Name the thing; do not decorate it.
- No government information, no sensitive fact and no credential appears in a report or an email.

# Kanon

Kanon is the pattern for a library that states a rule once and carries it into several implementations. **Governance** states what a thing is and what it may do. The **Logical** layer derives the model the program reasons with. The **Physical** layer uses that model to produce a table, command, route, or other output. Trace edges record where each projection came from. [Read the Kanon specification](../../spec-kit/specs/0033-kanon/spec.md).

## A rule through three layers

Headless declares an action and its audience in Governance. It derives a verb in the Logical command model. Physical surfaces project that verb into a CLI command, tool, or REST route where the audience can use it. Its projection tests compare the model with the tool registry and OpenAPI document. Data uses the pattern to produce dialect-specific schemas from a model. Archon uses it for requirements, plans, and tool dialects.

Adopt Kanon where multiple projections or extension boundaries make those rules worth checking. The library declares its units and allowed imports in the `kanon` field of `library.ts`. Models and Programs show the layers and their projections from the libraries’ own values.

## What runs

From an adopting library in the Commons checkout, run `bun ../kanon/src/check.ts` for the import check or `bun run verify` for the library’s verification. The import checker reads TypeScript syntax and reports the rule, file, and line. A computed import with no literal target remains unresolved. Model checks are separate. Run `bun commons/kanon/src/check.ts --bundle DIR` from the Commons root to verify a bundle and check its model. The model checks inspect the data a producer hands them, including vocabulary, trace links, and how it accounts for annotations. Consumer tests check the real output.

See [the Kanon library](../../kanon/) for the model and checker API, and [Quality System build findings](site:quality/build-findings.html#kanon) for recorded CI results.

## Content and renditions

In the draft content method, a dated claim and its source belong to Governance. The collector projects them into a typed model. An HTML page and its Markdown twin can each show the citation, carry it as data, or record why it is omitted. The matrix exposes an unaccounted annotation by rendition. A test against the rendered page can catch a missing citation even when the model says one is present.

The [Content library](../../content/) collects parsed chapter blocks and checks evidence observed in each rendition. The Erga website has exercised an HTML and Markdown fixture. The production website rollout is draft work. [Read the content method](../../spec-kit/specs/0039-content-method/spec.md).

For a synthetic claim with one evidence link, the checked output can look like this:

| Claim annotation | HTML | Markdown |
| --- | --- | --- |
| Evidence | Expressed as a citation | Dropped after removing the citation |
| Date | Expressed on the page | Expressed in the twin |
| Audit status | Expressed as not audited | Expressed as not audited |

# Decisions taken

What was decided, so that it is not decided again by accident.

| # | Decision |
| --- | --- |
| 1 | Code name **Mizan**, explained as the **IF Spec Profile**, built on GitHub Spec Kit. Adopt Spec Kit as method; not as conformance standard. |
| 2 | Specifications in natural language; ontology, code, tools and tests in TypeScript 7+; Bun default, Node 26 backup. |
| 3 | Integrations, extensions and plugins are TypeScript 7 when possible; where it cannot do the job and a hand-written parser is not good enough, the best stack for the job is chosen and used, recorded as a typed `Exception`. |
| 4 | Rung 8 (lifecycle: retired, then archived) is an optional rung. |
| 5 | One status vocabulary: Draft, Active, Deferred, Superseded. |
| 6 | New rules (EARS, Gherkin, standards) are warn-only with a shrink-only baseline. |
| 7 | Precedence: law, then US and NIST standards, then ISO standards, then broadly used vocabularies, then state and local standards where they do not conflict. State and local law is law and applies where it applies. |
| 8 | First regulated domains: federal security (NIST, FedRAMP), FDA's QMSR (21 CFR Part 820) and 21 CFR Part 11. Others as products need them, pulled up into commons when more than one harness reads the same facts. |
| 9 | Proof register maps to OSCAL where possible, stays as-is where not. |
| 10 | A term no standard backs is `unaligned`; it needs a justification and a typed `Decision` (not necessarily before the term), with a 90-day grace period. |
| 11 | A typed `Decision` individual lives in the shared ontology; harnesses may link it to their own records. |
| 12 | All Mizan TypeScript lives in `commons/mizan/src/`, integrations in `commons/mizan/src/integrations/` (`0019-mizan-integrations`); natural-language specifications stay in `commons/spec-kit/`. |
| 13 | Imports only when necessary; exports to well-known forms; upstream contributions are prepared as bundles and never published without a person. |
| 14 | Non-TypeScript tools state the platforms they support; their tests run only there. |
| 15 | Trace and layers stay in the kernel as pure functions; `commons/mizan/src/` imports them. |
| 16 | The `unaligned` terms of Mizan stay `unaligned`, each due within 90 days; schema.org is fetched by pinned hash and not vendored. |
| 17 | The ladder has eleven rungs: 0 to 7 required, 8 lifecycle (optional), 9 Evidence (observer) and 10 Workspace (environment), with `mz:RungKind` (required, optional, observer, environment). |
| 18 | IFCCM: the unit of change is a capability; every commit names its issue on a line of its own; enforcement is a warning until a harness declares its production day, then a gate. "CCM" is never used alone. |
| 19 | IFQS is based on Operational Truth: one canonical OpenTelemetry record per run, an append-only signed `quality` branch, evidence grades E0 to E5, a stale proof opens a nonconformance, and a CAPA closes only on a named test and a named person. |
| 22 | Templates are typed TypeScript functions, not a template language. chezmoi is credited as inspiration for ideas; no code or program of it is used or required. |
| 23 | Tools are pinned by version and SHA-256, never `latest`; `git`, `bun` and `node` are verified, never installed; a tool or module outside the catalog is informational for 90 days, then a warning. Plaintext tokens fail from day one. |
| 24 | GitHub and plain Git first, GitLab shaped with them behind one interface; a token is read only from the environment, never stored or logged. |
| 25 | Signed commits are required where a harness declares a regulated domain, and warned elsewhere. |
| 26 | The ontologies are published as generated files (Turtle, RDF/XML, OWL, SHACL, JSON Schema, SKOS, SQL, SSSOM, HTML) and are read by independent tools (rdflib, pySHACL, ROBOT); none of the generated files is edited by hand. |
| 27 | No document, page or specification of ours claims compliance with a regulation or standard; they state evidence and what was proved. |

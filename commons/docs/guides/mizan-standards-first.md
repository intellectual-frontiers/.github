# Standards first

We do not invent terms, schemas or ontologies where a well-known consensus, international or national standard exists. Most of our work is regulated by US law, so US federal, state and local law and standards get special consideration. A custom invention is treated as drift.

## The order of precedence

1. **Law.** US federal law and regulation, and state or local law where it applies. The law's definition is authoritative.
2. **US and NIST standards.** NIST publications, OSCAL, FedRAMP, CISA and NTIA SBOM guidance, NIEM, ONC's USCDI.
3. **ISO standards.** Cited by identifier and clause. ISO text is not redistributable, so we do not copy it.
4. **Broadly used vocabularies.** schema.org, Dublin Core, SKOS, PROV-O, SPDX, DPV and their like.
5. **State and local standards that are not law**, where they do not conflict with the sources above.

Only after all of these is a term our own.

## The basis of every term **Built**

Every class, property, individual and code list carries a basis. A term with none does not compile.

| Basis | Meaning | Example |
| --- | --- | --- |
| `adopts` | It is the standard's own term, by its IRI. | `dcterms:title` |
| `specializes` | A subclass or subproperty of a standard term. | `pm:PackageManager` is a `schema:SoftwareApplication` |
| `maps` | It has a mapping, such as `skos:exactMatch`, to a standard term, published as SSSOM. | `pm:sha256` to an SPDX hash value (candidate) |
| `unaligned` | No standard names it. | The ladder's `Rung` |

```ts
// Illustrative sketch: the specification states the requirement, not this exact code.
type Basis =
  | { readonly kind: "adopts";      readonly standard: StandardRef }
  | { readonly kind: "specializes"; readonly of: Iri; readonly standard: StandardRef }
  | { readonly kind: "maps";        readonly to: Iri; readonly relation: "exactMatch" | "closeMatch" }
  | { readonly kind: "unaligned";   readonly justification: Justification; readonly decision?: DecisionRef };

function countsAsDrift(b: Basis): boolean {
  switch (b.kind) {
    case "adopts": case "specializes": case "maps": return false;
    case "unaligned": return true;
    default: return absurd(b); // the compiler refuses a basis we forgot to handle
  }
}
```

## Unaligned is allowed, never hidden

- An `unaligned` term carries a **justification**: the standards looked at and why none fits.
- It needs a **Decision**, a typed individual of the shared ontology that a harness may link to its own decision record. The Decision does not have to come first, but it must exist within **90 days** of the commit that adds the term, a grace period that leaves room to experiment. Within the 90 days, its absence is a finding in the baseline; after it, the check fails.
- The count of `unaligned` terms is the measure of drift. It is reported, and the baseline only shrinks.

## The law's words

- A term taken from law keeps the law's wording as its label, carries the law's definition as `skos:definition` and cites the law. It is not paraphrased, because a paraphrase can change the legal meaning.
- Where laws differ by jurisdiction, each is its own jurisdiction-qualified individual, never one merged invented concept.
- A requirement that comes from law cites its **authority** as typed data: title, part and section (for example 21 CFR Part 11, or 45 CFR 164.312).

## Standards as data

Each standard is a typed `Standard`: issuer, name, version, location, license (an SPDX identifier) and the SHA-256 of what was imported. A newer upstream version than the pin is a finding, so drift against the world (drift C) shows up as a check result. We copy only what a license permits.

## The first domains

- **Federal security.** NIST publications and OSCAL, FedRAMP baselines and Key Security Indicators. Only the controls we cite are imported.
- **FDA QMSR, 21 CFR Part 820.** Effective **2 February 2026**; it incorporates ISO 13485:2016 by reference. Verified from the [FDA](https://www.fda.gov/medical-devices/postmarket-requirements-devices/quality-system-qs-regulationmedical-device-good-manufacturing-practices) and the [Federal Register](https://www.federalregister.gov/documents/2024/02/02/2024-01709/medical-devices-quality-system-regulation-amendments). ISO 13485 is cited, not copied.
- **21 CFR Part 11.** Electronic records and electronic signatures. The text is law; authority records cite its paragraphs.

Other domains are added as products need them, and are **pulled up** into commons when more than one harness should read the same facts.

## Mizan follows its own rule

Requirements: RFC 2119 and EARS. Scenarios: Gherkin. Mappings: SSSOM. Provenance: PROV-O. Catalogs: DCAT. Licenses: SPDX identifiers. Controls: OSCAL. The format of a standard is chosen before ours is.

**Spec: Draft** `0018-standards-first`. **Built** the checks, as warnings held by a baseline that only shrinks (a term that awaits a Decision is held until its 90 days are past). The first audit is [`commons/spec-kit/audits/2026-11-standards-audit.md`](../../../commons/spec-kit/audits/2026-11-standards-audit.md).

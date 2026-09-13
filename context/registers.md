# Intellectual Frontiers — Registers

> **Status: canonical for what a register means; not canonical for live
> counts.** This file defines what each register is and the rule for citing
> it. It intentionally does not restate patent, trademark, or portfolio
> counts, because those are generated from USPTO and other primary sources by
> `intellectualfrontiers.com`'s own sync pipeline
> (`scripts/fetch-uspto.ts`, `scripts/trademark-sync.ts`, and related scripts
> in the Lovable-managed repo). Copying a count here would create a second
> number that can drift from the one the primary source supports — exactly
> what the claims standard in [`company.md`](company.md) rules out.
>
> For current counts and the records themselves, use the live registers or
> `https://www.intellectualfrontiers.com/llms.txt`, which is regenerated with
> the site.

## What each register is

| Register | What it contains | Path |
| --- | --- | --- |
| Patents | Invention families sourced directly from the USPTO. | `/patents` |
| Patent summaries | Plain-language summaries of selected patent families. | `/patent-summaries` |
| Trademarks | Federal and common-law marks. | `/trademarks` |
| Defensive disclosures | Published records that keep a method usable by disclosing it rather than filing on it — see the constitution's IP charter. | `/defensive-disclosures` |
| Research pillars | Standing lines of inquiry, each with the question it asks and what it has established so far. | `/research` |
| Research notes | Dated findings, each typed as a design pattern or an operating theory so a reader knows what kind of claim it makes. | `/research-notes` |
| Research papers | Peer-reviewed papers, each carrying a DOI, held as records in their own right rather than marketing. | `/research-papers` |
| Portfolio | The register of substantial works: patents, papers, ventures, publications, and software the firm has produced or owns. | `/portfolio` |
| Topics | Cross-cutting index across the other registers. | `/topics` |
| Writing | Founder and firm essays and posts. | `/blogs` |

## Rule for citing a register

- Link to the live register or to `llms.txt` rather than restating a count.
- If a specific number must appear in a document (a pitch deck, a one-pager),
  date-stamp it and name the register it came from, so a stale copy is
  identifiable as stale rather than presented as current.
- A generated register is only as good as the primary source behind it. The
  IP register's rule applies to all of them: we never imply a registration or
  ownership position that the underlying record does not support.

## What "sourced from the USPTO" means for the IP register specifically

The patent register is generated from the USPTO rather than typed by hand,
so the counts on the live site follow the filings instead of drifting away
from them. The research chain behind it: a research area groups the work; a
research pillar is a standing line of inquiry under that area; papers and
notes are where findings get recorded; patents, defensive disclosures, and
trademarks are what get filed or published afterward; licenses are what a
counterparty can take.

Categories currently tracked (grouping, not an exhaustive taxonomy):

| Group | Covers |
| --- | --- |
| Marketplaces and payments | Computer-controlled marketplace networks, digital payments, and related continuations |
| Evidence and decisions | Traceable metric queues, task scheduling, service-delivery evidence, initiative tracking, document review, case response, decision lifecycles, and risk systems |
| Healthcare delivery | Medical-device control, patient navigation, longitudinal profiles, team-based tele-diagnostics, smart referrals, and digital-native trials |
| Trusted data and authorization | Self-controlled digital authorization, device-driven blockchain integrity, blockchain natural-language processing, and multi-source data integration |
| Learning and content | Precision education and training, rating aggregation, and rewardable content delivery |

**A patent can reveal good problem framing. It still needs clean title,
useful scope, freedom to operate, implementation, customers, and terms
somebody can finance. Research earns the filing. The filing still has to
earn the commitment.**

Commercial questions asked of every right: what problem does the right solve
now? Who has authority and budget to care? What do we own, use, or still need
to verify? Can we make it more valuable? Should we build, license, sell,
partner, publish, maintain, narrow, or abandon it?

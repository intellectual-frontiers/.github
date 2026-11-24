# IFQS: the quality system

**Intellectual Frontiers Quality System** (`0021-ifqs`, `0022-trust`, `ifqs:`) is based on *Operational Truth*: what is true of a system is what the system reports when it runs, kept as evidence anyone can check, with the grade of that evidence shown, and with a failure opened as a nonconformance by the system itself. A person's statement is recorded, and graded below a run. **Tiers 0 and 1 built** **Tier 2 in progress**

## Tier 0: evidence exists **Built** (M3)

- **One canonical record per run.** An OpenTelemetry log record per case (OTLP/JSON, the OpenTelemetry test attributes, a CTRF-shaped body), extending the test record of `0008-test-evidence`. Outcomes are pass, fail, skip, todo, cancelled and `not_run`, which carries its reason and is never counted as passed.
- **Immutable files, chained.** `quality/evidence/YYYY/MM/DD/<run>.json`, one file per run, never edited (a writer refuses to overwrite). Each file names the hash of the one before it (`ifc.quality.previous.sha256`), so a verifier finds the first record that does not match.
- **An append-only `quality` branch** (an orphan branch written with real Git), signed through Git's own signing where configured, with a note on the tested commit under `refs/notes/quality`.
- **Renderings, on demand:** JUnit XML, CTRF, SARIF, TAP and the documents of ISO/IEC/IEEE 29119-3. The command `commons/quality/src/quality.ts` has `record`, `verify` and `render`; `ifc test` is unchanged.

## The evidence grade

| Grade | Meaning |
| --- | --- |
| **E0** none | No record of any kind. |
| **E1** stated | A person or an agent says it is met; nothing ran. |
| **E2** reviewed | A review is recorded, by a person or by an agent (said to be an agent's). |
| **E3** tested | An automated run proved it and its record exists. |
| **E4** attested | The run is kept on the quality branch, chained, signed and linked to its commit, so a third party can verify it. |
| **E5** observed | A probe of the system in operation reports it met. |

## Tier 1: the system reports itself **Built** (M7)

- **Grades and review debt** attached to each requirement of the proof register, the debt as a number.
- **Freshness.** A proof is fresh, due or stale. A proof older than its requirement's last change, or whose tested commit is not an ancestor of the specification's last revision, is stale, and a stale proof opens a nonconformance by itself.
- **Nonconformance and CAPA** as typed, append-only records. A CAPA is open, then verified when a *named* test passes in a later run, then closed only when a *named person* approves, recorded as a Decision. The person is data in the record, never inferred.
- **Objectives.** The `SC-NNN` success criteria of the specifications are read as quality objectives with targets and error budgets, emitted as OpenTelemetry metrics.
- **An index** of all of it, deterministic, generated from the branch and `--check`able; commands `index`, `freshness`, `nonconformances`, `capa open|verify|close`, `register`, `tier` and `attest`.

## Tier 2: people see and prove **In progress** (M9)

Being built now, in `commons/quality/src/`: the **assessor pack** (a deterministic archive of the records, their chain, the index and the crosswalks, with an offline `verify-pack` that checks every hash, the chain and the signatures with no network); the **Trust page** (`0022-trust`, a generated page and JSON, redacted by audience: public, assessor, internal; failures and open nonconformances included); **attestation by recorded sample** (a person samples records at random with a recorded seed); **pre-registered test plans** (a plan committed before the run, its hash recorded in the run); **mutation-run records** for proof strength; and **agents performing reviews**, graded below a test run and sampled by a person. The console (a user interface) belongs to a harness and is not built here.

**Evidence, not a verdict.** The Trust page states what was proved, how and when. It does not say that a harness conforms to a standard, and it does not claim compliance with any regulation.

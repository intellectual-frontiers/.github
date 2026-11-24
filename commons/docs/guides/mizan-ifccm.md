# IFCCM: change control

**Intellectual Frontiers Capabilities Configuration Management** (`0020-ifccm`, `ifccm:`) is how a harness controls change. The unit of change is a *capability*, every commit names its issue, and each requirement can be followed from its issue to the test run that proved it. The abbreviation is never used as "CCM" alone: that is also the Cloud Security Alliance's Cloud Controls Matrix. **Built** (M2) **Spec: Draft**

- **A capability is the unit of change.** One ability of a harness that can be named, specified, built, proved and released. Each area (a rung, or a subject) has one parent change request, and each capability is a child (sub-issue) of it.
- **Every commit names an issue.** On a line of its own: `Refs #N` for work toward it, `Closes #N` for the commit that finishes it. Other words (Fixes, Resolves, Closed) are findings. With `--strict`, `Closes` on an issue whose checkboxes or Done when are not done is a finding too.
- **Warn, then gate.** Until a harness declares its production day, a finding is a warning held by a baseline that only shrinks. From that day it is a gate. A declaration that relaxes between commits is itself a finding (`changes/gate-relaxed`).
- **Authority is kept apart.** What a specification binds, a Decision authorizes, a check verifies and an issue only plans. A departure with no Decision is a finding; so is a Decision approved by the change's own author where the harness declares a regulated domain.

## The trace chain

The check follows each requirement through six stages and reports the first stage with no link: **issue** (`Refs`/`Closes`), **requirement**, **ontology term**, **code** (`// Spec:`), **test** (`proves([...])`) and **quality run**. A generated view lists the capabilities touching each rung, with `--check`.

## The command

```sh
bun commons/libraries/src/changes.ts [--range A..B] [--strict] [--declaration FILE] [--check]
bun commons/libraries/src/changes.ts --capability-trace --range A..B [--issues FILE] [--terms FILE] [--rungs FILE] [--format json]
bun commons/libraries/tools/changes.ts   # the same; the result is kept as a quality record
```

Exit 0 is clean, 1 findings, 2 usage, 3 environment. The host (GitHub, GitLab or plain Git) is reached through one interface, `GitHostClient`. On plain Git, or where the host cannot be reached, the strict rules are `not_run` with their reason, never a pass. Only what a specification folder can judge offline (the shape of the declaration) is wired into `holdHarness` as a rule plugin; the commit rules need a range and belong to the command.

Where a harness has no Git host account, `--capability-trace` makes the chain offline: from the `Refs` and `Closes` lines of the commits of a range, the requirements of the specifications, the `mz:definedBy` of the ontology's terms (a JSON file, or a module loaded by its `file:` URL), the `Spec:` and `Proves:` lines (after two slashes or in a block comment) and a quality record, it gives for each capability and requirement the terms, code and tests on each rung and the stage where the chain ends, as a table or as JSON. A harness whose specifications are numbered with three digits, or whose registers are in another folder, says so to `mizan-check.ts` and `check.ts` with `--register`, and gives the proof register's path to `oscal-register.ts` with `--enforcement`.

## Regulated domains, and what this is not

A harness declares from a code list of five domains: federal security (NIST SP 800-53, FedRAMP), device quality (21 CFR Part 820, which incorporates ISO 13485), electronic records (21 CFR Part 11), device software (IEC 62304) and trust services (SOC 2, ISO/IEC 27001). The specification maps its parts to those standards as mapping statements. **It does not claim that any harness complies** with any of them: it keeps the evidence an assessor would ask for.

# Plan: 0010-workload-runners

**Spec:** 0010-workload-runners. **Written:** 2026-11-25.

## Standards considered

| Standard | What the library takes from it | Read |
| --- | --- | --- |
| W3C PROV-O (as read for 0005-workload-runs) | The choice of a runner is the choice of the agent that is associated with the activity and does not change the activity; a receipt is a record of an activity that another system performed | Section 4.1, as cited by 0005-workload-runs |
| The workbench matrix (`commons/workbench/src/logical/matrix.ts`, read in this repository) | A choice is held to what the chosen party can express; what it cannot is named and the choice is not moved | The file itself; 0007-workload-harness FR-004 uses it for dialects |
| SHA-256 through `@intellectual-frontiers/crypto` (`commons/crypto/src/sha256.ts`, read in this repository) | A digest is 64 lower case hexadecimal digits | The file itself |
| Plan then apply with an approval by the hash of the plan (0009-form-reconcile) | What is handed off is identified by its hash, and a result that names another hash is not the result of this plan | The specification itself |

## What is built and what is reused

Reused: the envelope and the order of the fold (0005-workload-runs), the shape of the policy and of its resolution (0007-workload-harness), the shape of the catalog and of the finding, the derived autonomy (0002-workload-effects) and the digest of `@intellectual-frontiers/crypto`. New: the registry of runners with their capabilities, the policy, the needs a form derives, the two events and their fold, the plan of calls, the plan hash, the check of an artifact by regenerating it and the native runner under its new name.

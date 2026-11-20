# The quality system (IFQS)

The Intellectual Frontiers Quality System is based on Operational Truth: what is true of a system is what the system reports when it runs, kept as evidence anyone can check, with the grade of that evidence shown and a failure opened as a nonconformance by the system itself ([commons 0021-ifqs](../../spec-kit/specs/0021-ifqs/spec.md)).

**What a run must leave behind:** a stored, chained, immutable record. **What the evidence is worth:** a grade, and a debt where it is low. **What happens when a proof fails or goes stale:** a nonconformance and a corrective action. **How a harness states what it aims for:** objectives, read from the success criteria of its specifications.

**Where to see it.** [The Quality library](../../quality/) records a test run as one OpenTelemetry record with its reports, and keeps them on an append-only branch with notes on the tested commit. The public Trust page and the assessor pack are made from the same evidence ([commons 0022-trust](../../spec-kit/specs/0022-trust/spec.md)).

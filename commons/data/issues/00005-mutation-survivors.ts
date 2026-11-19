// Spec: 0044-issues FR-001
/** A third of the mutations survive the tests */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 5,
  slug: "mutation-survivors",
  title: "A third of the mutations survive the tests",
  summary:
    "Of 91 mutations of the sources 31 survived. Killed since by tests of their own: the security branches (expired approval, approver without authority, group depth, cross-tenant delegation, call limit and grant end), the uniques of login, group name, passkey, refresh token and domain, the read-only word list, the delete-share boundary, the UPDATE policy and the lock timeouts of undo. Still surviving: validating a check later (the fixture library has no check to add), the quarantine content and row checks and the irreversible-or-quarantine reversibility, expansion of a table only the old library had, a table renamed by annotation, markdown escaping in the plan report, the staleness comparison of a target, and a lost update of a budget (not shown by in-process engines).",
  severity: "high",
  priority: "P2",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: { kind: "in-progress", by: "claude" },
  size: "l",
  cites: [],
  evidence: [
    {
      "kind": "review",
      "source": "review-d, 2026-11-19"
    }
  ],
  links: [],
  raised: "2026-11-19",
});

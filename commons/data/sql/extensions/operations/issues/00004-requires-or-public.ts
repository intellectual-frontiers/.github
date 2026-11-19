// Spec: 0044-issues FR-001
/** An operation need not require a permission */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 4,
  slug: "requires-or-public",
  title: "An operation need not require a permission",
  summary: "A command may declare no permission and still be callable, and nothing tells a public operation from a forgotten one. Say how it is decided who may call it: a permission, public, or what its implementation checks; lint and the runtime refuse none.",
  severity: "high",
  priority: "P1",
  goals: ["G1", "G2"],
  appliesTo: { engines: "all" },
  status: {
    kind: "fixed",
    proof: [
      { kind: "test", file: "suite/operations.test.ts", name: "an operation requires a permission or says it is public" },
      { kind: "spec", id: "0031-operations" },
    ],
  },
  size: "s",
  cites: [
    "0031-operations FR-002"
  ],
  evidence: [
    {
      "kind": "file",
      "path": "governance/operation.ts"
    }
  ],
  links: [],
  raised: "2026-11-19",
});

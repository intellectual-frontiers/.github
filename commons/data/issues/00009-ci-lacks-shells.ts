// Spec: 0044-issues FR-001
/** CI does not install the shells the arcactl shell tests run */
import { issue } from "@intellectual-frontiers/data/governance";

export default issue({
  id: 9,
  slug: "ci-lacks-shells",
  title: "CI does not install the shells the arcactl shell tests run",
  summary:
    "The tests of `arcactl shell` run bash, sh, zsh, fish, PowerShell and nushell where they are installed and skip the ones that are not, unless ARCACTL_REQUIRE_SHELLS=1. The data workflow is generated (commons 0030-generated-workflows) and installs none of them, so in CI only bash and sh run, and the PowerShell and nushell scripts have never been run by a test. Add the installs and the variable to the generator's data job.",
  severity: "medium",
  priority: "P2",
  goals: ["G1", "G5"],
  appliesTo: { engines: "all" },
  status: { kind: "open" },
  size: "s",
  cites: ["0047-arcactl-init FR-006"],
  evidence: [{ kind: "file", path: "suite/arcactl-shell.test.ts" }],
  raised: "2026-11-19",
});

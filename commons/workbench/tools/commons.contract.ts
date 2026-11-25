// Spec: 0003-workbench-contract FR-007
/**
 * The workbench contract of the commons (commons workbench 0003-workbench-contract): what a person or an agent needs to work on this repository. The base is small: Git, the two runtimes, an identity and `origin/main`. Everything else
 * is what the libraries say they need in their own manifests (the field `workbench` of each `library.ts`), composed only for the units a task is about, and each library's own dependencies to install. Read by `workbench ready`:
 * `bun commons/workbench/src/physical/main.ts ready --for test --unit anyfs-sql --contract commons/workbench/tools/commons.contract.ts`.
 *
 * @module
 */
import { defineContract, type Contract, type Requirement } from "../src/governance/mod.ts";
import { readManifestContributions, readManifests } from "../src/physical/collect.ts";
import { path } from "@intellectual-frontiers/system";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..", "..", "..");

const base: readonly Requirement[] = [
  { id: "git", kind: "program", concept: "workshop", task: "any", safety: false, summary: "Git is installed", name: "git", minimum: "2.30.0", install: ["apt-get", "install", "-y", "git"] },
  { id: "node", kind: "program", concept: "workshop", task: "any", safety: false, summary: "Node 26 is the runtime of the checks and the backup of Bun", name: "node", minimum: "26.0.0" },
  { id: "bun", kind: "program", concept: "workshop", task: "any", safety: false, summary: "Bun, at the version the commons pins, runs the code, the tests and the dev loop", name: "bun", minimum: "1.4.4" },
  { id: "git-identity", kind: "git", concept: "workspace", task: "any", safety: false, summary: "Git has an identity, so that a merge is not made in another name", check: "identity-set" },
  { id: "origin-main", kind: "git", concept: "workspace", task: "verify", safety: false, summary: "origin/main is known, so that the loop can tell what a change touches", check: "ref-present", ref: "origin/main" },
  { id: "tag-release", kind: "authority", concept: "workstation", task: "release", safety: false, summary: "A release tag is made by the person who releases", gate: "release-tag" },
  { id: "change-scanner-pins", kind: "authority", concept: "workstation", task: "any", safety: true, summary: "A change to the secret scanner's pins is a person's", gate: "scanner-pins" },
];

const manifests = await readManifests(ROOT);
const contributed = await readManifestContributions(ROOT);
if (contributed.kind === "err") throw new Error(`a manifest's workbench field is not valid: ${contributed.error.join("; ")}`);

// each library has its own dependencies (its devDependencies, such as the compiler), installed in its own folder: it is needed to test or verify that library and no other
const installs = manifests
  .filter((m) => m.unit !== "workbench-never")
  .map((m) => ({
    unit: m.unit,
    requirements: [{ id: `install-${m.unit}`, kind: "install", concept: "workspace", task: "test", safety: false, summary: `The dependencies of ${m.unit} are installed in its folder`, folder: m.folder, install: ["bun", "install"] } as const],
  }));

const merged = new Map<string, { unit: string; requirements: Requirement[]; tests?: readonly { glob: string; needs: readonly string[] }[] }>();
for (const c of [...installs, ...contributed.value]) {
  const prior = merged.get(c.unit);
  merged.set(c.unit, { unit: c.unit, requirements: [...(prior?.requirements ?? []), ...c.requirements.filter((r) => !(prior?.requirements ?? []).some((p) => p.id === r.id))], ...("tests" in c && c.tests !== undefined ? { tests: [...(prior?.tests ?? []), ...c.tests] } : prior?.tests === undefined ? {} : { tests: prior.tests }) });
}
const repositoryTests = { unit: "repository-tests", requirements: [{ id: "sshd", kind: "program", concept: "workshop", task: "test", safety: false, summary: "sshd and ssh-keygen run the real SSH test of the fleet store", name: "sshd", probe: ["sshd", "-V"], install: ["apt-get", "install", "-y", "openssh-server"] } as const], tests: [{ glob: "tests/commons-estate-fleet-sshd.test.ts", needs: ["sshd"] }] };

const made = defineContract({
  name: "commons",
  enforceFrom: "2027-01-01",
  roles: [
    { id: "contributor", holder: "either", may: ["read", "edit", "test", "propose", "commit", "push"] },
    { id: "publisher", holder: "either", may: ["publish"] },
    { id: "approver", holder: "human", may: ["approve"] },
    { id: "releaser", holder: "human", may: ["approve", "publish", "tag"] },
  ],
  gates: [
    { id: "release-tag", summary: "A release tag is signed by the releaser, from the commit that holds the release record.", approver: "releaser", commands: ["git tag", "git push --tags"] },
    { id: "scanner-pins", summary: "The pins of the secret scanner (the canaries) change only with the approver's say.", approver: "approver", commands: [] },
    { id: "history-rewrite", summary: "Rewriting published history breaks every hash, tag and signature and is the releaser's.", approver: "releaser", commands: ["git push --force", "git filter-repo"] },
  ],
  stages: [
    { id: "develop", level: "agent-autonomous", gates: [] },
    { id: "safety-configuration", level: "agent-proposes", gates: ["scanner-pins"] },
    { id: "release", level: "agent-acts-human-reviews", gates: ["release-tag"] },
    { id: "history", level: "human-only", gates: ["history-rewrite"] },
  ],
  base,
  contributions: [...[...merged.values()].filter((c) => c.requirements.length > 0), repositoryTests],
} satisfies Contract);
if (made.kind === "err") throw new Error(`the commons contract is not valid: ${made.error.join("; ")}`);

/** The contract of the commons. */
export const contract: Contract = made.value;

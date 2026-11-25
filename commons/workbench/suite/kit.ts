/**
 * What the tests share: a contract made up for them (a base, two units that contribute, three roles, two gates and three stages) and the facts of a machine as values, so that a test of the logic needs no program. Every name is made up.
 *
 * @module
 */
import { type Contract, defineContract, type Requirement } from "@intellectual-frontiers/workbench/governance";
import type { Facts } from "@intellectual-frontiers/workbench/logical";

export const GIT = { id: "git", kind: "program", concept: "workshop", task: "any", safety: false, summary: "Git is installed", name: "git", minimum: "2.0.0", install: ["apt-get", "install", "-y", "git"] } as const satisfies Requirement;
export const TOKEN = { id: "registry-token", kind: "credential", concept: "workbench", task: "any", safety: false, summary: "The registry token is in the environment", name: "NODE_AUTH_TOKEN", aliases: ["SYNTHETIC_TOKEN"], scope: "read:packages" } as const satisfies Requirement;
export const SQLITE = { id: "sqlite3", kind: "program", concept: "workshop", task: "test", safety: false, summary: "sqlite3 runs the SQLite tests", name: "sqlite3", install: ["apt-get", "install", "-y", "sqlite3"] } as const satisfies Requirement;
export const SQL_INSTALL = { id: "sql-install", kind: "install", concept: "workspace", task: "test", safety: false, summary: "The dependencies of the sql library are installed", folder: "synthetic/sql", install: ["bun", "install"] } as const satisfies Requirement;
export const SSH_KEYGEN = { id: "ssh-keygen", kind: "program", concept: "workshop", task: "test", safety: false, summary: "ssh-keygen makes the keys of the evidence tests", name: "ssh-keygen", install: ["apt-get", "install", "-y", "openssh-client"] } as const satisfies Requirement;
export const TAG = { id: "tag-release", kind: "authority", concept: "workstation", task: "release", safety: false, summary: "A release tag is signed by its releaser", gate: "release-tag" } as const satisfies Requirement;

/** The contract of the tests. */
export const contractInput: Contract = {
  name: "synthetic-contract",
  enforceFrom: "2027-01-01",
  roles: [
    { id: "contributor", holder: "either", may: ["read", "edit", "test", "propose", "commit"] },
    { id: "approver", holder: "human", may: ["approve"] },
    { id: "releaser", holder: "human", may: ["approve", "publish", "tag"] },
  ],
  gates: [
    { id: "accept-finding", summary: "An accepted finding is the approver's to write.", approver: "approver", commands: ["agora quality accept"] },
    { id: "release-tag", summary: "A release tag is signed by the releaser.", approver: "releaser", commands: ["git tag", "git push --tags"] },
  ],
  stages: [
    { id: "build", level: "agent-autonomous", gates: [] },
    { id: "regulated-change", level: "agent-proposes", gates: ["accept-finding"] },
    { id: "release", level: "human-only", gates: ["release-tag"] },
  ],
  base: [GIT, TOKEN, TAG],
  contributions: [
    { unit: "synthetic-sql", requirements: [SQLITE, SQL_INSTALL], tests: [{ glob: "suite/*sqlite*.test.ts", needs: ["sqlite3"] }] },
    { unit: "synthetic-evidence", requirements: [SSH_KEYGEN], tests: [{ glob: "suite/keys.test.ts", needs: ["ssh-keygen"] }] },
    { unit: "synthetic-plain", requirements: [] },
  ],
};

export const contract: Contract = (() => {
  const made = defineContract(contractInput);
  if (made.kind === "err") throw new Error(made.error.join("; "));
  return made.value;
})();

/** Facts of a machine with only what is given. */
export const facts = (over: Partial<Facts> = {}): Facts => ({ programs: {}, env: new Set(), refs: new Set(), identity: true, installed: new Set(), network: {}, ...over });

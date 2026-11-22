// Spec: 0008-machine-probe-agent-workspace FR-002, FR-003
/**
 * A policy as data: a `ProbeRule` names the section and the key of the probe's output it reads, a closed operator and the value to compare with, whether a miss fails or warns, the controls of NIST SP 800-53 Rev 5 it gives evidence for and
 * the fix in words, and one small function (`evaluateRules`) judges any rule, so that the pack for a kind of machine is a table a person reads and reviews. The pack for an agent workspace is `agentWorkspaceRules`; the ten policies of the
 * existing pack stay functions (`policies.ts`).
 *
 * @example
 * ```ts
 * import { evaluateRules, type ProbeRule } from "./rules.ts";
 * const rule: ProbeRule = { id: "not-root", title: "The agent is not root", controls: ["AC-6"], reads: { section: "agent", key: "uid" }, operator: "not-equals", value: "0", miss: "fail", ifMissing: "unknown", fix: "run as a user" };
 * evaluateRules([rule], { agent: { uid: "1000" } })[0]?.status; // "pass"
 * ```
 *
 * @module
 */
import type { PolicyResult } from "./policies.ts";
import { evaluate } from "./policies.ts";
import type { Observed, ProbeOutput } from "./observed.ts";

/** The operators of a rule, a closed list: the value read is `equals` or is not equal (`not-equals`) to the value, is `absent` (missing or empty), or is at most (`le`) or at least (`ge`) the value, compared as dotted numbers (`0.5.7`, `0600`). */
export const OPERATORS = ["equals", "not-equals", "absent", "le", "ge"] as const;

/** An operator of a rule. */
export type Operator = (typeof OPERATORS)[number];

/** A policy as data. */
export type ProbeRule = {
  readonly id: string;
  readonly title: string;
  /** The controls of NIST SP 800-53 Rev 5 it gives evidence for. */
  readonly controls: readonly string[];
  /** The section and the key of the probe's output it reads. */
  readonly reads: { readonly section: string; readonly key: string };
  readonly operator: Operator;
  /** What the value read is compared with; none for `absent`. */
  readonly value?: string;
  /** What a miss is. */
  readonly miss: "fail" | "warn";
  /** What a key the probe did not give is, for every operator but `absent` (where it passes): `unknown` (it cannot be told), `pass` or `miss`. */
  readonly ifMissing: "unknown" | "pass" | "miss";
  /** How to make it pass. */
  readonly fix: string;
};

/** The numbers of a dotted text, or nothing where a part is not a number. */
function dotted(text: string): readonly number[] | undefined {
  const parts = text.trim().split(".");
  const nums = parts.map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : Number.NaN));
  return nums.some(Number.isNaN) ? undefined : nums;
}

/** -1, 0 or 1 as `a` is less than, equal to or greater than `b` as dotted numbers (a shorter one is padded with zeros), or nothing where either is not dotted numbers. */
export function compareDotted(a: string, b: string): -1 | 0 | 1 | undefined {
  const x = dotted(a);
  const y = dotted(b);
  if (x === undefined || y === undefined) return undefined;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** The rules judged against the probe's output, in order: each result has the rule's id, title, controls and fix, the finding and what was found. */
export function evaluateRules(rules: readonly ProbeRule[], out: ProbeOutput): readonly PolicyResult[] {
  return rules.map((r) => {
    const raw = out[r.reads.section]?.[r.reads.key];
    const missing = raw === undefined || raw === "";
    const where = `${r.reads.section} ${r.reads.key}`;
    const base = { id: r.id, title: r.title, controls: r.controls, fix: r.fix } as const;
    const miss = r.miss;
    if (r.operator === "absent") return { ...base, status: missing ? "pass" : miss, detail: missing ? `${where}: none` : `${where}: ${raw}` } as PolicyResult;
    if (missing) {
      const status = r.ifMissing === "pass" ? "pass" : r.ifMissing === "miss" ? miss : "unknown";
      return { ...base, status, detail: `${where}: not given` } as PolicyResult;
    }
    const want = r.value ?? "";
    let holds: boolean | undefined;
    if (r.operator === "equals") holds = raw === want;
    else if (r.operator === "not-equals") holds = raw !== want;
    else {
      const c = compareDotted(raw, want);
      holds = c === undefined ? undefined : r.operator === "le" ? c <= 0 : c >= 0;
    }
    return { ...base, status: holds === undefined ? "unknown" : holds ? "pass" : miss, detail: `${where}: ${raw}` } as PolicyResult;
  });
}

/** What an estate states of an agent workspace, which the pack compares with what the probe found: the digest of its agents policy, the version of the coordinator it expects at least, the harnesses it declares and how it is isolated. */
export type AgentWorkspaceDeclared = {
  readonly policyDigest: string;
  readonly coordinator: string;
  readonly harnesses: readonly string[];
  readonly isolation: "container" | "vm" | "physical";
};

/** The pack for an agent workspace, as data: what an estate states is the value of a rule (0008-machine-probe-agent-workspace FR-003). The harnesses found are compared with the harnesses declared, as sets. */
export function agentWorkspaceRules(d: AgentWorkspaceDeclared): readonly ProbeRule[] {
  const at = (key: string) => ({ section: "agent", key });
  return [
    { id: "agent-policy-present", title: "The agents policy is the one the estate states", controls: ["AC-6"], reads: at("policy-digest"), operator: "equals", value: d.policyDigest, miss: "fail", ifMissing: "miss", fix: "write the agents policy the estate states with the coordinator (the digest the host records must equal the estate's)" },
    { id: "agent-token-file-private", title: "The token file is readable by its owner only", controls: ["IA-5"], reads: at("token-file-mode"), operator: "equals", value: "0600", miss: "fail", ifMissing: "pass", fix: "chmod 600 on the token file of the coordinator" },
    { id: "agent-no-ambient-secrets", title: "No secret is in the environment of the harness's account", controls: ["IA-5", "AC-6"], reads: at("ambient-secret-names"), operator: "absent", miss: "fail", ifMissing: "pass", fix: "remove the variables named from the profile and the environment of the account, and give the harness a token file or a short-lived token" },
    { id: "agent-not-root", title: "The harness does not run as root", controls: ["AC-6"], reads: at("uid"), operator: "not-equals", value: "0", miss: "fail", ifMissing: "unknown", fix: "run the harness as an account that is not root" },
    { id: "agent-coordinator-current", title: "The coordinator is at the version the estate expects", controls: ["CM-2", "SI-2"], reads: at("coordinator"), operator: "ge", value: d.coordinator, miss: "warn", ifMissing: "miss", fix: `install Ergonex ${d.coordinator} or later` },
    { id: "agent-harness-known", title: "The harnesses found are the harnesses declared", controls: ["CM-7", "CM-8"], reads: at("harnesses"), operator: "equals", value: [...d.harnesses].sort().join(" "), miss: "warn", ifMissing: "miss", fix: "declare the harnesses the machine has, or remove the ones it should not have" },
    { id: "agent-isolation-as-declared", title: "The machine is isolated as declared", controls: ["CM-8"], reads: at("isolation"), operator: "equals", value: d.isolation, miss: "warn", ifMissing: "unknown", fix: `run the workspace in a ${d.isolation}, or declare how it is isolated` },
  ];
}

/** The results of the pack for an agent workspace: the rules, then `ssh-keys-only` of the existing pack. */
export function evaluateAgentWorkspace(out: ProbeOutput, observed: Observed, declared: AgentWorkspaceDeclared, now: string): readonly PolicyResult[] {
  const rules = evaluateRules(agentWorkspaceRules(declared), out);
  return [...rules, ...evaluate(observed, now).filter((r) => r.id === "ssh-keys-only")];
}

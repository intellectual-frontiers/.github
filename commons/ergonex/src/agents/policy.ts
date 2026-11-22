// Spec: 0006-agents FR-004, FR-005
/**
 * The `agents` policy of the manifest (commons ergonex 0006-agents FR-004, FR-005): what the persona `agent` may change. Decoded at the boundary: an unknown key and a value outside its set are refused,
 * naming the key; an absent policy allows nothing that changes the host or the workspace.
 *
 * @example
 * ```ts
 * import { decideAgent, decodeAgentsPolicy } from "./policy.ts";
 * const p = decodeAgentsPolicy({ allow: ["apply"] });
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The command names a policy may allow (FR-004). */
export const AGENT_COMMANDS = ["setup", "apply", "render", "repos add", "repos remove", "repos delete", "repos adopt", "worktree create", "worktree prune", "remote bootstrap"] as const;
/** One of them. */
export type AgentCommand = (typeof AGENT_COMMANDS)[number];

/** The ladder of Headless. */
export const AGENT_TIERS = ["public", "operator", "administrator"] as const;
/** One tier of the ladder. */
export type AgentTier = (typeof AGENT_TIERS)[number];

/** How a commit of the persona is made (FR-008). */
export type CommitPolicy = { readonly name: string; readonly email: string; readonly trailer: string };

/** `ergonex:AgentPolicy`. */
export type AgentsPolicy = {
  readonly allow: readonly AgentCommand[];
  /** `"all"` or the remotes the persona may change. */
  readonly repos: "all" | readonly string[];
  readonly tier: AgentTier;
  readonly commit?: CommitPolicy | undefined;
  readonly disposable: boolean;
  /** The hosts `remote` may reach. */
  readonly remote: readonly string[];
  /** Whether `remote run` may run a command that is not `ergonex` (FR-031). */
  readonly rawCommands: boolean;
};

/** The policy that allows nothing. */
export const NO_AGENT_POLICY: AgentsPolicy = { allow: [], repos: [], tier: "public", disposable: false, remote: [], rawCommands: false };

const KEYS = ["allow", "repos", "tier", "commit", "disposable", "remote", "rawCommands"] as const;
const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStrings = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const TRAILER = /^[A-Za-z][A-Za-z0-9-]*: \S.*$/;

/** The policy from a value of unknown shape, or every problem found in it, each naming its key. */
export function decodeAgentsPolicy(input: unknown): Result<AgentsPolicy, readonly { readonly path: string; readonly message: string }[]> {
  if (!isRecord(input)) return err([{ path: "$.agents", message: "the agents policy is a record" }]);
  const issues: { path: string; message: string }[] = [];
  for (const k of Object.keys(input)) if (!KEYS.some((x) => x === k)) issues.push({ path: `$.agents.${k}`, message: `${JSON.stringify(k)} is not a key of the agents policy (${KEYS.join(", ")})` });
  const allow: AgentCommand[] = [];
  const a = input["allow"];
  if (a !== undefined) {
    if (!isStrings(a)) issues.push({ path: "$.agents.allow", message: "allow is a list of command names" });
    else
      for (const [i, w] of a.entries()) {
        const c = AGENT_COMMANDS.find((x) => x === w);
        if (c === undefined) issues.push({ path: `$.agents.allow[${i}]`, message: `${JSON.stringify(w)} is not a command that can be allowed (${AGENT_COMMANDS.join(", ")})` });
        else if (!allow.includes(c)) allow.push(c);
      }
  }
  let repos: "all" | readonly string[] = [];
  const r = input["repos"];
  if (r !== undefined) {
    if (r === "all") repos = "all";
    else if (isStrings(r)) repos = r;
    else issues.push({ path: "$.agents.repos", message: 'repos is "all" or a list of remotes' });
  }
  let tier: AgentTier = "public";
  const t = input["tier"];
  if (t !== undefined) {
    const found = AGENT_TIERS.find((x) => x === t);
    if (found === undefined) issues.push({ path: "$.agents.tier", message: `the tier is ${AGENT_TIERS.join(", ")}` });
    else tier = found;
  }
  let commit: CommitPolicy | undefined;
  const c = input["commit"];
  if (c !== undefined) {
    if (!isRecord(c)) issues.push({ path: "$.agents.commit", message: "commit is a record of name, email and trailer" });
    else {
      for (const k of Object.keys(c)) if (k !== "name" && k !== "email" && k !== "trailer") issues.push({ path: `$.agents.commit.${k}`, message: `${JSON.stringify(k)} is not a key of commit (name, email, trailer)` });
      const { name, email, trailer } = c;
      if (typeof name !== "string" || name === "") issues.push({ path: "$.agents.commit.name", message: "name is text" });
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(email)) issues.push({ path: "$.agents.commit.email", message: "email is an address" });
      if (typeof trailer !== "string" || !TRAILER.test(trailer)) issues.push({ path: "$.agents.commit.trailer", message: "trailer is a line of the form `Key: value`" });
      if (typeof name === "string" && typeof email === "string" && typeof trailer === "string" && issues.length === 0) commit = { name, email, trailer };
    }
  }
  const d = input["disposable"];
  if (d !== undefined && typeof d !== "boolean") issues.push({ path: "$.agents.disposable", message: "disposable is true or false" });
  const remote = input["remote"];
  if (remote !== undefined && !isStrings(remote)) issues.push({ path: "$.agents.remote", message: "remote is a list of hosts" });
  const raw = input["rawCommands"];
  if (raw !== undefined && typeof raw !== "boolean") issues.push({ path: "$.agents.rawCommands", message: "rawCommands is true or false" });
  if (issues.length > 0) return err(issues);
  return ok({ allow, repos, tier, ...(commit === undefined ? {} : { commit }), disposable: d === true, remote: isStrings(remote) ? remote : [], rawCommands: raw === true });
}

/** The lower of two tiers. */
export function lowerTier(a: AgentTier, b: AgentTier): AgentTier {
  return AGENT_TIERS.indexOf(a) <= AGENT_TIERS.indexOf(b) ? a : b;
}

/** The tier a word names, or undefined. */
export function tierOf(word: string | undefined): AgentTier | undefined {
  return AGENT_TIERS.find((t) => t === word);
}

/** The command of FR-004 that a command line is, if it is one; `previewOnly` says that the run is a preview or a check, which the verbs with that qualifier allow. */
export function agentCommandOf(command: string, mode: "apply" | "dry-run" | "check"): AgentCommand | undefined {
  const c = AGENT_COMMANDS.find((x) => x === command);
  if (c === undefined) return undefined;
  const qualified = c === "render" || c.startsWith("repos ");
  if (qualified && mode !== "apply") return undefined;
  return c;
}

/** What is decided of a command for the persona `agent` (FR-004). */
export type Decision = { readonly allowed: true } | { readonly allowed: false; readonly command: AgentCommand };

/** Whether the persona may run a command: a command that only reads is allowed; one of FR-004 only where the policy names it. */
export function decideAgent(policy: AgentsPolicy | undefined, command: string, mode: "apply" | "dry-run" | "check"): Decision {
  const c = agentCommandOf(command, mode);
  if (c === undefined) return { allowed: true };
  return (policy ?? NO_AGENT_POLICY).allow.includes(c) ? { allowed: true } : { allowed: false, command: c };
}

/** The words of the refusal, naming the entry of the policy that would allow the command (FR-003, FR-004). */
export function denialMessage(command: AgentCommand): string {
  return `the persona agent may not run \`ergonex ${command}\`: it changes the host or the workspace; the person allows it with \`agents: { allow: ["${command}"] }\` in the manifest, or runs it with --persona human`;
}

const normalRemote = (s: string): string => s.trim().toLowerCase().replace(/\/+$/, "").replace(/\.git$/, "");

/** Whether the policy lets the persona change a repository: `repos: "all"`, or a remote the list names (a full address, or `owner/name`). */
export function mayChangeRepo(policy: AgentsPolicy | undefined, cloneUrl: string): boolean {
  if (policy === undefined) return false;
  if (policy.repos === "all") return true;
  const url = normalRemote(cloneUrl);
  return policy.repos.some((r) => {
    const n = normalRemote(r);
    return n === url || url.endsWith(`/${n}`);
  });
}

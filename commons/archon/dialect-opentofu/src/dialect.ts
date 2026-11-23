// Spec: 0002-opentofu-dialect FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007
/**
 * The dialect of Archon for cloud resources with OpenTofu: what it guarantees (as data), how it renders an order of `cloud-resource` requirements to one JSON configuration (OpenTofu's JSON syntax), and the steps that carry the plan out. It renders and says what to run; it runs nothing, and it needs no network.
 *
 * What makes it safe to hand to a pipeline: every provider the order uses is named with an exact version (a provider the options do not name is refused, so nothing is fetched that nobody pinned); no credential is ever in the render, because a requirement or a provider setting that holds one is refused (the provider reads its credentials from the environment
 * of the run, as every cloud's own tooling does); the state is kept outside the repository (a backend the options name, or a file in a folder the options name that is not in the render's folder), so the state, which holds the secrets of what it made, is never committed; the arguments that run code (`provisioner`, `connection`) are refused; and the steps plan to
 * a saved plan and apply exactly that plan, so that what was shown is what is done (and the plan is checked against the order first: `checkPlan`).
 *
 * @example
 * ```ts
 * import { opentofu, KINDS_CARRIED } from "./dialect.ts";
 * KINDS_CARRIED; // ["cloud-resource"]
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { renderedOf, type Dialect, type DialectStep, type Rendered } from "@intellectual-frontiers/archon/dialect";
import { canonicalJson, findSecretLike, parseDialectId, parseKindId, type JsonValue, type Requirement } from "@intellectual-frontiers/archon/governance";
import type { Order, Plan } from "@intellectual-frontiers/archon/logical";

/** The id of the dialect. */
export const DIALECT_ID = "opentofu";

/** The version of OpenTofu the dialect pins. A fleet that pins another passes it. */
export const PINNED_VERSION = "1.9.0";

/** The kinds of resource the dialect carries out. */
export const KINDS_CARRIED = ["cloud-resource"] as const;

/** A provider the order may use, pinned. */
export type ProviderPin = {
  /** Where it comes from, as the registry names it: `hashicorp/aws`. */
  readonly source: string;
  /** Its exact version: a range is not a pin. */
  readonly version: string;
  /** Its settings (a region, a profile name, an endpoint): never a credential. */
  readonly config?: { readonly [key: string]: JsonValue };
};

/** What the dialect is made with. */
export type OpenTofuOptions = {
  /** The providers the order may use, by the local name the requirements give (`aws`). */
  readonly providers: { readonly [name: string]: ProviderPin };
  /** The folder the state, the saved plan and the provider data are kept in: absolute, and outside the render. */
  readonly stateDir: string;
  /** Where the state lives where it is not a file of `stateDir`: a backend and its settings (never a credential). */
  readonly backend?: { readonly type: string; readonly config: { readonly [key: string]: JsonValue } };
  /** The version of OpenTofu the run must have. */
  readonly version?: string;
  /** The folder, below the working folder, the render is written in; `.archon` by default. */
  readonly renderRoot?: string;
};

type Obj = { readonly [key: string]: JsonValue };
const isObj = (v: JsonValue | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SOURCE = /^([a-z0-9.-]+\/)?[a-z0-9-]+\/[a-z0-9-]+$/;
const LOCAL = /^[a-z][a-z0-9]*$/;
const TYPE = /^[a-z][a-z0-9_]*$/;
const NAME = /^[a-z_][a-z0-9_-]{0,63}$/;
/** The arguments of a resource that run code on the machine that runs OpenTofu, or reach outside what the resource is. */
const FORBIDDEN_SETTINGS = new Set(["provisioner", "connection", "depends_on", "provider", "count", "for_each", "lifecycle"]);
const CREDENTIAL_NAMES = /^(access[-_]?key|secret[-_]?key|secret|password|passwd|token|api[-_]?key|client[-_]?secret|private[-_]?key|credentials?|session[-_]?token|shared[-_]?credentials[-_]?files?)$/i;

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The problems of the options, or none. */
export function optionProblems(o: OpenTofuOptions): readonly string[] {
  const problems: string[] = [];
  if (!o.stateDir.startsWith("/") || o.stateDir.split("/").includes("..")) problems.push("stateDir is an absolute path with no ..: the state is kept outside the repository");
  const root = o.renderRoot ?? ".archon";
  if (o.stateDir.split("/").includes(root.replace(/^\.\//, ""))) problems.push(`stateDir is inside a folder named ${root}, which is where the render is committed: the state is never committed`);
  for (const [name, p] of Object.entries(o.providers)) {
    if (!LOCAL.test(name)) problems.push(`provider ${JSON.stringify(name)}: the local name is lower case letters and digits`);
    if (!SOURCE.test(p.source)) problems.push(`provider ${name}: the source is namespace/name, as the registry says it (hashicorp/aws)`);
    if (!EXACT.test(p.version)) problems.push(`provider ${name}: the version is exact (1.2.3), not a range: a provider that nobody pinned is not fetched`);
    for (const [k, v] of Object.entries(p.config ?? {})) {
      if (CREDENTIAL_NAMES.test(k)) problems.push(`provider ${name}: the setting ${k} is a credential: the provider reads its credentials from the environment of the run`);
      if (findSecretLike(v).length > 0) problems.push(`provider ${name}: the setting ${k} holds what looks like a secret`);
    }
  }
  if (o.backend !== undefined) {
    if (!/^[a-z0-9]+$/.test(o.backend.type) || o.backend.type === "local") problems.push("the backend is a remote one (s3, azurerm, gcs, http, ...): the local state is the stateDir's");
    for (const [k, v] of Object.entries(o.backend.config)) {
      if (CREDENTIAL_NAMES.test(k)) problems.push(`the backend setting ${k} is a credential: the backend reads its credentials from the environment of the run`);
      if (findSecretLike(v).length > 0) problems.push(`the backend setting ${k} holds what looks like a secret`);
    }
  }
  return problems;
}

/** What one requirement renders to: its address in OpenTofu and its resource block. */
type Resource = { readonly id: string; readonly type: string; readonly name: string; readonly provider: string; readonly settings: Obj; readonly absent: boolean; readonly dependsOn: readonly string[] };

function secretReferences(v: JsonValue, path: string, out: string[]): void {
  if (typeof v === "string") {
    if (v.startsWith("secret:")) out.push(path);
  } else if (Array.isArray(v)) v.forEach((x, i) => secretReferences(x, `${path}[${i}]`, out));
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) secretReferences(x, `${path}.${k}`, out);
}

/** The resources of an order, or every reason it cannot be rendered. */
export function resourcesOf(order: Order, o: OpenTofuOptions): Result<readonly Resource[], readonly string[]> {
  const problems: string[] = [];
  const byId = new Map<string, string>();
  const parsed: { r: Requirement; type: string; name: string; provider: string; settings: Obj }[] = [];
  const seen = new Set<string>();
  for (const r of order.requirements) {
    if (!(KINDS_CARRIED as readonly string[]).includes(String(r.kind))) {
      problems.push(`${r.id}: the kind ${String(r.kind)} is not carried by this dialect (${KINDS_CARRIED.join(", ")})`);
      continue;
    }
    const found = findSecretLike(r.desired);
    if (found.length > 0) problems.push(`${r.id}: desired holds what looks like a secret`);
    if (!isObj(r.desired)) {
      problems.push(`${r.id}: desired is { provider, type, name, settings }`);
      continue;
    }
    const d = r.desired;
    const provider = typeof d["provider"] === "string" ? d["provider"] : undefined;
    const type = typeof d["type"] === "string" ? d["type"] : undefined;
    const name = typeof d["name"] === "string" ? d["name"] : undefined;
    const settings = d["settings"] === undefined ? {} : isObj(d["settings"]) ? d["settings"] : undefined;
    if (provider === undefined || !(provider in o.providers)) problems.push(`${r.id}: desired.provider is one of ${Object.keys(o.providers).join(", ") || "(no provider is pinned)"}: a provider nobody pinned is not used`);
    if (type === undefined || !TYPE.test(type) || (provider !== undefined && !type.startsWith(`${provider}_`))) problems.push(`${r.id}: desired.type is the provider's resource type (${provider ?? "aws"}_...)`);
    if (name === undefined || !NAME.test(name)) problems.push(`${r.id}: desired.name is lower case letters, digits, hyphens and underscores`);
    if (settings === undefined) problems.push(`${r.id}: desired.settings is an object`);
    if (provider === undefined || type === undefined || name === undefined || settings === undefined) continue;
    for (const k of Object.keys(settings)) {
      if (FORBIDDEN_SETTINGS.has(k)) problems.push(`${r.id}: the setting ${k} is not carried: ${k === "provisioner" || k === "connection" ? "it runs code on the machine that runs OpenTofu" : "the order says it (dependencies) or the dialect does (the provider, the lifecycle)"}`);
      if (CREDENTIAL_NAMES.test(k)) problems.push(`${r.id}: the setting ${k} is a credential: sensitive settings are not carried yet, and a credential is never in a resource`);
    }
    const refs: string[] = [];
    secretReferences(settings, "settings", refs);
    if (refs.length > 0) problems.push(`${r.id}: ${refs.join(", ")} refer to a secret: a secret is never in a render, and sensitive settings are not carried yet`);
    const address = `${type}.${name}`;
    if (seen.has(address)) problems.push(`${r.id}: ${address} is stated twice`);
    seen.add(address);
    byId.set(String(r.id), address);
    parsed.push({ r, type, name, provider, settings });
  }
  if (problems.length > 0) return err(problems);
  return ok(parsed.map((p) => ({ id: String(p.r.id), type: p.type, name: p.name, provider: p.provider, settings: p.settings, absent: p.r.ensure === "absent", dependsOn: p.r.dependsOn.flatMap((d) => (byId.has(String(d)) ? [byId.get(String(d)) as string] : [])) })));
}

/** The configuration of an order, in OpenTofu's JSON syntax, as an object whose keys are in order. */
export function configurationOf(resources: readonly Resource[], o: OpenTofuOptions): Obj {
  const used = [...new Set(resources.filter((r) => !r.absent).map((r) => r.provider))].sort();
  const resource: { [type: string]: { [name: string]: Obj } } = {};
  for (const r of resources.filter((x) => !x.absent)) {
    resource[r.type] = { ...(resource[r.type] ?? {}), [r.name]: { ...r.settings, ...(r.dependsOn.length > 0 ? { depends_on: [...r.dependsOn] } : {}) } };
  }
  const providers = Object.fromEntries(used.map((p) => [p, [o.providers[p]?.config ?? {}]]));
  return {
    "//": "GENERATED by archon; do not edit",
    terraform: {
      required_version: `= ${o.version ?? PINNED_VERSION}`,
      required_providers: Object.fromEntries(used.map((p) => [p, { source: o.providers[p]?.source ?? "", version: `= ${o.providers[p]?.version ?? ""}` }])),
      backend: o.backend === undefined ? { local: { path: `${o.stateDir}/terraform.tfstate` } } : { [o.backend.type]: o.backend.config },
    },
    ...(used.length > 0 ? { provider: providers } : {}),
    ...(Object.keys(resource).length > 0 ? { resource } : {}),
  } as Obj;
}

/** The dialect, as the port of Archon takes it. */
export function opentofu(options: OpenTofuOptions): Dialect {
  const root = options.renderRoot ?? ".archon";
  const version = options.version ?? PINNED_VERSION;
  const bad = optionProblems(options);
  return {
    id: must(parseDialectId(DIALECT_ID)),
    tool: { name: "opentofu", version },
    guarantees: { kinds: KINDS_CARRIED.map((k) => must(parseKindId(k))), subjects: ["cloud-account"], plan: "faithful", idempotence: "unproven", destroy: true },
    render: async (order: Order, _plan: Plan) => {
      if (bad.length > 0) return err(bad);
      const resources = resourcesOf(order, options);
      if (resources.kind === "err") return resources;
      const config = canonicalJson(configurationOf(resources.value, options) as JsonValue);
      return renderedOf(new Map([["opentofu/main.tf.json", `${JSON.stringify(JSON.parse(config), null, 2)}\n`]]));
    },
    steps: (plan: Plan, rendered: Rendered): readonly DialectStep[] => {
      if (rendered.files.get("opentofu/main.tf.json") === undefined || bad.length > 0) return [];
      const covers = plan.entries.filter((e) => String(e.kind) === "cloud-resource" && (e.action === "create" || e.action === "update" || e.action === "remove")).map((e) => e.id);
      if (covers.length === 0) return [];
      const dir = `${root}/${rendered.digest}/opentofu`;
      const work = `${options.stateDir}/${rendered.digest}`;
      const tofu = (...args: readonly string[]): readonly string[] => ["env", `TF_DATA_DIR=${work}/data`, "TF_IN_AUTOMATION=1", "tofu", `-chdir=${dir}`, ...args];
      const init = tofu("init", "-input=false");
      const planFile = `${work}/plan.tfplan`;
      return [
        { covers: [], summary: `initialize OpenTofu ${version} with the pinned providers (it changes no cloud resource)`, apply: init, check: init },
        { covers, summary: `apply the saved plan of ${covers.length} cloud resource${covers.length === 1 ? "" : "s"} with OpenTofu ${version}`, apply: tofu("apply", "-input=false", planFile), check: tofu("plan", "-input=false", "-lock=true", "-detailed-exitcode", `-out=${planFile}`), changedExit: 2 },
      ];
    },
  };
}

/** What OpenTofu would do to one resource. */
export type PlannedChange = { readonly address: string; readonly actions: readonly string[] };

/** The changes of `tofu show -json <plan>`, or why the text is not that. */
export function changesOf(showJson: string): Result<readonly PlannedChange[], string> {
  let doc: unknown;
  try {
    doc = JSON.parse(showJson);
  } catch {
    return err("the plan is not JSON: it is the output of `tofu show -json` of the saved plan");
  }
  const rc = typeof doc === "object" && doc !== null ? (doc as { resource_changes?: unknown }).resource_changes : undefined;
  if (!Array.isArray(rc)) return err("the plan has no resource_changes: it is not the output of `tofu show -json` of a plan");
  const out: PlannedChange[] = [];
  for (const c of rc as { address?: unknown; change?: { actions?: unknown } }[]) {
    const actions = c.change?.actions;
    if (typeof c.address !== "string" || !Array.isArray(actions)) return err("a resource change has no address or no actions");
    if ((actions as unknown[]).every((a) => a === "no-op" || a === "read")) continue;
    out.push({ address: c.address, actions: (actions as unknown[]).map(String) });
  }
  return ok(out.sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0)));
}

/** The digest of what a plan would do: the addresses and the actions, and nothing of the values (a plan holds the secrets of what it makes). It is the hash an approval names. */
export async function planDigest(changes: readonly PlannedChange[]): Promise<string> {
  return await sha256(canonicalJson(changes.map((c) => ({ address: c.address, actions: [...c.actions] })) as unknown as JsonValue));
}

/** What a plan does that the order did not ask for: a resource it would destroy or replace that no requirement asks to remove or replace, and a change to a resource no requirement states (which the state holds and the configuration no longer does). */
export function checkPlan(order: Order, changes: readonly PlannedChange[]): readonly string[] {
  const problems: string[] = [];
  const stated = new Map<string, Requirement>();
  for (const r of order.requirements) {
    const d = r.desired;
    if (isObj(d) && typeof d["type"] === "string" && typeof d["name"] === "string") stated.set(`${d["type"]}.${d["name"]}`, r);
  }
  for (const c of changes) {
    const r = stated.get(c.address);
    const destroys = c.actions.includes("delete");
    if (r === undefined) {
      problems.push(`${c.address} is in the state and in no requirement: OpenTofu would ${c.actions.join(" and ")} it (a resource that was removed from the order is removed with a requirement that says it is absent)`);
    } else if (destroys && r.ensure !== "absent" && r.change !== "destructive") {
      problems.push(`${c.address} would be ${c.actions.includes("create") ? "replaced" : "destroyed"} and ${r.id} does not ask for it: a change that destroys is declared destructive in the requirement`);
    } else if (!destroys && r.ensure === "absent") {
      problems.push(`${c.address} is to be absent (${r.id}) and the plan would ${c.actions.join(" and ")} it`);
    }
  }
  return problems;
}

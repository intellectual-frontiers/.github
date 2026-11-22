// Spec: 0005-planning-surfaces FR-001
// Spec: 0005-planning-surfaces FR-002
/**
 * The configuration of Planning (0037-planning FR-037, FR-045): a typed value a repository writes in `planning.config.ts` with `definePlanning` (the identity, as `defineConfig` of `repoctl` is), and `parsePlanning`,
 * the one reader, which returns a `Result` that names the field of a bad value and refuses a field that is not in the type. This is the pure part: the file is imported by the physical layer, and JSON or YAML is never read.
 * With it, who runs the work: `contextOf` takes the person a session, an argument or the configuration names, in that order, and says which, so that an agent's principal is established and never guessed.
 *
 * @example
 * ```ts
 * import { definePlanning, parsePlanning } from "./config.ts";
 * const c = definePlanning({ store: { place: "planning/" }, sources: [{ name: "markdown", place: "docs/" }] });
 * parsePlanning(c).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { AUTHORITY_FIELDS, type AuthorityField, type FieldAuthority, fieldAuthority, person, type PersonActor, type RunContext } from "@intellectual-frontiers/planning/governance";

/** A source of the configuration: its name and where it reads. */
export type SourceConfig =
  | { readonly name: "markdown"; readonly place: string }
  | { readonly name: "comments"; readonly place: string; readonly markers?: readonly string[]; readonly anchors?: readonly string[] }
  | { readonly name: "issues"; readonly place: string; readonly scope: string }
  | { readonly name: "event-files"; readonly place: string }
  | { readonly name: "githost"; readonly place: string; readonly issues?: readonly number[]; readonly repo?: string };

/** The formats a rendering may be in. */
export type RenderFormat = "markdown" | "json5";

/** The configuration of a repository. */
export type PlanningConfig = {
  /** Who runs the work: an argument of the run overrides it. */
  readonly principal?: { readonly id: string; readonly name?: string };
  /** `any-person` (the default) or `principal`: who confirms a proposal. */
  readonly confirmers?: "any-person" | "principal";
  /** Where the store of events is: a folder of the repository. */
  readonly store: { readonly place: string };
  readonly sources: readonly SourceConfig[];
  /** The authority over each field. */
  readonly authority?: { readonly [F in AuthorityField]?: FieldAuthority };
  readonly duplicates?: { readonly threshold: number };
  readonly clock?: { readonly maxDriftMs: number };
  /** The ids that are agents acting for a person (0037-planning FR-044). */
  readonly agents?: { readonly [id: string]: { readonly actsFor: string } };
  /** Whether the author of a commit with a `Co-Authored-By` trailer is the principal of an agent's event (0037-planning FR-045). */
  readonly commitAuthorRule?: boolean;
  readonly render?: readonly RenderFormat[];
};

/** The identity: it only gives the type to the value written. */
export const definePlanning = (config: PlanningConfig): PlanningConfig => config;

/** Why a value is not a configuration: the path of the field and what was expected. */
export type ConfigProblem = { readonly path: string; readonly expected: string };

const bad = (path: string, expected: string): { readonly kind: "err"; readonly error: ConfigProblem } => err({ path, expected });
const isObject = (v: unknown): v is { readonly [key: string]: unknown } => typeof v === "object" && v !== null && !Array.isArray(v);
const isTexts = (v: unknown): v is readonly string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function unknownKeys(path: string, o: { readonly [key: string]: unknown }, known: readonly string[]): ConfigProblem | undefined {
  const extra = Object.keys(o).find((k) => !known.includes(k));
  return extra === undefined ? undefined : { path: path === "" ? extra : `${path}.${extra}`, expected: `one of ${known.join(", ")}: a field the configuration does not have` };
}

function sourceOf(v: unknown, path: string): Result<SourceConfig, ConfigProblem> {
  if (!isObject(v)) return bad(path, "an object with a name and a place");
  const name = v["name"];
  const place = v["place"];
  if (typeof place !== "string" || place === "") return bad(`${path}.place`, "a non-empty text: where the source reads");
  switch (name) {
    case "markdown":
    case "event-files": {
      const extra = unknownKeys(path, v, ["name", "place"]);
      return extra === undefined ? ok({ name, place }) : err(extra);
    }
    case "comments": {
      const extra = unknownKeys(path, v, ["name", "place", "markers", "anchors"]);
      if (extra !== undefined) return err(extra);
      if (v["markers"] !== undefined && !isTexts(v["markers"])) return bad(`${path}.markers`, "a list of text");
      if (v["anchors"] !== undefined && !isTexts(v["anchors"])) return bad(`${path}.anchors`, "a list of text: the folders an anchor may be written to");
      return ok({ name, place, ...(isTexts(v["markers"]) ? { markers: v["markers"] } : {}), ...(isTexts(v["anchors"]) ? { anchors: v["anchors"] } : {}) });
    }
    case "issues": {
      const extra = unknownKeys(path, v, ["name", "place", "scope"]);
      if (extra !== undefined) return err(extra);
      return typeof v["scope"] === "string" && v["scope"] !== "" ? ok({ name, place, scope: v["scope"] }) : bad(`${path}.scope`, "a non-empty text: the library the issues are of");
    }
    case "githost": {
      const extra = unknownKeys(path, v, ["name", "place", "issues", "repo"]);
      if (extra !== undefined) return err(extra);
      const issues = v["issues"];
      if (issues !== undefined && !(Array.isArray(issues) && issues.every((n) => Number.isInteger(n) && n > 0))) return bad(`${path}.issues`, "a list of issue numbers");
      if (v["repo"] !== undefined && typeof v["repo"] !== "string") return bad(`${path}.repo`, "a text: the folder of a clone");
      return ok({ name, place, ...(Array.isArray(issues) ? { issues: issues.filter((n): n is number => typeof n === "number") } : {}), ...(typeof v["repo"] === "string" ? { repo: v["repo"] } : {}) });
    }
    default:
      return bad(`${path}.name`, "markdown, comments, issues, event-files or githost");
  }
}

/** A configuration from a value, or the field that is wrong and what it should be. */
export function parsePlanning(value: unknown): Result<PlanningConfig, ConfigProblem> {
  if (!isObject(value)) return bad("", "an object");
  const extra = unknownKeys("", value, ["principal", "confirmers", "store", "sources", "authority", "duplicates", "clock", "agents", "commitAuthorRule", "render"]);
  if (extra !== undefined) return err(extra);
  const store = value["store"];
  if (!isObject(store) || typeof store["place"] !== "string" || store["place"] === "") return bad("store.place", "a non-empty text: the folder of the store of events");
  const list = value["sources"];
  if (!Array.isArray(list)) return bad("sources", "a list of sources");
  const sources: SourceConfig[] = [];
  for (const [i, s] of list.entries()) {
    const r = sourceOf(s, `sources[${i}]`);
    if (r.kind === "err") return r;
    sources.push(r.value);
  }
  const out: { -readonly [K in keyof PlanningConfig]: PlanningConfig[K] } = { store: { place: store["place"] }, sources };
  const p = value["principal"];
  if (p !== undefined) {
    if (!isObject(p) || typeof p["id"] !== "string" || p["id"] === "" || (p["name"] !== undefined && typeof p["name"] !== "string")) return bad("principal", "an object with an id and optionally a name");
    out.principal = { id: p["id"], ...(typeof p["name"] === "string" ? { name: p["name"] } : {}) };
  }
  const c = value["confirmers"];
  if (c !== undefined) {
    if (c !== "any-person" && c !== "principal") return bad("confirmers", "any-person or principal");
    out.confirmers = c;
  }
  const a = value["authority"];
  if (a !== undefined) {
    if (!isObject(a)) return bad("authority", "an object of fields to authorities");
    const authority: { [F in AuthorityField]?: FieldAuthority } = {};
    for (const [k, v] of Object.entries(a)) {
      const field = AUTHORITY_FIELDS.find((f) => f === k);
      if (field === undefined) return bad(`authority.${k}`, `one of ${AUTHORITY_FIELDS.join(", ")}`);
      const au = fieldAuthority.parse(v);
      if (au.kind === "err") return bad(`authority.${k}`, "source-wins, store-wins, latest-wins or person-only");
      authority[field] = au.value;
    }
    out.authority = authority;
  }
  const d = value["duplicates"];
  if (d !== undefined) {
    if (!isObject(d) || typeof d["threshold"] !== "number" || d["threshold"] < 0 || d["threshold"] > 1) return bad("duplicates.threshold", "a number from 0 to 1");
    out.duplicates = { threshold: d["threshold"] };
  }
  const k = value["clock"];
  if (k !== undefined) {
    if (!isObject(k) || typeof k["maxDriftMs"] !== "number" || !(k["maxDriftMs"] >= 0)) return bad("clock.maxDriftMs", "a number of milliseconds, zero or more");
    out.clock = { maxDriftMs: k["maxDriftMs"] };
  }
  const ag = value["agents"];
  if (ag !== undefined) {
    if (!isObject(ag)) return bad("agents", "an object of agent ids to who they act for");
    const agents: { [id: string]: { readonly actsFor: string } } = {};
    for (const [id, v] of Object.entries(ag)) {
      if (!isObject(v) || typeof v["actsFor"] !== "string" || v["actsFor"] === "") return bad(`agents.${id}.actsFor`, "the id of a person");
      agents[id] = { actsFor: v["actsFor"] };
    }
    out.agents = agents;
  }
  if (value["commitAuthorRule"] !== undefined) {
    if (typeof value["commitAuthorRule"] !== "boolean") return bad("commitAuthorRule", "true or false");
    out.commitAuthorRule = value["commitAuthorRule"];
  }
  const r = value["render"];
  if (r !== undefined) {
    if (!Array.isArray(r) || !r.every((x): x is RenderFormat => x === "markdown" || x === "json5")) return bad("render", "a list of markdown or json5");
    out.render = r;
  }
  return ok(out);
}

/** The person a configuration names as the principal, or none. */
export function principalOf(config: Pick<PlanningConfig, "principal">): PersonActor | undefined {
  if (config.principal === undefined) return undefined;
  const p = person(config.principal.id, config.principal.name ?? config.principal.id);
  return p.kind === "ok" ? p.value : undefined;
}

/** What names who runs the work. */
export type WhoRuns = { readonly session?: PersonActor; readonly argument?: PersonActor; readonly configuration?: PersonActor };

/** The context of a run: the person of the session where there is one (a tool server's), else the person an argument names, else the configuration's; none where nothing names one. An argument overrides the configuration, and a tool server takes only its session. */
export function contextOf(who: WhoRuns): RunContext {
  if (who.session !== undefined) return { kind: "session", person: who.session };
  if (who.argument !== undefined) return { kind: "argument", person: who.argument };
  if (who.configuration !== undefined) return { kind: "configuration", person: who.configuration };
  return { kind: "none" };
}

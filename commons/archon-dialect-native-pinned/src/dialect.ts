// Spec: 0004-native-pinned-dialect FR-001, FR-002, FR-003
/**
 * The dialect: its guarantees as data (for Archon and for Toolchain), the plan file it renders from an order and a plan, the steps that check and apply it through the program of the dialect, and
 * the observation that gives Archon what is installed. A tool that is installed as pinned is observed as its own desired state, so that Archon's plan says nothing is to be done.
 *
 * @example
 * ```ts
 * import { nativePinned } from "./dialect.ts";
 * // nativePinned({ policy }).guarantees.destroy === true
 * ```
 *
 * @module
 */
import { parseDialectId, parseKindId, type JsonValue, type Requirement, type RequirementId } from "@intellectual-frontiers/archon/governance";
import { renderedOf, type Dialect, type DialectStep, type Rendered } from "@intellectual-frontiers/archon/dialect";
import type { Order, Plan } from "@intellectual-frontiers/archon/logical";
import { actionFor, type ToolDialect } from "@intellectual-frontiers/toolchain/logical";
import * as path from "@intellectual-frontiers/system/path";
import * as proc from "@intellectual-frontiers/system/proc";
import { planFileText, type JobSource, type PlanFile, type Policy, type ToolJob } from "./plan-file.ts";
import { askWithin, observeJob, type Ask } from "./observe.ts";
import { platformHere, type Store } from "./store.ts";

/** The id of the dialect. */
export const DIALECT_ID = "native-pinned";

function must<T>(r: { readonly kind: "ok"; readonly value: T } | { readonly kind: "err"; readonly error: string }): T {
  if (r.kind === "err") throw new Error(r.error);
  return r.value;
}

/** The dialect as Toolchain reads it: how exactly it pins, how it checks, where it installs, what it reaches, and that it never builds from source. */
export const TOOL_DIALECT: ToolDialect = {
  id: must(parseDialectId(DIALECT_ID)),
  guarantees: {
    pin: "exact",
    integrity: "hash",
    scopes: ["user"],
    platforms: ["linux-x64", "linux-arm64", "macos-x64", "macos-arm64", "windows-x64"],
    binds: "pin",
    sourceBuild: false,
  },
};

function isRecord(v: JsonValue | undefined): v is { readonly [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function textsOf(v: JsonValue | undefined): readonly string[] {
  return Array.isArray(v) ? v.flatMap((x) => (typeof x === "string" ? [x] : [])) : [];
}

/** The job a tool requirement of Toolchain asks of this dialect, or nothing where it asks another dialect or is not one. */
export function jobOf(r: Requirement): ToolJob | undefined {
  const d = r.desired;
  if (r.kind !== "tool" || !isRecord(d) || d["dialect"] !== DIALECT_ID) return undefined;
  const source = d["source"];
  const tool = d["tool"];
  const program = d["program"];
  if (typeof tool !== "string" || typeof program !== "string" || !isRecord(source) || source["kind"] !== "download") return undefined;
  const { pin, version, downloadUrl, sha256, archiveFormat, binPath } = source;
  if (typeof pin !== "string" || typeof version !== "string" || typeof downloadUrl !== "string" || typeof sha256 !== "string" || typeof binPath !== "string") return undefined;
  if (archiveFormat !== "zip" && archiveFormat !== "tar" && archiveFormat !== "file") return undefined;
  const v = d["version"];
  const min = d["minimum"];
  const jobSource: JobSource = { kind: "download", pin, version, downloadUrl, sha256, archiveFormat, binPath };
  return { tool, version: typeof v === "string" ? v : null, program, alsoNamed: textsOf(d["alsoNamed"]), versionArgs: textsOf(d["versionArgs"]), minimum: typeof min === "string" ? min : null, source: jobSource };
}

/** What a dialect is made with. */
export type DialectOptions = {
  readonly policy: Policy;
  /** The platform the tools are installed on; this computer's by default. */
  readonly platform?: string;
  /** The folder the files of a render are written in, below the working folder; `.archon` by default. */
  readonly renderRoot?: string;
};

/** The program of the dialect, next to this file with the same extension (the source in the repository, the compiled file in the package). */
function programPath(): string {
  const ext = path.extname(import.meta.url) || ".ts";
  return path.fromFileUrl(new URL(`./bin${ext}`, import.meta.url));
}

/** The dialect, as the port of Archon takes it. */
export function nativePinned(o: DialectOptions): Dialect {
  const root = o.renderRoot ?? ".archon";
  const platform = o.platform ?? platformHere() ?? "unknown";
  return {
    id: must(parseDialectId(DIALECT_ID)),
    tool: { name: "archon-dialect-native-pinned", version: "built-in" },
    guarantees: { kinds: [must(parseKindId("tool"))], subjects: ["machine", "workstation"], plan: "faithful", idempotence: "proven", destroy: true },
    render: (order: Order, plan: Plan) => {
      const changing = new Set(plan.entries.filter((e) => e.action === "create" || e.action === "update").map((e) => e.id));
      const jobs = order.requirements.filter((r) => changing.has(r.id)).flatMap((r) => {
        const j = jobOf(r);
        return j === undefined ? [] : [j];
      });
      const file: PlanFile = { format: "native-pinned-plan/1", platform, policy: o.policy, jobs };
      return renderedOf(new Map([["native-pinned/plan.json", planFileText(file)]]));
    },
    steps: (plan: Plan, rendered: Rendered): readonly DialectStep[] => {
      const covers: RequirementId[] = plan.entries.filter((e) => (e.action === "create" || e.action === "update") && e.kind === "tool").map((e) => e.id);
      if (covers.length === 0) return [];
      const file = `${root}/${rendered.digest}/native-pinned/plan.json`;
      const run = (mode: "apply" | "check"): readonly string[] => [proc.execPath(), programPath(), mode, file];
      return [{ covers, summary: `install ${covers.length} tool${covers.length === 1 ? "" : "s"} as pinned`, apply: run("apply"), check: run("check"), changedExit: 2 }];
    },
  };
}

/** What Archon is given of what is installed: the desired state itself for a tool that is installed as pinned, a state that differs for one that is installed otherwise, nothing for one that is absent. */
export async function observeRequirements(requirements: readonly Requirement[], store: Store, o: { readonly policy: Policy; readonly path?: string | undefined; readonly ask?: Ask }): Promise<ReadonlyMap<RequirementId, JsonValue>> {
  const out = new Map<RequirementId, JsonValue>();
  for (const r of requirements) {
    const job = jobOf(r);
    if (job === undefined) continue;
    const seen = await observeJob(job, store, { path: o.path, ask: o.ask ?? askWithin(5000) });
    const action = actionFor({ seen: seen.seen, version: job.version ?? undefined, minimum: job.minimum ?? undefined, systemCopy: o.policy.systemCopy, integrity: o.policy.integrity });
    if (action === "none") out.set(r.id, r.desired);
    else if (seen.seen !== undefined && isRecord(r.desired)) out.set(r.id, { ...r.desired, version: seen.seen.version, installedFrom: seen.seen.from });
  }
  return out;
}

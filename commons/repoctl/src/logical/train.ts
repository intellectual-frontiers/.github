// Spec: 0017-repoctl-release-train FR-003
/**
 * The release train (commons repoctl 0017-repoctl-release-train): what a person walks in order after a release is made, as pure functions of values and of the ports of the world. `handoffOf` says whether the release may be published
 * (the record is tracked, the tree has no change, the commit is on `origin/main`), `pinsOf` finds the exact pins of the packages of a release in the manifests of a consumer, `repinned` writes them, `checksOf` reads what a consumer
 * says it checks, and `reportText` is the one summary. Nothing here publishes, tags, commits or pushes.
 *
 * @example
 * ```ts
 * import { pinsOf } from "./train.ts";
 * pinsOf("package.json", '{"dependencies":{"@x/a":"1.0.0"}}', [{ package: "@x/a", version: "1.1.0" }]).kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Finding, finding } from "./findings.ts";
import type { World } from "./ports.ts";
import { compareSemver } from "./semver.ts";

/** The package of a release and the version of it the record names. */
export type Released = { readonly package: string; readonly version: string };

/** The sections of a manifest that hold dependencies. */
const SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

/** A pin that moves: the manifest, the package and the version it has and will have. */
export type Pin = { readonly file: string; readonly package: string; readonly from: string; readonly to: string };

const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** The folder of a file from the root, `.` for the root's own. */
export const folderOf = (file: string): string => (file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".");

/** Whether a folder is `scope` or under it (`.` is every folder). */
export const underFolder = (folder: string, scope: string): boolean => scope === "." || folder === scope || folder.startsWith(`${scope.replace(/\/$/, "")}/`);

/** The pins of the packages of a release in the text of a manifest that move: an exact version below the record's. A range, a link, a workspace reference or a version at or above the record's is left alone. */
export function pinsOf(file: string, text: string, released: readonly Released[]): Result<readonly Pin[], string> {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return err(`${file} is not JSON`);
  }
  if (typeof doc !== "object" || doc === null) return err(`${file} is not a manifest`);
  const out: Pin[] = [];
  for (const section of SECTIONS) {
    const deps = (doc as Record<string, unknown>)[section];
    if (typeof deps !== "object" || deps === null) continue;
    for (const [name, spec] of Object.entries(deps as Record<string, unknown>)) {
      const r = released.find((x) => x.package === name);
      if (r === undefined || typeof spec !== "string" || !EXACT.test(spec) || compareSemver(spec, r.version) >= 0) continue;
      if (!out.some((p) => p.package === name)) out.push({ file, package: name, from: spec, to: r.version });
    }
  }
  return ok(out);
}

const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The text of a manifest with its pins moved: the line of each package at its old version is written with the new one, and nothing else of the text changes. */
export function repinned(text: string, pins: readonly Pin[]): string {
  let out = text;
  for (const p of pins) out = out.replace(new RegExp(`("${escaped(p.package)}"\\s*:\\s*")${escaped(p.from)}(")`, "g"), `$1${p.to}$2`);
  return out;
}

/** What a consumer says it checks: argument vectors, run with no shell from its root. */
export type ConsumerChecks = readonly (readonly string[])[];

/** The file of a consumer that declares its checks. */
export const CONSUMER_FILE = "commons-consumer.json";

/** The declaration of a consumer from the text of its file: `{ "verify": [[program, argument...], ...] }`. */
export function checksOf(text: string): Result<ConsumerChecks, string> {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return err(`${CONSUMER_FILE} is not JSON`);
  }
  const verify = typeof doc === "object" && doc !== null ? (doc as Record<string, unknown>)["verify"] : undefined;
  if (!Array.isArray(verify)) return err(`${CONSUMER_FILE} has no "verify" list`);
  const lists: string[][] = [];
  for (const v of verify) {
    if (!Array.isArray(v) || v.length === 0 || !v.every((a) => typeof a === "string" && a !== "")) return err(`${CONSUMER_FILE}: each "verify" entry is a list of words that begins with the program`);
    lists.push(v as string[]);
  }
  return ok(lists);
}

/** Where the hand-off of a release stands. */
export type Handoff =
  | { readonly kind: "ready"; readonly head: string }
  | { readonly kind: "not-committed"; readonly head: string; readonly files: readonly string[]; readonly recordTracked: boolean }
  | { readonly kind: "not-pushed"; readonly head: string };

/** The hand-off of the release in the repository: the record is tracked, the tree has no change at all, and the commit at `HEAD` is contained in `origin/main` as the checkout knows it (a refusal says which, and names the files). */
export async function handoffOf(w: World, recordPath: string): Promise<Handoff> {
  const here = { cwd: w.repo };
  const head = (await w.process.run(["git", "rev-parse", "HEAD"], here)).stdout.trim();
  const tracked = (await w.process.run(["git", "ls-files", "--error-unmatch", "--", recordPath], here)).code === 0;
  const status = (await w.process.run(["git", "status", "--porcelain", "--untracked-files=all"], here)).stdout;
  const files = status
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => l.slice(3));
  if (!tracked || files.length > 0) return { kind: "not-committed", head, files, recordTracked: tracked };
  const contained = (await w.process.run(["git", "merge-base", "--is-ancestor", "HEAD", "origin/main"], here)).code === 0;
  return contained ? { kind: "ready", head } : { kind: "not-pushed", head };
}

/** The findings of a hand-off that is refused, and none where it is ready. */
export function findingsOfHandoff(h: Handoff, recordPath: string): readonly Finding[] {
  if (h.kind === "ready") return [];
  if (h.kind === "not-pushed") return [finding("fail", "E-TRAIN-NOT-PUSHED", `the commit ${h.head.slice(0, 8)} is not contained in origin/main as this checkout knows it`, "git push origin HEAD:main")];
  const what = h.recordTracked ? "" : `${recordPath} is not tracked by Git; `;
  return [finding("fail", "E-TRAIN-NOT-COMMITTED", `${what}${h.files.length} file${h.files.length === 1 ? "" : "s"} changed in the working tree${h.files.length > 0 ? `: ${h.files.slice(0, 8).join(", ")}${h.files.length > 8 ? ", ..." : ""}` : ""}`, "repoctl commit")];
}

/** The state of a pin in the summary. */
export type PinState = "moved" | "current" | "waiting" | "failed" | "planned";

/** One verify command of a consumer and how it ended. */
export type Verified = { readonly argv: readonly string[]; readonly code: number };

/** What the train did for one consumer. */
export type ConsumerReport = {
  readonly dir: string;
  readonly pins: readonly (Pin & { readonly state: PinState })[];
  readonly declared: boolean;
  readonly verify: readonly Verified[];
  readonly note: string | undefined;
};

/** The whole report of a run. */
export type TrainReport = {
  readonly release: { readonly state: "applied" | "waiting" | "nothing" | "planned"; readonly packages: readonly Released[] };
  readonly handoff: Handoff | { readonly kind: "not-reached"; readonly why: string };
  readonly consumers: readonly ConsumerReport[];
};

const packagesLine = (r: readonly Released[]): string => (r.length === 0 ? "nothing" : r.map((p) => `${p.package} ${p.version}`).join(", "));

/** The summary for a person: a row for each phase and each pin, and each verify command with its status. */
export function reportText(r: TrainReport): string {
  const rel = { applied: "made", waiting: "made before and waiting for its publication", nothing: "nothing to release", planned: "would be made" }[r.release.state];
  const hand =
    r.handoff.kind === "ready"
      ? `ready: ${r.handoff.head.slice(0, 8)} holds the record and is on origin/main; publishing is the step of a person`
      : r.handoff.kind === "not-committed"
        ? `refused: ${r.handoff.recordTracked ? "" : "the record is not tracked; "}${r.handoff.files.length} changed file${r.handoff.files.length === 1 ? "" : "s"}`
        : r.handoff.kind === "not-pushed"
          ? `refused: ${r.handoff.head.slice(0, 8)} is not on origin/main`
          : `not reached: ${r.handoff.why}`;
  const lines = [`release    ${rel} (${packagesLine(r.release.packages)})`, `hand-off   ${hand}`];
  if (r.consumers.length === 0) lines.push("pins       no consumer was given (--consumer DIR)");
  for (const c of r.consumers) {
    lines.push(`consumer   ${c.dir}${c.note === undefined ? "" : `  (${c.note})`}`);
    for (const p of c.pins) lines.push(`  pin      ${p.state.padEnd(8)} ${p.file}  ${p.package} ${p.from} -> ${p.to}`);
    if (c.pins.length === 0) lines.push("  pin      current  nothing to move");
    if (c.pins.length > 0 && c.pins.every((p) => p.state === "moved") && !c.declared) lines.push("  check    declares no check");
    for (const v of c.verify) lines.push(`  check    ${v.code === 0 ? "passed  " : `failed ${v.code}`} ${v.argv.join(" ")}`);
  }
  return lines.join("\n");
}

/** The data of the report for `--json`. */
export function reportData(r: TrainReport): unknown {
  return {
    release: r.release,
    handoff: r.handoff,
    consumers: r.consumers.map((c) => ({ dir: c.dir, declared: c.declared, note: c.note ?? null, pins: c.pins, verify: c.verify })),
  };
}

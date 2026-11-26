// Spec: 0007-workbench-operate FR-001, FR-003, FR-009
/**
 * The operate plan: what the one command that sets a repository up for its operator needs to know, as data. A product supplies its name, the pinned download of Bun for each Linux platform, the name of the variable that holds the
 * token that reads its registry, the steps that follow the install (each a check and a run, argument vectors and never a shell line) and what to do next. It is decoded where it is made, with every reason at once: a credential is a
 * name and never a value, a download is `https` with a SHA-256, a command is words of a safe alphabet.
 *
 * @example
 * ```ts
 * import { defineOperate } from "./operate.ts";
 * const made = defineOperate({ name: "Demo", slug: "demo", bun: { version: "1.4.4", minimum: "1.4.4", pins: [] }, registry: { scope: "@demo", tokenEnv: "NODE_AUTH_TOKEN" }, converge: [], next: { say: "Next", argv: ["bun", "run", "demo"] } });
 * made.kind; // "ok"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";

/** The two Linux platforms a pinned download of Bun exists for. */
export const PIN_PLATFORMS = ["linux-x64", "linux-arm64"] as const;
/** One of them. */
export type PinPlatform = (typeof PIN_PLATFORMS)[number];

/** A pinned download of Bun: the zip, its SHA-256, and the folder inside the zip that holds `bun`. */
export type BunPin = { readonly platform: PinPlatform; readonly url: string; readonly sha256: string; readonly entry: string };

/** A step after the install: `run` only where `check` fails, and `check` must hold afterwards. */
export type ConvergeStep = { readonly id: string; readonly say: string; readonly check: readonly string[]; readonly run: readonly string[] };

/** The operate plan. */
export type OperateSpec = {
  /** What a person calls the product (`Opsfolio`). */
  readonly name: string;
  /** A plain word: the folder of the stamp and the prefix of the variables (`opsfolio`). */
  readonly slug: string;
  /** The Bun the scripts leave or install: `minimum` is the oldest left as it is, `version` the one installed, with a pin for each platform that has one. */
  readonly bun: { readonly version: string; readonly minimum: string; readonly pins: readonly BunPin[] };
  /** The registry the install reads: its scope and the NAME of the variable that holds the token. */
  readonly registry: { readonly scope: string; readonly tokenEnv: string };
  /** The steps after the install, in order. */
  readonly converge: readonly ConvergeStep[];
  /** The one thing the person does next: what to say and the command. */
  readonly next: { readonly say: string; readonly argv: readonly string[] };
};

/** The ids of the steps every operate script has before the converge steps of the plan, in order. */
export const FIXED_STEPS = ["git", "gh", "bun", "sign-in", "update", "install"] as const;

const WORD = /^[A-Za-z0-9_@%+=:,./-]+$/u;
const NAME = /^[A-Za-z][A-Za-z0-9 .-]{0,39}$/u;
const SLUG = /^[a-z][a-z0-9-]{0,31}$/u;
const VERSION = /^\d+\.\d+\.\d+$/u;
const SHA = /^[0-9a-f]{64}$/u;
const ENV = /^[A-Z_][A-Z0-9_]*$/u;
const SCOPE = /^@[a-z][a-z0-9-]*$/u;
const STEP_ID = /^[a-z][a-z0-9-]*$/u;
const SAY = /^[\x20-\x7e]{1,120}$/u;
const SECRET = /(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16})/u;

const compare = (a: string, b: string): number => {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  return 0;
};

const argvProblems = (what: string, argv: readonly string[]): readonly string[] => (argv.length === 0 ? [`${what}: empty`] : argv.filter((w) => !WORD.test(w)).map((w) => `${what}: the word ${JSON.stringify(w.slice(0, 24))} is outside the safe alphabet`));

/** Decode an operate plan, with every reason where it is refused. */
export function defineOperate(spec: OperateSpec): Result<OperateSpec, readonly string[]> {
  const problems: string[] = [];
  if (!NAME.test(spec.name)) problems.push("name: a plain name of up to 40 characters");
  if (!SLUG.test(spec.slug)) problems.push("slug: a lower-case word");
  if (!VERSION.test(spec.bun.version)) problems.push("bun.version: N.N.N");
  if (!VERSION.test(spec.bun.minimum)) problems.push("bun.minimum: N.N.N");
  if (VERSION.test(spec.bun.version) && VERSION.test(spec.bun.minimum) && compare(spec.bun.minimum, spec.bun.version) > 0) problems.push("bun.minimum: above bun.version");
  const seenPlatform = new Set<string>();
  for (const p of spec.bun.pins) {
    if (!PIN_PLATFORMS.includes(p.platform)) problems.push(`bun.pins: the platform ${JSON.stringify(String(p.platform))} is not one of ${PIN_PLATFORMS.join(", ")}`);
    if (seenPlatform.has(p.platform)) problems.push(`bun.pins: ${p.platform} twice`);
    seenPlatform.add(p.platform);
    if (!p.url.startsWith("https://") || !WORD.test(p.url)) problems.push(`bun.pins ${p.platform}: the address must be https and of the safe alphabet`);
    if (!SHA.test(p.sha256)) problems.push(`bun.pins ${p.platform}: sha256 must be 64 hexadecimal digits`);
    if (!WORD.test(p.entry)) problems.push(`bun.pins ${p.platform}: entry is a plain folder name`);
  }
  if (!SCOPE.test(spec.registry.scope)) problems.push("registry.scope: @name");
  if (!ENV.test(spec.registry.tokenEnv)) problems.push("registry.tokenEnv: the NAME of an environment variable, upper case (never a value)");
  const ids = new Set<string>(FIXED_STEPS);
  for (const s of spec.converge) {
    if (!STEP_ID.test(s.id)) problems.push(`converge: the id ${JSON.stringify(s.id)} is not a lower-case word`);
    if (ids.has(s.id)) problems.push(`converge: the id ${s.id} is a step of the library or is named twice`);
    ids.add(s.id);
    if (!SAY.test(s.say)) problems.push(`converge ${s.id}: say is printable ASCII, up to 120 characters`);
    problems.push(...argvProblems(`converge ${s.id} check`, s.check), ...argvProblems(`converge ${s.id} run`, s.run));
  }
  if (!SAY.test(spec.next.say)) problems.push("next.say: printable ASCII, up to 120 characters");
  problems.push(...argvProblems("next.argv", spec.next.argv));
  if (SECRET.test(JSON.stringify(spec))) problems.push("the plan holds text that looks like a secret: a credential is only the name of a variable");
  return problems.length === 0 ? ok(spec) : err(problems);
}

/** The ids of the steps of an operate script, in order: the fixed ones and then the converge steps of the plan. */
export const operateSteps = (spec: OperateSpec): readonly string[] => [...FIXED_STEPS, ...spec.converge.map((s) => s.id)];

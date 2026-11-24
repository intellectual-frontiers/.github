// Spec: 0004-anyfs-cli-surfaces FR-012, FR-013
/**
 * The verbs of the program that bring directories of two stores together through the bridge (commons anyfs-cli 0004-anyfs-cli-surfaces FR-012, FR-013): `sync`, `check`, `bisync` and `mirror`. Each makes a plan first
 * and prints it with its hash; nothing is changed without `--yes` (which Headless asks of a destruction), and `--plan-hash` pins the apply to the plan that was read, so a store that changed in between makes it a
 * refusal and not a surprise. The base of a two-way sync and the ledger of a mirror are small files in the state folder of the program, named by the two sides.
 *
 * @example
 * ```ts
 * import { bridgeVerbs } from "./bridge.ts";
 * // bridgeVerbs(host).map((v) => v.name); // ["sync", "check", "bisync", "mirror"]
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { branch, outcomeOf, type Command, type Context, type Node, type Outcome } from "@intellectual-frontiers/headless/logical";
import { flag, integerText, value } from "@intellectual-frontiers/terminal/args";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Path, parsePath } from "@intellectual-frontiers/anyfs/governance";
import { allowDeletes, type DeletePolicy, forbidDeletes } from "@intellectual-frontiers/anyfs-bridge/governance";
import {
  applyBisync,
  converge,
  decodeBase,
  type Dest,
  type Endpoint,
  encodeBase,

  emptyLedger,
  type Ledger,
  planBisync,
  promote,
  type ReplicaState,
  replicaStatus,
  type Source,
  type ConflictPolicy,
} from "@intellectual-frontiers/anyfs-bridge/logical";
import { counted, destOf, type Host, problemOf, refusalProblem, sourceOf, usage } from "@intellectual-frontiers/anyfs-cli/logical";
import { prefixOfBound, type Bound } from "../bind.ts";
import { bindAll, defineVerb } from "./common.ts";
import { diffOptionsOf, PLAN_OPTIONS, planTransfer, previewOutcome, railsOf, refusedOutcome, reportOutcome, runApply, staleOutcome } from "./transfer.ts";

const dry = (ctx: Context): boolean => ctx.mode !== "apply";

const parseConflict = (t: string): Result<ConflictPolicy, string> => (t === "newer-wins" || t === "keep-both" || t === "fail" ? ok(t) : err("expected newer-wins, keep-both or fail"));

/** The name of the file of the state of two sides: a digest of what they are. */
async function stateName(kind: "bisync" | "mirror", a: Bound, b: Bound): Promise<string> {
  const key = `${a.store.id}:${a.inner}|${b.store.id}:${b.inner}`;
  return `${kind}-${(await sha256(key)).slice(0, 16)}.json`;
}

/** The destination end of a word, or why it cannot be one. */
function destEnd(b: Bound): Result<Endpoint<Dest>, Outcome> {
  const store = destOf(b.store);
  const prefix = prefixOfBound(b);
  if (store === undefined) return err(outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", `${b.text}: the store ${b.store.id} cannot be a side of a two-way sync or a mirror's replica: it lacks read, write, list, stat or delete`)] }));
  if (prefix.kind === "err") return err(usage(`${b.text}: ${prefix.error}`));
  return ok({ store, prefix: prefix.value });
}

/** The source end of a word. */
function sourceEnd(b: Bound): Result<Endpoint<Source>, Outcome> {
  const store = sourceOf(b.store);
  const prefix = prefixOfBound(b);
  if (store === undefined) return err(outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", `${b.text}: the store ${b.store.id} cannot be read as a directory: it lacks read, list or stat`)] }));
  if (prefix.kind === "err") return err(usage(`${b.text}: ${prefix.error}`));
  return ok({ store, prefix: prefix.value });
}

const deletesOf = (max: number | undefined): DeletePolicy => (max === undefined ? forbidDeletes : allowDeletes(max));

const sync = (host: Host): Command =>
  defineVerb(host, {
    name: "sync",
    id: "sync",
    options: { maxDeletes: value({ parse: integerText, valueName: "N", help: "Allow the plan to delete at most N files at the destination: none without it." }), ...PLAN_OPTIONS },
    operands: [{ name: "SOURCE", help: "The directory to copy from.", arity: "one" }, { name: "DEST", help: "The directory to make equal to it.", arity: "one" }],
    examples: [{ args: ["--dry-run", "./fleet", "s3backup:/fleet"], says: "The plan: what would be created, updated and (with --max-deletes) deleted, and its hash." }, { args: ["--yes", "--plan-hash", "<hash>", "./fleet", "s3backup:/fleet"], says: "Apply exactly that plan." }],
    run: async (args, ctx) => {
      const [a, b] = args.positionals;
      if (a === undefined || b === undefined) return usage("sync needs a source and a destination");
      const bound = await bindAll(host, [a, b]);
      if (bound.kind === "err") return bound.error;
      const [src, dst] = bound.value;
      if (src === undefined || dst === undefined) return usage("sync needs a source and a destination");
      const rails = railsOf(host, args.options);
      if (rails.kind === "err") return usage(rails.error);
      const prepared = await planTransfer({ kind: "sync", deletes: deletesOf(args.options.maxDeletes) }, src, dst, diffOptionsOf(rails.value, args.options));
      if (prepared.kind === "err") return prepared.error;
      const command = `anyfs sync ${a} ${b}${args.options.maxDeletes === undefined ? "" : ` --max-deletes ${args.options.maxDeletes}`}`;
      if (dry(ctx)) return previewOutcome(prepared.value.plan, command);
      if (args.options.planHash !== undefined && args.options.planHash !== prepared.value.plan.hash) return staleOutcome(args.options.planHash, prepared.value.plan.hash);
      const applied = await runApply(prepared.value, { concurrency: args.options.concurrency ?? host.config.defaults.concurrency, verify: host.config.defaults.verify }, ctx);
      return applied.kind === "err" ? refusedOutcome(applied.error) : reportOutcome(applied.value);
    },
  });

const check = (host: Host): Command =>
  defineVerb(host, {
    name: "check",
    id: "check",
    options: { include: PLAN_OPTIONS.include, exclude: PLAN_OPTIONS.exclude },
    operands: [{ name: "A", help: "The first directory.", arity: "one" }, { name: "B", help: "The second directory.", arity: "one" }],
    examples: [{ args: ["./fleet", "s3backup:/fleet"], says: "Whether the two hold the same files with the same content; nothing is changed." }],
    run: async (args, ctx) => {
      const [a, b] = args.positionals;
      if (a === undefined || b === undefined) return usage("check needs two directories");
      const bound = await bindAll(host, [a, b]);
      if (bound.kind === "err") return bound.error;
      const [left, right] = bound.value;
      if (left === undefined || right === undefined) return usage("check needs two directories");
      const rails = railsOf(host, { include: args.options.include, exclude: args.options.exclude, maxFiles: undefined, maxBytes: undefined, lossless: false, concurrency: undefined, planHash: undefined });
      if (rails.kind === "err") return usage(rails.error);
      const prepared = await planTransfer({ kind: "check" }, left, right, diffOptionsOf(rails.value, { lossless: false }));
      if (prepared.kind === "err") return prepared.error;
      void ctx;
      const plan = prepared.value.plan;
      const differing = plan.actions.filter((x) => x.kind !== "skip");
      const base = previewOutcome(plan, `anyfs sync ${a} ${b}`);
      if (differing.length === 0) return { ...base, next: [], title: "The two are the same" };
      return { ...base, next: [`next: anyfs sync ${a} ${b} --dry-run`], problems: [problemOf("E-DIFFERENT", `${left.text} and ${right.text} differ in ${counted(differing.length, "path")}`, `anyfs sync ${a} ${b} --dry-run`)] };
    },
  });

/** A base read from the state folder: the entries as pairs, or none where there is no file. */
async function readBase(host: Host, name: string): Promise<Result<ReturnType<typeof decodeBase> extends Result<infer B, string> ? B | undefined : never, string>> {
  const text = await host.world.state.read(name);
  if (text === undefined) return ok(undefined);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return err(`${name} is not a base: it is not a list`);
    const pairs: (readonly [string, string])[] = [];
    for (const p of parsed) {
      if (!Array.isArray(p) || typeof p[0] !== "string" || typeof p[1] !== "string") return err(`${name} is not a base: an entry is not a pair of texts`);
      pairs.push([p[0], p[1]]);
    }
    const decoded = decodeBase(pairs);
    return decoded.kind === "ok" ? ok(decoded.value) : err(`${name}: ${decoded.error}`);
  } catch (e) {
    return err(`${name} is not a base: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const bisync = (host: Host): Command =>
  defineVerb(host, {
    name: "bisync",
    id: "bisync",
    options: {
      conflict: value({ parse: parseConflict, default: "fail", valueName: "RULE", help: "What to do with a path both sides changed: fail, newer-wins or keep-both." }),
      seed: flag({ help: "The first run: take the union of the two sides as the base. Needed once, and only where no base is recorded." }),
      maxDeletes: value({ parse: integerText, valueName: "N", help: "Let a delete on one side reach the other, at most N: none without it." }),
      include: PLAN_OPTIONS.include,
      exclude: PLAN_OPTIONS.exclude,
      concurrency: PLAN_OPTIONS.concurrency,
      planHash: PLAN_OPTIONS.planHash,
    },
    operands: [{ name: "A", help: "The first directory.", arity: "one" }, { name: "B", help: "The second directory.", arity: "one" }],
    examples: [{ args: ["--seed", "--dry-run", "./fleet", "s3backup:/fleet"], says: "The first run's plan: the union of both sides is the base." }, { args: ["--conflict", "keep-both", "--dry-run", "./fleet", "s3backup:/fleet"], says: "Later runs: only what changed since the base." }],
    run: async (args, ctx) => {
      const [a, b] = args.positionals;
      if (a === undefined || b === undefined) return usage("bisync needs two directories");
      const bound = await bindAll(host, [a, b]);
      if (bound.kind === "err") return bound.error;
      const [left, right] = bound.value;
      if (left === undefined || right === undefined) return usage("bisync needs two directories");
      const ea = destEnd(left);
      if (ea.kind === "err") return ea.error;
      const eb = destEnd(right);
      if (eb.kind === "err") return eb.error;
      const rails = railsOf(host, { include: args.options.include, exclude: args.options.exclude, maxFiles: undefined, maxBytes: undefined, lossless: false, concurrency: undefined, planHash: undefined });
      if (rails.kind === "err") return usage(rails.error);
      const name = await stateName("bisync", left, right);
      const base = await readBase(host, name);
      if (base.kind === "err") return outcomeOf(null, { problems: [problemOf("E-CONFIG-INVALID", base.error)] });
      if (base.value === undefined && !args.options.seed) return usage(`there is no base for ${left.text} and ${right.text} yet: run it once with --seed, which takes the union of the two sides as the base`);
      const planned = await planBisync(ea.value, eb.value, base.value ?? { seed: "union" }, { conflict: args.options.conflict, deletes: deletesOf(args.options.maxDeletes), rails: { ...(rails.value.include === undefined ? {} : { include: rails.value.include }), ...(rails.value.exclude === undefined ? {} : { exclude: rails.value.exclude }) } });
      if (planned.kind === "err") return outcomeOf(null, { problems: [refusalProblem(planned.error)] });
      const plan = planned.value;
      const lines = [
        `bisync ${left.text} <-> ${right.text}`,
        ...plan.actions.map((x) => `  ${x.side}: ${x.action.kind} ${x.rel}`),
        ...plan.conflicts.map((c) => `  conflict ${c.rel}: ${c.detail}`),
        ...plan.resolved.map((r) => `  resolved: ${r}`),
        `${plan.unchanged} unchanged, ${counted(plan.actions.length, "action")}, ${counted(plan.conflicts.length, "conflict")}`,
        `plan ${plan.hash}`,
      ];
      if (dry(ctx)) return outcomeOf({ plan }, { text: lines.join("\n"), next: plan.actions.length === 0 ? [] : [`next: anyfs bisync ${args.options.seed ? "--seed " : ""}${a} ${b} --yes --plan-hash ${plan.hash}`] });
      if (args.options.planHash !== undefined && args.options.planHash !== plan.hash) return staleOutcome(args.options.planHash, plan.hash);
      const done = await applyBisync(plan, ea.value, eb.value, { concurrency: args.options.concurrency ?? host.config.defaults.concurrency, verify: host.config.defaults.verify, recheck: false, skipConflicts: true });
      await host.world.state.write(name, JSON.stringify(encodeBase(done.base)));
      const failed = done.a.failed + done.b.failed;
      const base0 = outcomeOf({ a: done.a, b: done.b }, { text: [`a: ${done.a.done} done, ${done.a.failed} failed`, `b: ${done.b.done} done, ${done.b.failed} failed`, ...(plan.conflicts.length > 0 ? [`${counted(plan.conflicts.length, "conflict")} left for you`] : [])].join("\n") });
      const problems = [...(failed > 0 ? [problemOf("E-APPLY-FAILED", `${failed} actions failed`)] : []), ...(plan.conflicts.length > 0 ? [problemOf("E-CONFLICTS", `${counted(plan.conflicts.length, "conflict")} left`)] : [])];
      return problems.length === 0 ? base0 : { ...base0, problems };
    },
  });

/** A ledger read from the state folder. */
async function readLedger(host: Host, name: string): Promise<Result<Ledger, string>> {
  const text = await host.world.state.read(name);
  if (text === undefined) return ok(emptyLedger);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return err(`${name} is not a ledger: it is not a list`);
    const applied = new Map<Path, string>();
    for (const p of parsed) {
      if (!Array.isArray(p) || typeof p[0] !== "string" || typeof p[1] !== "string") return err(`${name} is not a ledger: an entry is not a pair of texts`);
      const path = parsePath(p[0]);
      if (path.kind === "err") return err(`${name}: ${path.error}`);
      applied.set(path.value, p[1]);
    }
    return ok({ applied });
  } catch (e) {
    return err(`${name} is not a ledger: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const writeLedger = (host: Host, name: string, ledger: Ledger): Promise<void> => host.world.state.write(name, JSON.stringify([...ledger.applied].sort(([x], [y]) => (x < y ? -1 : 1))));

/** A replica state in words. */
function stateText(s: ReplicaState): string {
  return s.kind === "in-sync" ? "in sync" : s.kind === "behind" ? `behind by ${counted(s.pending, "path")}` : `diverged: ${s.paths.join(", ")} changed on the replica itself; ${counted(s.pending, "other path")} behind`;
}

const mirrorOptions = {
  include: PLAN_OPTIONS.include,
  exclude: PLAN_OPTIONS.exclude,
  planHash: PLAN_OPTIONS.planHash,
};

type Pair = { readonly primary: Bound; readonly replica: Bound; readonly name: string; readonly ledger: Ledger };

async function pairOf(host: Host, args: readonly string[]): Promise<Result<Pair, Outcome>> {
  const [a, b] = args;
  if (a === undefined || b === undefined) return err(usage("a mirror needs a primary and a replica"));
  const bound = await bindAll(host, [a, b]);
  if (bound.kind === "err") return err(bound.error);
  const [primary, replica] = bound.value;
  if (primary === undefined || replica === undefined) return err(usage("a mirror needs a primary and a replica"));
  const name = await stateName("mirror", primary, replica);
  const ledger = await readLedger(host, name);
  if (ledger.kind === "err") return err(outcomeOf(null, { problems: [problemOf("E-CONFIG-INVALID", ledger.error)] }));
  return ok({ primary, replica, name, ledger: ledger.value });
}

const mirrorStatus = (host: Host): Command =>
  defineVerb(host, {
    name: "status",
    id: "mirror status",
    options: { include: mirrorOptions.include, exclude: mirrorOptions.exclude },
    operands: [{ name: "PRIMARY", help: "The directory that is the source of truth.", arity: "one" }, { name: "REPLICA", help: "The directory that follows it.", arity: "one" }],
    examples: [{ args: ["fleet:/", "s3backup:/fleet"], says: "Whether the replica is in sync with the primary, behind it, or has diverged." }],
    run: async (args) => {
      const pair = await pairOf(host, args.positionals);
      if (pair.kind === "err") return pair.error;
      const p = sourceEnd(pair.value.primary);
      if (p.kind === "err") return p.error;
      const r = sourceEnd(pair.value.replica);
      if (r.kind === "err") return r.error;
      const rails = railsOf(host, { include: args.options.include, exclude: args.options.exclude, maxFiles: undefined, maxBytes: undefined, lossless: false, concurrency: undefined, planHash: undefined });
      if (rails.kind === "err") return usage(rails.error);
      const status = await replicaStatus(p.value, r.value, pair.value.ledger, { rails: { ...(rails.value.include === undefined ? {} : { include: rails.value.include }), ...(rails.value.exclude === undefined ? {} : { exclude: rails.value.exclude }) } });
      if (status.kind === "err") return outcomeOf(null, { problems: [refusalProblem(status.error)] });
      const base = outcomeOf({ state: status.value }, { text: stateText(status.value) });
      return status.value.kind === "diverged" ? { ...base, problems: [problemOf("E-REPLICA-DIVERGED", stateText(status.value))] } : base;
    },
  });

const mirrorSync = (host: Host): Command =>
  defineVerb(host, {
    name: "sync",
    id: "mirror sync",
    options: { maxDeletes: value({ parse: integerText, valueName: "N", help: "Allow at most N deletes at the replica: none without it." }), ...mirrorOptions },
    operands: [{ name: "PRIMARY", help: "The directory that is the source of truth.", arity: "one" }, { name: "REPLICA", help: "The directory that follows it.", arity: "one" }],
    examples: [{ args: ["--dry-run", "fleet:/", "s3backup:/fleet"], says: "How far behind the replica is, and the hash of that state." }, { args: ["--yes", "--plan-hash", "<hash>", "fleet:/", "s3backup:/fleet"], says: "Bring it up; what the replica changed itself is never touched." }],
    run: async (args, ctx) => {
      const pair = await pairOf(host, args.positionals);
      if (pair.kind === "err") return pair.error;
      const p = sourceEnd(pair.value.primary);
      if (p.kind === "err") return p.error;
      const r = destEnd(pair.value.replica);
      if (r.kind === "err") return r.error;
      const rails = railsOf(host, { include: args.options.include, exclude: args.options.exclude, maxFiles: undefined, maxBytes: undefined, lossless: false, concurrency: undefined, planHash: undefined });
      if (rails.kind === "err") return usage(rails.error);
      const railed = { ...(rails.value.include === undefined ? {} : { include: rails.value.include }), ...(rails.value.exclude === undefined ? {} : { exclude: rails.value.exclude }) };
      const status = await replicaStatus(p.value, r.value, pair.value.ledger, { rails: railed });
      if (status.kind === "err") return outcomeOf(null, { problems: [refusalProblem(status.error)] });
      const hash = await sha256(JSON.stringify(status.value));
      if (dry(ctx)) return outcomeOf({ state: status.value, hash }, { text: `${stateText(status.value)}\nstate ${hash}`, next: status.value.kind === "in-sync" ? [] : [`next: anyfs mirror sync ${args.positionals.join(" ")} --yes --plan-hash ${hash}`] });
      if (args.options.planHash !== undefined && args.options.planHash !== hash) return staleOutcome(args.options.planHash, hash);
      const done = await converge(p.value, r.value, pair.value.ledger, { rails: railed, deletes: deletesOf(args.options.maxDeletes), apply: { concurrency: host.config.defaults.concurrency, verify: host.config.defaults.verify } });
      if (done.kind === "err") return outcomeOf(null, { problems: [refusalProblem(done.error)] });
      await writeLedger(host, pair.value.name, done.value.ledger);
      const out = reportOutcome(done.value.report);
      return done.value.before.kind === "diverged" ? { ...out, problems: [...out.problems, problemOf("E-REPLICA-DIVERGED", stateText(done.value.before))] } : out;
    },
  });

const mirrorPromote = (host: Host): Command =>
  defineVerb(host, {
    name: "promote",
    id: "mirror promote",
    options: {
      acceptLoss: value({ parse: integerText, valueName: "N", help: "Accept to lose up to N changes of the old primary that the replica does not have." }),
      acceptDivergence: flag({ help: "Accept that the replica holds changes of its own." }),
      ...mirrorOptions,
    },
    operands: [{ name: "PRIMARY", help: "The current primary.", arity: "one" }, { name: "REPLICA", help: "The replica to make the primary.", arity: "one" }],
    examples: [{ args: ["--dry-run", "fleet:/", "s3backup:/fleet"], says: "What promoting the replica would lose." }],
    run: async (args, ctx) => {
      const pair = await pairOf(host, args.positionals);
      if (pair.kind === "err") return pair.error;
      const p = sourceEnd(pair.value.primary);
      if (p.kind === "err") return p.error;
      const r = sourceEnd(pair.value.replica);
      if (r.kind === "err") return r.error;
      const rails = railsOf(host, { include: args.options.include, exclude: args.options.exclude, maxFiles: undefined, maxBytes: undefined, lossless: false, concurrency: undefined, planHash: undefined });
      if (rails.kind === "err") return usage(rails.error);
      const railed = { ...(rails.value.include === undefined ? {} : { include: rails.value.include }), ...(rails.value.exclude === undefined ? {} : { exclude: rails.value.exclude }) };
      const status = await replicaStatus(p.value, r.value, pair.value.ledger, { rails: railed });
      if (status.kind === "err") return outcomeOf(null, { problems: [refusalProblem(status.error)] });
      const hash = await sha256(JSON.stringify(status.value));
      if (dry(ctx)) return outcomeOf({ state: status.value, hash }, { text: `${stateText(status.value)}\nstate ${hash}` });
      if (args.options.planHash !== undefined && args.options.planHash !== hash) return staleOutcome(args.options.planHash, hash);
      const done = await promote(p.value, r.value, pair.value.ledger, { rails: railed, ...(args.options.acceptLoss === undefined ? {} : { acceptLoss: args.options.acceptLoss }), acceptDivergence: args.options.acceptDivergence });
      if (done.kind === "err") {
        const e = done.error;
        const why = e.kind === "behind" ? `the replica is behind by ${counted(e.pending, "path")}: --accept-loss ${e.pending} accepts to lose them` : e.kind === "diverged" ? `the replica holds changes of its own (${e.paths.join(", ")}): --accept-divergence accepts them` : refusalProblem(e.refusal).message;
        return outcomeOf(null, { problems: [problemOf("E-REPLICA-DIVERGED", why)] });
      }
      const swapped = await stateName("mirror", pair.value.replica, pair.value.primary);
      await writeLedger(host, swapped, done.value.ledger);
      return outcomeOf({ promoted: pair.value.replica.text, lost: done.value.lost }, { text: `${pair.value.replica.text} is now the primary; ${pair.value.primary.text} is a replica of it\n${counted(done.value.lost, "change")} of the old primary are not in the new one` });
    },
  });

/** The verbs that bring directories of two stores together. */
export function bridgeVerbs(host: Host): readonly Node[] {
  return [sync(host), check(host), bisync(host), branch({ name: "mirror", summary: "A replica that follows a primary: its state, bringing it up, and promoting it.", children: [mirrorStatus(host), mirrorSync(host), mirrorPromote(host)] })];
}


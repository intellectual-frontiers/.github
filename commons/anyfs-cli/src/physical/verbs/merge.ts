// Spec: 0004-anyfs-cli-surfaces FR-014, FR-015
/**
 * The verbs of the program for stores that merge (commons anyfs-cli 0004-anyfs-cli-surfaces FR-014, FR-015): `merge A B` brings two stores that both merge together by a plan with a hash (what each takes from the other),
 * and applies only what the hash approves; `sync-medium STORE MEDIUM` exchanges a store that merges with a shared place, publishing the rows it made as delta files and taking the files of the others. Neither has a
 * conflict to settle, so neither has a policy. What the exchange keeps of itself (the cursor) is a small file in the state folder, named by the two sides.
 *
 * @example
 * ```ts
 * import { mergeVerbs } from "./merge.ts";
 * // mergeVerbs(host).map((v) => v.name); // ["merge", "sync-medium"]
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import { outcomeOf, type Command, type Node, type Outcome } from "@intellectual-frontiers/headless/logical";
import { integerText, value } from "@intellectual-frontiers/terminal/args";
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { parseReplicaId, type ReplicaId } from "@intellectual-frontiers/anyfs/governance";
import {
  applyMerge,
  decodeCursor,
  describeExchangeProblem,
  describeMergeProblem,
  encodeCursor,
  EMPTY_CURSOR,
  type Cursor,
  type Mergeable,
  type Medium,
  planMerge,
  planSync,
  syncThrough,
} from "@intellectual-frontiers/anyfs-bridge/exchange";
import { counted, type Host, problemOf, usage } from "@intellectual-frontiers/anyfs-cli/logical";
import type { Bound } from "../bind.ts";
import { bindAll, defineVerb } from "./common.ts";
import { staleOutcome } from "./transfer.ts";

const dry = (ctx: { readonly mode: string }): boolean => ctx.mode !== "apply";

/** A word as a whole store that merges: the word names a store (a mount or a place), not a place inside one. */
function mergeable(b: Bound, what: string): Result<Mergeable, Outcome> {
  if (!b.store.capabilities.has("merge")) return err(outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", `${b.text}: the store ${b.store.id} does not merge: it lacks the capability merge, so ${what} is not for it (use sync or bisync)`)] }));
  if (b.inner !== "/" && b.inner !== "") return err(usage(`${b.text}: a merge is of whole stores; name the store, not a directory of it`));
  return ok(b.store as unknown as Mergeable);
}

const takingText = (name: string, t: { readonly versions: number; readonly blobs: number; readonly bytes: number }): string => `${name} takes ${counted(t.versions, "row")} and ${counted(t.blobs, "blob")} (${t.bytes} bytes)`;

const merge = (host: Host): Command =>
  defineVerb(host, {
    name: "merge",
    id: "merge",
    options: {
      maxRows: value({ parse: integerText, valueName: "N", help: "Refuse a plan in which a store would take more than N rows at once." }),
      maxBytes: value({ parse: integerText, valueName: "N", help: "Refuse a plan in which a store would take more than N bytes of blobs at once." }),
      planHash: value({ valueName: "HASH", help: "Apply only the plan with this hash: where the stores changed since it was read, nothing is applied." }),
    },
    operands: [{ name: "A", help: "The first store that merges.", arity: "one" }, { name: "B", help: "The second store that merges.", arity: "one" }],
    examples: [
      { args: ["--dry-run", "fleet-a:/", "fleet-b:/"], says: "What each store takes from the other, and the hash of that plan; nothing is changed." },
      { args: ["--yes", "--plan-hash", "<hash>", "fleet-a:/", "fleet-b:/"], says: "Bring them together: each takes what the other has, whole or not at all." },
    ],
    run: async (args, ctx) => {
      const [wa, wb] = args.positionals;
      if (wa === undefined || wb === undefined) return usage("merge needs two stores");
      const bound = await bindAll(host, [wa, wb]);
      if (bound.kind === "err") return bound.error;
      const [x, y] = bound.value;
      if (x === undefined || y === undefined) return usage("merge needs two stores");
      const a = mergeable(x, "merge");
      if (a.kind === "err") return a.error;
      const b = mergeable(y, "merge");
      if (b.kind === "err") return b.error;
      const rails = { ...(args.options.maxRows === undefined ? {} : { maxVersions: args.options.maxRows }), ...(args.options.maxBytes === undefined ? {} : { maxBytes: args.options.maxBytes }) };
      const prepared = await planMerge(a.value, b.value, rails);
      if (prepared.kind === "err") return outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", describeMergeProblem(prepared.error))] });
      const plan = prepared.value.plan;
      const nothing = plan.toA.versions === 0 && plan.toB.versions === 0 && plan.toA.blobs === 0 && plan.toB.blobs === 0;
      const text = nothing ? "nothing to do: the two hold the same rows" : [takingText(wa, plan.toA), takingText(wb, plan.toB), `plan ${plan.hash}`].join("\n");
      if (dry(ctx)) return outcomeOf({ plan }, { text, next: nothing ? [] : [`next: anyfs merge ${wa} ${wb} --yes --plan-hash ${plan.hash}`] });
      if (args.options.planHash !== undefined && args.options.planHash !== plan.hash) return staleOutcome(args.options.planHash, plan.hash);
      const done = await applyMerge(a.value, b.value, prepared.value, { approved: args.options.planHash ?? plan.hash, rails });
      if (done.kind === "err") return done.error.kind === "stale" ? staleOutcome(done.error.planned, done.error.now) : outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", describeMergeProblem(done.error))] });
      const refused = [done.value.toA, done.value.toB].filter((o) => o?.kind === "refused").length;
      const lines = [`${wa}: ${done.value.toA?.kind ?? "nothing to take"}`, `${wb}: ${done.value.toB?.kind ?? "nothing to take"}`, done.value.vectorsEqual ? "the two hold the same rows now" : "the two do not hold the same rows: one of them refused a delta"];
      const base = outcomeOf({ report: done.value }, { text: lines.join("\n") });
      return refused > 0 ? { ...base, problems: [problemOf("E-MERGE-REFUSED", `${counted(refused, "store")} refused what the other offered: see the lines above`)] } : base;
    },
  });

/** The cursor of a store and a medium, kept in the state folder under a name made of what they are. */
async function cursorOf(host: Host, a: Bound, b: Bound): Promise<Cursor> {
  const name = `sync-medium-${(await sha256(`${a.store.id}|${b.store.id}`)).slice(0, 16)}.json`;
  return {
    load: async () => {
      const text = await host.world.state.read(name);
      return text === undefined ? ok(EMPTY_CURSOR) : decodeCursor(text);
    },
    save: async (state) => {
      await host.world.state.write(name, encodeCursor(state));
      return ok(undefined);
    },
  };
}

const syncMedium = (host: Host): Command =>
  defineVerb(host, {
    name: "sync-medium",
    id: "sync-medium",
    options: {
      replica: value({ valueName: "ID", help: "The identity of the store as a replica (32 hexadecimal digits), which the store does not say of itself." }),
      maxRows: value({ parse: integerText, valueName: "N", help: "Put at most N rows in one delta file." }),
    },
    operands: [{ name: "STORE", help: "The store that merges.", arity: "one" }, { name: "MEDIUM", help: "The shared place: any store that reads, writes and lists.", arity: "one" }],
    examples: [
      { args: ["--dry-run", "--replica", "0123456789abcdef0123456789abcdef", "fleet-a:/", "shared:/"], says: "How many rows are not published yet and which delta files of the others are not taken." },
      { args: ["--replica", "0123456789abcdef0123456789abcdef", "fleet-a:/", "shared:/"], says: "Publish the new rows as delta files and take the others'." },
    ],
    run: async (args, ctx) => {
      const [ws, wm] = args.positionals;
      if (ws === undefined || wm === undefined) return usage("sync-medium needs a store and a medium");
      if (args.options.replica === undefined) return usage("sync-medium needs --replica, the identity of the store as a replica");
      const self: Result<ReplicaId, string> = parseReplicaId(args.options.replica);
      if (self.kind === "err") return usage(self.error);
      const bound = await bindAll(host, [ws, wm]);
      if (bound.kind === "err") return bound.error;
      const [s, m] = bound.value;
      if (s === undefined || m === undefined) return usage("sync-medium needs a store and a medium");
      const replica = mergeable(s, "sync-medium");
      if (replica.kind === "err") return replica.error;
      if (!(m.store.capabilities.has("read") && m.store.capabilities.has("write") && m.store.capabilities.has("list"))) return outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", `${m.text}: the medium ${m.store.id} must read, write and list`)] });
      const options = {
        self: self.value,
        replica: replica.value,
        medium: m.store as unknown as Medium,
        cursor: await cursorOf(host, s, m),
        ...(args.options.maxRows === undefined ? {} : { maxRows: args.options.maxRows }),
      };
      if (dry(ctx)) {
        const plan = await planSync(options);
        if (plan.kind === "err") return outcomeOf(null, { problems: [problemOf("E-PLAN-REFUSED", describeExchangeProblem(plan.error))] });
        return outcomeOf({ plan: plan.value }, { text: `${counted(plan.value.toPublish, "row")} to publish, ${counted(plan.value.toTake.length, "delta file")} to take` });
      }
      const done = await syncThrough(options);
      if (done.kind === "err") return outcomeOf(null, { problems: [problemOf("E-SYNC-FAILED", describeExchangeProblem(done.error))] });
      const r = done.value;
      const lines = [
        `published ${counted(r.published.length, "file")} (${counted(r.published.reduce((n, p) => n + p.versions, 0), "row")})`,
        `took ${counted(r.pulled.applied, "file")} (${counted(r.pulled.versions, "row")}, ${counted(r.pulled.blobs, "blob")}), ${counted(r.pulled.duplicates, "file")} already held, ${counted(r.pulled.deferred, "file")} waiting for rows`,
        ...r.pulled.aside.map((a) => `${a.kind}: ${a.path}: ${a.reason}`),
      ];
      const base = outcomeOf({ report: r }, { text: lines.join("\n") });
      return r.pulled.aside.length > 0 ? { ...base, problems: [problemOf("E-FILES-ASIDE", `${counted(r.pulled.aside.length, "delta file")} put aside or refused: see the lines above`)] } : base;
    },
  });

/** The verbs for stores that merge. */
export function mergeVerbs(host: Host): readonly Node[] {
  return [merge(host), syncMedium(host)];
}

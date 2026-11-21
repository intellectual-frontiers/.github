// Spec: 0005-anyfs-conformance FR-002
/**
 * The case that compares a store with a model: a long sequence of operations, chosen by a seeded generator, is made on the store and on a model that holds the laws of a store in a few lines, and every answer is
 * compared (the kind of answer, the bytes, the flags, the order of a list, and whether a revision changed where the bytes did and not otherwise). A failure names the seed and the step, so that it can be run again.
 *
 * @module
 */
import { type Capability, comparePaths, expectAbsent, expectAny, expectRev, isUnder, type Path, type Prefix, parsePrefix, ROOT, type Revision } from "@intellectual-frontiers/anyfs/governance";
import { type Case, ConformanceFailure, bytes, pathOf, text, withCapabilities } from "./kit.ts";
import type { Store } from "../store.ts";
import type { CoreCapability } from "@intellectual-frontiers/anyfs/governance";

/** A generator of numbers from a seed: the same seed gives the same numbers. */
export function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PATHS = ["m/a", "m/b", "m/c/d", "m/c/e", "z"] as const;
const CONTENTS = ["", "x", "y", "zz", "a longer text of some length, to make the bytes differ in size"] as const;
const PREFIXES = ["", "m", "m/c"] as const;

type Held = { readonly bytes: string; readonly rev: Revision };

/** A case: `steps` operations from `seed`, compared with the model. */
export function modelCase(seed: number, steps: number): Case {
  return {
    id: `model-${seed}`,
    title: `${steps} operations from seed ${seed}, compared with a model of the laws`,
    needs: [],
    async run(make) {
      const base: Store<CoreCapability> = await make();
      const withCas = base.capabilities.has("cas");
      const s = withCapabilities(base, ...(withCas ? (["cas"] as const) : []));
      const random = generator(seed);
      const pick = <T>(xs: readonly [T, ...T[]]): T => xs[Math.floor(random() * xs.length)] ?? xs[0];
      const model = new Map<Path, Held>();
      const known = new Map<Path, Revision>();
      const stale = new Map<Path, Revision>();
      const fail = (step: number, what: string): never => {
        throw new ConformanceFailure(`seed ${seed}, step ${step}: ${what}`);
      };
      for (let step = 1; step <= steps; step++) {
        const p = pathOf(pick(PATHS));
        const c = pick(CONTENTS);
        const kind = random();
        const had = model.get(p);
        if (kind < 0.3) {
          const r = await s.write(p, bytes(c), expectAny);
          if (r.kind === "err") fail(step, `write any of ${p} was refused: ${r.error.kind}`);
          else {
            if (had !== undefined) {
              const same = had.bytes === c;
              if (same !== (r.value.rev === had.rev)) fail(step, `the revision of ${p} ${same ? "changed" : "did not change"} where the bytes ${same ? "did not" : "did"}`);
            }
            if (r.value.created !== (had === undefined)) fail(step, `write any of ${p} said created=${r.value.created} and it ${had === undefined ? "was not" : "was"} there`);
            if (had !== undefined) stale.set(p, had.rev);
            model.set(p, { bytes: c, rev: r.value.rev });
            known.set(p, r.value.rev);
          }
        } else if (kind < 0.42) {
          const r = await s.write(p, bytes(c), expectAbsent);
          if (had === undefined) {
            if (r.kind === "err") fail(step, `write absent of ${p} was refused: ${r.error.kind}`);
            else {
              model.set(p, { bytes: c, rev: r.value.rev });
              known.set(p, r.value.rev);
            }
          } else if (r.kind === "ok" || r.error.kind !== "conflict") fail(step, `write absent over ${p} should conflict`);
        } else if (kind < 0.54 && withCas) {
          const cas = withCapabilities(base, "cas");
          const wanted = random() < 0.5 ? known.get(p) : stale.get(p);
          if (wanted === undefined) continue;
          const r = await cas.write(p, bytes(c), expectRev(wanted));
          const should = had !== undefined && had.rev === wanted;
          if (should) {
            if (r.kind === "err") fail(step, `write at the revision of ${p} was refused: ${r.error.kind}`);
            else {
              const same = had.bytes === c;
              if (same !== (r.value.rev === had.rev)) fail(step, `the revision of ${p} ${same ? "changed" : "did not change"} where the bytes ${same ? "did not" : "did"}`);
              stale.set(p, had.rev);
              model.set(p, { bytes: c, rev: r.value.rev });
              known.set(p, r.value.rev);
            }
          } else if (r.kind === "ok" || r.error.kind !== "conflict") fail(step, `write at a revision that is not ${p}'s should conflict`);
        } else if (kind < 0.66) {
          const r = await s.delete(p, expectAny);
          if (r.kind === "err") fail(step, `delete any of ${p} was refused: ${r.error.kind}`);
          else if (r.value.existed !== (had !== undefined)) fail(step, `delete of ${p} said existed=${r.value.existed}`);
          model.delete(p);
          known.delete(p);
          stale.delete(p);
        } else if (kind < 0.8) {
          const r = await s.read(p);
          if (had === undefined) {
            if (r.kind === "ok" || r.error.kind !== "missing") fail(step, `read of ${p} should be missing`);
          } else if (r.kind === "err") fail(step, `read of ${p} said ${r.error.kind}`);
          else {
            if (text(r.value.bytes) !== had.bytes) fail(step, `read of ${p} gave other bytes`);
            if (r.value.rev !== had.rev) fail(step, `read of ${p} gave another revision than the last write`);
          }
        } else if (kind < 0.88) {
          const r = await s.stat(p);
          if (had === undefined) {
            if (r.kind === "ok" || r.error.kind !== "missing") fail(step, `stat of ${p} should be missing`);
          } else if (r.kind === "err" || r.value.size !== bytes(had.bytes).length || r.value.rev !== had.rev) fail(step, `stat of ${p} differs from the model`);
        } else {
          const prefixText = pick(PREFIXES);
          const parsed = parsePrefix(prefixText);
          const prefix: Prefix = parsed.kind === "ok" ? parsed.value : ROOT;
          const r = await s.list(prefix);
          if (r.kind === "err") fail(step, `list of ${prefixText || "the root"} was refused: ${r.error.kind}`);
          else {
            const want = [...model.keys()].filter((k) => isUnder(prefix, k)).sort(comparePaths);
            const got = r.value.entries.map((e) => e.path);
            if (JSON.stringify(want) !== JSON.stringify(got)) fail(step, `list of ${prefixText || "the root"} gave ${JSON.stringify(got)}, the model ${JSON.stringify(want)}`);
          }
        }
      }
    },
  };
}

/** The capabilities a case is run with, as a list: for the report. */
export const capabilitiesOf = (store: Store<CoreCapability>): readonly Capability[] => [...store.capabilities];

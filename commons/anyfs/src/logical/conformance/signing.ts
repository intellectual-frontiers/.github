// Spec: 0010-anyfs-merge-signing FR-001, FR-002
/**
 * The conformance suite of signed deltas: the laws a replica that takes signed changes obeys, as cases that run against replicas a backend makes with a trust the suite gives them. A delta signed by a key of the roster of its
 * replica is taken; one that is not signed, one whose signature is of another delta, one signed by another replica's key or under a key id that is not its own signature's, one from a replica that is not on the list it must
 * also be on, and one signed under a key whose window has not begun or has ended are refused each with the reason of its own; one taken twice has the effect of once. Each failure is a sentence. The suite is held by a test
 * that runs it against replicas that check nothing and sees each of them fail.
 *
 * @example
 * ```ts
 * import { runSigningConformance } from "./signing.ts";
 * // const report = await runSigningConformance(async (ids, trusts) => replicasOfMyBackend(ids, trusts))
 * ```
 *
 * @module
 */
import { expectAny, type Delta, parsePath, type Path, type ReplicaId, replicaIdOfBytes, type Trust } from "@intellectual-frontiers/anyfs/governance";
import { generateSigningKey, makeSigner, rosterTrust, signDelta, type KeyEntry, type Signer, type SigningKey, verifySigned, deltaId } from "@intellectual-frontiers/anyfs/merge";
import type { MergeFace } from "./merge.ts";
import { ConformanceFailure } from "./kit.ts";

/** What a backend gives the suite: replicas with these identities, the first taking changes by the first trust, and so on. */
export type MakeSigned = (replicas: readonly ReplicaId[], trusts: readonly Trust[]) => Promise<readonly MergeFace[]>;

/** The report of one case. */
export type SigningReport = { readonly id: string; readonly failure?: string };

const rid = (n: number): ReplicaId => {
  const r = replicaIdOfBytes(new Uint8Array(16).fill(n + 40));
  if (r.kind === "err") throw new ConformanceFailure(r.error);
  return r.value;
};
const p = (s: string): Path => {
  const r = parsePath(s);
  if (r.kind === "err") throw new ConformanceFailure(r.error);
  return r.value;
};
const enc = new TextEncoder();

/** A delta of one file that replica `f` made, as a delta since nothing. */
async function deltaOf(f: MergeFace, path: string, text: string): Promise<Delta> {
  const w = await f.store.write(p(path), enc.encode(text), expectAny);
  if (w.kind === "err") throw new ConformanceFailure(`a write by the replica that signs was refused: ${JSON.stringify(w.error)}`);
  const d = await f.store.deltaSince({});
  if (d.kind === "err") throw new ConformanceFailure(`a delta of the replica that signs could not be made: ${JSON.stringify(d.error)}`);
  return d.value;
}

/** What taking a delta ended with: the kind of outcome and, where it was refused, the reason. */
async function takes(f: MergeFace, delta: Delta): Promise<string> {
  const r = await f.store.applyDelta(delta);
  if (r.kind === "err") throw new ConformanceFailure(`taking a delta ended in a failure of the store: ${JSON.stringify(r.error)}`);
  return r.value.kind === "refused" ? `refused:${r.value.refusal.kind}` : r.value.kind;
}

const expectOutcome = (got: string, want: string, what: string): void => {
  if (got !== want) throw new ConformanceFailure(`${what}: expected ${want}, the replica said ${got}`);
};

type World = { readonly a: MergeFace; readonly b: MergeFace; readonly c: MergeFace; readonly sa: Signer; readonly sc: Signer; readonly keys: readonly SigningKey[]; readonly roster: readonly KeyEntry[] };

/** A world of three replicas, A and C that sign and B that takes only signed deltas from the roster, with the list B also requires where `listed` names it. */
async function world(make: MakeSigned, options: { readonly listed?: readonly number[]; readonly windows?: readonly { readonly notBefore?: number; readonly notAfter?: number }[] } = {}): Promise<World> {
  const ids = [rid(0), rid(1), rid(2)];
  const keys = await Promise.all(ids.map((r, i) => generateSigningKey(r, options.windows?.[i] ?? {})));
  const roster = keys.map((k) => k.entry);
  const listed = options.listed === undefined ? undefined : new Set(options.listed.map((i) => ids[i] as ReplicaId));
  const open: Trust = { kind: "open" };
  const faces = await make(ids, [open, rosterTrust(roster, listed), open]);
  const [a, b, c] = faces as [MergeFace, MergeFace, MergeFace];
  return { a, b, c, sa: await makeSigner(keys[0] as SigningKey), sc: await makeSigner(keys[2] as SigningKey), keys, roster };
}

const CASES: readonly { readonly id: string; readonly run: (make: MakeSigned) => Promise<void> }[] = [
  {
    id: "signed-is-taken",
    run: async (make) => {
      const w = await world(make);
      const signed = await signDelta(await deltaOf(w.a, "a.txt", "from a"), w.sa);
      expectOutcome(await takes(w.b, signed), "applied", "a delta signed by a key of the roster of its replica");
      const r = await w.b.store.read(p("a.txt"));
      if (r.kind !== "ok") throw new ConformanceFailure("the file of a taken delta is not there");
    },
  },
  {
    id: "unsigned-is-refused",
    run: async (make) => {
      const w = await world(make);
      expectOutcome(await takes(w.b, await deltaOf(w.a, "a.txt", "from a")), "refused:unsigned", "a delta with no signature");
    },
  },
  {
    id: "signature-of-another-delta",
    run: async (make) => {
      const w = await world(make);
      const first = await signDelta(await deltaOf(w.a, "a.txt", "one"), w.sa);
      const second = await deltaOf(w.a, "b.txt", "two");
      const forged: Delta = { ...second, ...(first.signature === undefined ? {} : { signature: first.signature }) };
      expectOutcome(await takes(w.b, forged), "refused:bad-signature", "a delta that carries the signature of another delta");
    },
  },
  {
    id: "another-replicas-key",
    run: async (make) => {
      const w = await world(make);
      const d = await deltaOf(w.a, "a.txt", "from a");
      expectOutcome(await takes(w.b, await signDelta(d, w.sc)), "refused:unknown-key", "a delta of replica A signed by the key of replica C");
    },
  },
  {
    id: "key-id-claimed-is-not-the-key",
    run: async (make) => {
      const w = await world(make);
      const d = await deltaOf(w.a, "a.txt", "from a");
      const attacker = await generateSigningKey(rid(0));
      const claimed = await makeSigner({ privateJwk: attacker.privateJwk, entry: { ...attacker.entry, keyId: w.keys[0]?.entry.keyId ?? "" } });
      expectOutcome(await takes(w.b, await signDelta(d, claimed)), "refused:bad-signature", "a delta signed by a key that names the key id of another");
    },
  },
  {
    id: "listed-and-signed",
    run: async (make) => {
      const w = await world(make, { listed: [0, 1] });
      const fromC = await signDelta(await deltaOf(w.c, "c.txt", "from c"), w.sc);
      expectOutcome(await takes(w.b, fromC), "refused:trust", "a delta with a signature that holds from a replica that is not on the list");
      expectOutcome(await takes(w.b, await signDelta(await deltaOf(w.a, "a.txt", "from a"), w.sa)), "applied", "a delta from a replica that is on the list and signs");
    },
  },
  {
    id: "key-windows",
    run: async (make) => {
      const now = Date.now();
      const early = await world(make, { windows: [{ notAfter: now - 3_600_000 }, {}, {}] });
      expectOutcome(await takes(early.b, await signDelta(await deltaOf(early.a, "a.txt", "late"), early.sa)), "refused:unknown-key", "a delta made after the key's window ended");
      const open = await world(make, { windows: [{ notBefore: now - 3_600_000, notAfter: now + 3_600_000 }, {}, {}] });
      expectOutcome(await takes(open.b, await signDelta(await deltaOf(open.a, "a.txt", "in"), open.sa)), "applied", "a delta made inside the key's window");
      const not = await world(make, { windows: [{ notBefore: now + 3_600_000 }, {}, {}] });
      expectOutcome(await takes(not.b, await signDelta(await deltaOf(not.a, "a.txt", "before"), not.sa)), "refused:unknown-key", "a delta made before the key's window began");
    },
  },
  {
    id: "taken-twice-is-once",
    run: async (make) => {
      const w = await world(make);
      const signed = await signDelta(await deltaOf(w.a, "a.txt", "from a"), w.sa);
      expectOutcome(await takes(w.b, signed), "applied", "the first taking");
      expectOutcome(await takes(w.b, signed), "duplicate", "the second taking of the same delta");
    },
  },
  {
    id: "domains-are-apart",
    run: async (make) => {
      const w = await world(make);
      const d = await deltaOf(w.a, "a.txt", "from a");
      const signature = (await signDelta(d, w.sa)).signature ?? "";
      const id = await deltaId(d);
      for (const domain of ["anyfs-epoch/1", "anyfs-dump/1"] as const) {
        const verdict = await verifySigned(w.roster, domain, id, signature, w.a.replica, Date.now());
        if (verdict !== "bad-signature") throw new ConformanceFailure(`a signature of a delta held for the domain ${domain}: ${verdict}`);
      }
    },
  },
];

/** Runs the cases against replicas a backend makes, and says which failed and how. */
export async function runSigningConformance(make: MakeSigned): Promise<readonly SigningReport[]> {
  const out: SigningReport[] = [];
  for (const c of CASES) {
    try {
      await c.run(make);
      out.push({ id: c.id });
    } catch (thrown) {
      out.push({ id: c.id, failure: thrown instanceof Error ? thrown.message : String(thrown) });
    }
  }
  return out;
}

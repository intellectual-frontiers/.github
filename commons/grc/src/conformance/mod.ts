// Spec: 0001-grc-layers FR-009
/**
 * The conformance suites of the ports (0001-grc-layers FR-009; 0004-grc-documents FR-011, 0005-grc-runners FR-010, 0006-grc-evidence FR-008, 0009-grc-groups FR-011): functions a third party runs against its own runner, store, signer or serializer, each
 * returning every failed expectation as data (an empty list is a pass) and never throwing. This library runs them on every extension it ships.
 *
 * @example
 * ```ts
 * import { storeConformance } from "@intellectual-frontiers/grc/conformance";
 * // const failures = await storeConformance(() => myStore());
 * ```
 *
 * @module
 */
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Check, ControlScope, EntityGroup, EntityId, Exception, Json } from "@intellectual-frontiers/grc/governance";
import {
  type Assessment,
  canonicalize,
  type EntityReader,
  type LedgerEntry,
  type Result as Outcome,
  readGroup,
  groupView,
  type SerializeContext,
  type Serializer,
  snapshotOf,
  GENESIS,
  entityOf,
  type EntityReading,
} from "@intellectual-frontiers/grc/logical";
import { type EntityPorts, entityReader, type EvidenceStore, type GroupMaterial, type Runner, type Signer, type Subject } from "@intellectual-frontiers/grc/physical";

/** One failed expectation. */
export type Failure = { readonly suite: string; readonly name: string; readonly message: string };

async function guarded(suite: string, name: string, body: () => Promise<string | undefined>): Promise<readonly Failure[]> {
  try {
    const m = await body();
    return m === undefined ? [] : [{ suite, name, message: m }];
  } catch (e) {
    return [{ suite, name, message: `threw: ${e instanceof Error ? e.message : String(e)}` }];
  }
}

/** A fixture for a runner: a check, the subject, and the value the runner must observe. */
export type RunnerCase = { readonly name: string; readonly check: Check; readonly subject: Subject; readonly expect: Json };

/** A runner given the fixtures its author gives gives the value each expects, the same twice, and never throws. */
export async function runnerConformance(runner: Runner, cases: readonly RunnerCase[], now: () => string = () => "2026-01-01T00:00:00Z"): Promise<readonly Failure[]> {
  const out: Failure[] = [];
  for (const c of cases) {
    out.push(
      ...(await guarded("runner", c.name, async () => {
        const ctx = { subject: c.subject, now, timeoutMs: 5000 };
        const a = await runner.run(c.check, ctx);
        const b = await runner.run(c.check, ctx);
        if (a.kind === "err" || b.kind === "err") return `the runner gave a problem: ${a.kind === "err" ? a.error.message : b.kind === "err" ? b.error.message : ""}`;
        if (canonicalize(a.value.value) !== canonicalize(c.expect)) return `observed ${canonicalize(a.value.value)}, expected ${canonicalize(c.expect)}`;
        if (canonicalize(a.value.value) !== canonicalize(b.value.value)) return "the same input gave two values";
        return undefined;
      })),
    );
  }
  return out;
}

/** A store: content addressing, an idempotent put, a missing digest, the list with its filter, and, where `tamper` is given, a tampered object. */
export async function storeConformance(
  make: () => EvidenceStore | Promise<EvidenceStore>,
  tamper?: (store: EvidenceStore, digest: string) => Promise<void>,
): Promise<readonly Failure[]> {
  const meta = { subject: "host-1", type: "observation", mediaType: "text/plain", observedAt: "2026-01-01T00:00:00Z" };
  const bytes = new TextEncoder().encode("evidence");
  const out: Failure[] = [];
  out.push(
    ...(await guarded("store", "content addressing", async () => {
      const s = await make();
      const p = await s.put(bytes, meta);
      if (p.kind === "err") return p.error.message;
      if (p.value.digest !== (await sha256(bytes))) return "the digest is not the SHA-256 of the bytes";
      const g = await s.get(p.value.digest);
      if (g.kind === "err" || new TextDecoder().decode(g.value) !== "evidence") return "the bytes did not come back";
      return (await s.has(p.value.digest)) ? undefined : "has says the object is not there";
    })),
    ...(await guarded("store", "idempotent put", async () => {
      const s = await make();
      await s.put(bytes, meta);
      await s.put(bytes, meta);
      const l = await s.list();
      return l.length === 1 ? undefined : `${l.length} objects for the same bytes`;
    })),
    ...(await guarded("store", "a missing digest", async () => {
      const s = await make();
      const g = await s.get("0".repeat(64));
      return g.kind === "err" && g.error.kind === "missing" ? undefined : "a digest that is not there did not give a missing problem";
    })),
    ...(await guarded("store", "list filter", async () => {
      const s = await make();
      await s.put(bytes, meta);
      await s.put(new TextEncoder().encode("other"), { ...meta, subject: "host-2" });
      const l = await s.list({ subject: "host-2" });
      return l.length === 1 && l[0]?.subject === "host-2" ? undefined : "the filter by subject did not give exactly the items of the subject";
    })),
  );
  if (tamper !== undefined) {
    out.push(
      ...(await guarded("store", "a tampered object", async () => {
        const s = await make();
        const p = await s.put(bytes, meta);
        if (p.kind === "err") return p.error.message;
        await tamper(s, p.value.digest);
        const g = await s.get(p.value.digest);
        return g.kind === "err" && g.error.kind === "tampered" ? undefined : "a tampered object was read without a problem";
      })),
    );
  }
  return out;
}

/** The keys a signer is tried with: to sign, to verify, and a pair that is not the same. */
export type SignerKeys = { readonly signing: readonly unknown[]; readonly verifying: readonly unknown[]; readonly otherVerifying: readonly unknown[] };

/** A signer: sign then verify, verify with a wrong key, and a tampered payload. */
export async function signerConformance(signer: Signer, keys: SignerKeys): Promise<readonly Failure[]> {
  const type = "application/vnd.test+json";
  const payload = new TextEncoder().encode("payload");
  const signed = await signer.sign(type, payload, keys.signing);
  const out: Failure[] = [];
  out.push(
    ...(await guarded("signer", "sign then verify", async () => {
      if (signed.kind === "err") return signed.error.message;
      const v = await signer.verify(signed.value, type, keys.verifying);
      return v.kind === "ok" && new TextDecoder().decode(v.value) === "payload" ? undefined : "the signed payload did not verify";
    })),
    ...(await guarded("signer", "a wrong key", async () => {
      if (signed.kind === "err") return signed.error.message;
      const v = await signer.verify(signed.value, type, keys.otherVerifying);
      return v.kind === "err" ? undefined : "a wrong key verified";
    })),
    ...(await guarded("signer", "a tampered payload", async () => {
      if (signed.kind === "err") return signed.error.message;
      const v = await signer.verify({ ...signed.value, payload: btoa("tampered") }, type, keys.verifying);
      return v.kind === "err" ? undefined : "a tampered payload verified";
    })),
  );
  return out;
}

/** A serializer: it names its format and version, is deterministic, gives a value and not an exception for an assessment with no results, and, where `accepts` is given, its output is accepted. */
export async function serializerConformance(
  serializer: Serializer,
  sample: Assessment,
  empty: Assessment,
  context: SerializeContext = {},
  accepts?: (text: string) => string | undefined,
): Promise<readonly Failure[]> {
  return [
    ...(await guarded("serializer", "names its format", () => Promise.resolve(serializer.format !== "" && serializer.version !== "" && serializer.media !== "" ? undefined : "format, version and media must be given"))),
    ...(await guarded("serializer", "deterministic", async () => {
      const a = await serializer.serialize(sample, context);
      const b = await serializer.serialize(sample, context);
      if (a.kind === "err" || b.kind === "err") return "the sample was not written";
      return a.value === b.value ? undefined : "the same assessment gave two documents";
    })),
    ...(await guarded("serializer", "no results", async () => {
      const r = await serializer.serialize(empty, context);
      return r.kind === "ok" || r.error.kind === "unsupported" || r.error.kind === "invalid" ? undefined : "unreachable";
    })),
    ...(accepts === undefined
      ? []
      : await guarded("serializer", "accepted by a decoder of the format", async () => {
          const r = await serializer.serialize(sample, context);
          return r.kind === "err" ? r.error.message : accepts(r.value);
        })),
  ];
}

/** What one entity holds, which only its own ports reach. */
export type EntityData = {
  readonly ledger: readonly LedgerEntry[];
  readonly results: readonly Outcome[];
  readonly exceptions: readonly Exception[];
  readonly store: EvidenceStore;
};

/** The case a group's way of making readers is tried with: the group, its scope and material, what each entity holds, and the instant. */
export type GroupCase = {
  readonly group: EntityGroup;
  readonly scope: ControlScope;
  readonly material: GroupMaterial;
  readonly data: ReadonlyMap<EntityId, EntityData>;
  readonly exceptions: readonly Exception[];
  readonly at: string;
};

type Breach = { readonly reading: EntityId; readonly touched: EntityId; readonly port: string };

/**
 * A group's readers over per-entity ports that cannot see each other: while an entity's reader runs, the ports of every other entity throw. It checks that every entity is read, that the view is the
 * same as the one made from the snapshots alone, that an entity that cannot be read is `pending` and the others are unchanged, and that no reader touches another entity's ports.
 *
 * @example
 * ```ts
 * // const failures = await groupConformance({ group, scope, material, data, exceptions: [], at }); // [] is a pass
 * ```
 */
export async function groupConformance(
  c: GroupCase,
  make: (ports: EntityPorts, material: GroupMaterial) => EntityReader = entityReader,
): Promise<readonly Failure[]> {
  const controls = c.material.frameworks.flatMap((f) => f.controls.map((x) => `urn:grc:${f.id}:${f.version}:${x.id}`));
  const breaches: Breach[] = [];
  let active: EntityId | undefined;
  let down: EntityId | undefined;
  const touch = (owner: EntityId, port: string): void => {
    if (down === owner) throw new Error(`${owner} cannot be reached`);
    if (active !== undefined && active !== owner) {
      breaches.push({ reading: active, touched: owner, port });
      throw new Error(`the reader of ${active} touched the ${port} of ${owner}`);
    }
  };
  const portsOf = (entity: EntityId, d: EntityData): EntityPorts => ({
    entity,
    ledger: { entries: () => (touch(entity, "ledger"), Promise.resolve(d.ledger)) },
    results: { list: () => (touch(entity, "results"), Promise.resolve(d.results)) },
    exceptions: { list: () => (touch(entity, "exceptions"), Promise.resolve(d.exceptions)) },
    store: {
      id: d.store.id,
      put: (b, m) => (touch(entity, "store"), d.store.put(b, m)),
      get: (x) => (touch(entity, "store"), d.store.get(x)),
      has: (x) => (touch(entity, "store"), d.store.has(x)),
      list: (f) => (touch(entity, "store"), d.store.list(f)),
    },
  });
  const readers = (): ReadonlyMap<EntityId, EntityReader> => {
    let tail: Promise<unknown> = Promise.resolve();
    const m = new Map<EntityId, EntityReader>();
    for (const [entity, d] of c.data) {
      const reader = make(portsOf(entity, d), c.material);
      m.set(entity, (at) => {
        const run = tail.then(async () => {
          active = entity;
          try {
            return await reader(at);
          } finally {
            active = undefined;
          }
        });
        tail = run.catch(() => undefined);
        return run;
      });
    }
    return m;
  };
  const view = (readings: readonly EntityReading[]) => groupView({ group: c.group, scope: c.scope, controls, readings, exceptions: c.exceptions, at: c.at });
  const out: Failure[] = [];
  const direct = async (): Promise<readonly EntityReading[]> => {
    const readings: EntityReading[] = [];
    for (const [entity, d] of c.data) {
      const s = await snapshotOf({ entity, ...c.material, results: d.results, exceptions: d.exceptions, ledgerHead: d.ledger.at(-1)?.digest ?? GENESIS }, c.at);
      if (s.kind === "ok") readings.push({ kind: "read", snapshot: s.value });
    }
    return readings;
  };
  out.push(
    ...(await guarded("group", "every entity is read", async () => {
      const r = await readGroup(c.group, readers(), c.at);
      const bad = r.filter((x) => x.kind === "unread").map((x) => `${entityOf(x)}: ${x.kind === "unread" ? x.fault.message : ""}`);
      return bad.length === 0 && r.length === c.group.entities.length ? undefined : `not read: ${bad.join("; ") || "an entity has no reading"}`;
    })),
    ...(await guarded("group", "the view is that of the snapshots alone", async () => {
      const r = await readGroup(c.group, readers(), c.at);
      return canonicalize(view(r)) === canonicalize(view(await direct())) ? undefined : "the view differs from the one made from each entity's own snapshot";
    })),
    ...(await guarded("group", "an entity that cannot be read is pending", async () => {
      const [first] = [...c.data.keys()];
      if (first === undefined) return undefined;
      const all = view(await readGroup(c.group, readers(), c.at));
      down = first;
      const r = await readGroup(c.group, readers(), c.at);
      down = undefined;
      const v = view(r);
      const mine = v.cells.filter((x) => x.entity === first && x.status !== "not-applicable");
      if (mine.some((x) => x.status !== "pending")) return `${first} was not read and a cell of it is not pending`;
      const others = (x: typeof v): string => canonicalize(x.cells.filter((cell) => cell.entity !== first));
      return others(v) === others(all) ? undefined : "an entity that could not be read changed the cells of the others";
    })),
    ...(await guarded("group", "no reader touches another entity's ports", async () => {
      breaches.length = 0;
      await readGroup(c.group, readers(), c.at);
      return breaches.length === 0 ? undefined : breaches.map((b) => `the reader of ${b.reading} touched the ${b.port} of ${b.touched}`).join("; ");
    })),
  );
  return out;
}

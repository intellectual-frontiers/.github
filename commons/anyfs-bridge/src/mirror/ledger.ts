// Spec: 0006-bridge-mirrored FR-006
/**
 * The ledgers of a mirror, kept on its primary: one document for each replica, in a collection of typed documents below a reserved prefix, so that what each replica was last brought to is in the place that
 * is authoritative and not in the memory of a process. A ledger is written at the version of its schema and read at any version up to it; a document that cannot be read is a problem and never an empty ledger,
 * because an empty ledger would make every change of the replica look like a divergence of its own.
 *
 * @example
 * ```ts
 * import { ledgerDoc } from "./ledger.ts";
 * ledgerDoc("git", { applied: new Map() }); // { replica: "git", applied: [] }
 * ```
 *
 * @module
 */
import { array, err, object, ok, type Result, string, tuple } from "@intellectual-frontiers/core";
import { byId, collection, type Collection, defineSchema, describeDocProblem, type DocId, jsonTree, parseExtension, versioned } from "@intellectual-frontiers/anyfs/docs";
import { comparePaths, expectAny, type Path, parsePath, type Prefix } from "@intellectual-frontiers/anyfs/governance";
import type { Change } from "@intellectual-frontiers/anyfs/logical";
import type { Dest, Ledger } from "@intellectual-frontiers/anyfs-bridge/logical";

/** The document of a ledger: the replica it is of and, for each path, the SHA-256 in hex of the bytes the replica was last brought to. */
export type LedgerDoc = { readonly replica: string; readonly applied: readonly (readonly [string, string])[] };

/** The document of a ledger, its paths in order. */
export function ledgerDoc(replica: string, ledger: Ledger): LedgerDoc {
  return { replica, applied: [...ledger.applied.entries()].sort((a, b) => comparePaths(a[0], b[0])).map(([p, d]) => [p, d] as const) };
}

/** The ledger of a document, or the path that is not one. */
export function ledgerOf(doc: LedgerDoc): Result<Ledger, string> {
  const applied = new Map<Path, string>();
  for (const [text, digest] of doc.applied) {
    const p = parsePath(text);
    if (p.kind === "err") return err(`the ledger of ${doc.replica} names ${JSON.stringify(text)}: ${p.error}`);
    applied.set(p.value, digest);
  }
  return ok({ applied });
}

/** What the ledgers were asked and could not do. */
export type LedgerProblem = { readonly kind: "unreadable"; readonly replica: string; readonly detail: string } | { readonly kind: "unwritable"; readonly replica: string; readonly detail: string };

/** The ledgers of a mirror. */
export type LedgerBook = {
  /** The ledger of a replica: an empty one where there is none, and a problem where one is there and cannot be read. */
  load(replica: DocId): Promise<Result<Ledger, LedgerProblem>>;
  save(replica: DocId, ledger: Ledger): Promise<Result<void, LedgerProblem>>;
  /** Saves several ledgers: as one batch where the primary has one (one commit of a branch, not one for each), else one after the other. */
  saveMany(entries: readonly { readonly replica: DocId; readonly ledger: Ledger }[]): Promise<Result<void, LedgerProblem>>;
  /** Takes the ledger of a replica away, where it can be; what cannot be taken away is left. */
  remove(replica: DocId): Promise<void>;
};

const schema = defineSchema<LedgerDoc>({
  current: 1,
  decoder: object({ replica: string, applied: array(tuple(string, string)) }),
});

/** The ledgers below `prefix` of the primary. */
export function ledgerBook(primary: Dest, prefix: Prefix): Result<LedgerBook, string> {
  const extension = parseExtension(".json");
  if (extension.kind === "err") return extension;
  if (schema.kind === "err") return schema;
  const codec = versioned(jsonTree, schema.value);
  const layout = byId(extension.value);
  const docs: Collection<LedgerDoc, DocId, "read" | "write" | "list" | "stat" | "delete"> = collection(primary, { prefix, layout, codec });
  const book: LedgerBook = {
    async load(replica) {
      const got = await docs.get(replica);
      if (got.kind === "err") return got.error.kind === "store" && got.error.problem.kind === "missing" ? ok({ applied: new Map<Path, string>() }) : err({ kind: "unreadable", replica, detail: describeDocProblem(got.error) });
      const ledger = ledgerOf(got.value.value);
      return ledger.kind === "ok" ? ledger : err({ kind: "unreadable", replica, detail: ledger.error });
    },
    async save(replica, ledger) {
      const put = await docs.put(replica, ledgerDoc(replica, ledger), expectAny);
      return put.kind === "ok" ? ok(undefined) : err({ kind: "unwritable", replica, detail: describeDocProblem(put.error) });
    },
    async saveMany(entries) {
      if (entries.length === 0) return ok(undefined);
      if (!primary.capabilities.has("batch")) {
        for (const e of entries) {
          const one = await book.save(e.replica, e.ledger);
          if (one.kind === "err") return one;
        }
        return ok(undefined);
      }
      const changes: Change[] = [];
      for (const e of entries) {
        const at = docs.pathOf(e.replica);
        if (at.kind === "err") return err({ kind: "unwritable", replica: e.replica, detail: describeDocProblem(at.error) });
        const body = codec.encode(ledgerDoc(e.replica, e.ledger));
        if (body.kind === "err") return err({ kind: "unwritable", replica: e.replica, detail: body.error.detail });
        changes.push({ kind: "put", path: at.value, bytes: body.value, expect: expectAny });
      }
      const done = await primary.handle({ op: "batch", changes });
      return done.kind === "ok" ? ok(undefined) : err({ kind: "unwritable", replica: entries[0]?.replica ?? "", detail: `${done.error.kind}` });
    },
    async remove(replica) {
      await docs.delete(replica, expectAny);
    },
  };
  return ok(book);
}

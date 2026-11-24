// Spec: 0007-bridge-exchange FR-001, FR-002
/**
 * What a medium holds of an exchange, and how it is named. A replica publishes each delta of its own rows once, as a file whose name says whose it is, which of the replica's rows it holds and what the delta is (its
 * identity is the SHA-256 of its text, so a file never changes and two replicas that publish the same delta publish one file). A replica publishes the vector it holds as a file of its own, which it writes again as
 * it grows. Nothing else is written to the medium.
 *
 * @example
 * ```ts
 * import { deltaPath, parseDeltaPath } from "./names.ts";
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { type Path, parsePath, parsePrefix, type Prefix, type ReplicaId, parseReplicaId } from "@intellectual-frontiers/anyfs/governance";

/** The prefix below which the deltas are kept. */
export const DELTAS_PREFIX = "deltas/";
/** The prefix below which the vectors are kept. */
export const VECTORS_PREFIX = "vectors/";

/** The prefix of the deltas of everyone. */
export const deltasPrefix = (): Prefix => {
  const p = parsePrefix("deltas");
  if (p.kind === "err") throw new Error(p.error);
  return p.value;
};

/** The prefix of the vectors of everyone. */
export const vectorsPrefix = (): Prefix => {
  const p = parsePrefix("vectors");
  if (p.kind === "err") throw new Error(p.error);
  return p.value;
};

const DIGITS = 12;
const pad = (n: number): string => n.toString().padStart(DIGITS, "0");

/** What the name of a delta file says: whose rows it holds, the numbers of the first and the last, and the identity of the delta. */
export type DeltaName = { readonly replica: ReplicaId; readonly from: number; readonly to: number; readonly id: string };

/** The path of a delta file. */
export function deltaPath(name: DeltaName): Result<Path, string> {
  if (!Number.isSafeInteger(name.from) || !Number.isSafeInteger(name.to) || name.from < 1 || name.to < name.from) return err("a delta holds rows from a number of at least 1 to a number not less");
  if (!/^[0-9a-f]{64}$/u.test(name.id)) return err("the identity of a delta is 64 lower case hexadecimal digits");
  return parsePath(`${DELTAS_PREFIX}${name.replica}/${pad(name.from)}-${pad(name.to)}-${name.id}.delta`);
}

const DELTA = /^deltas\/([0-9a-f]{32})\/(\d{12})-(\d{12})-([0-9a-f]{64})\.delta$/u;

/** What the path of a file says of the delta in it, or why it is not the path of a delta. */
export function parseDeltaPath(path: string): Result<DeltaName, string> {
  const m = DELTA.exec(path);
  if (m === null) return err(`${JSON.stringify(path.slice(0, 80))} is not the path of a delta file`);
  const replica = parseReplicaId(m[1] as string);
  if (replica.kind === "err") return replica;
  const from = Number(m[2]);
  const to = Number(m[3]);
  if (from < 1 || to < from) return err(`the numbers of a delta are from 1 and not backwards: ${from} to ${to}`);
  return ok({ replica: replica.value, from, to, id: m[4] as string });
}

/** The path of the vector a replica publishes. */
export function vectorPath(replica: ReplicaId): Path {
  const p = parsePath(`${VECTORS_PREFIX}${replica}.json`);
  if (p.kind === "err") throw new Error(p.error);
  return p.value;
}

const VECTOR = /^vectors\/([0-9a-f]{32})\.json$/u;

/** The replica a vector file is of, or why the path is not one. */
export function parseVectorPath(path: string): Result<ReplicaId, string> {
  const m = VECTOR.exec(path);
  return m === null ? err(`${JSON.stringify(path.slice(0, 80))} is not the path of a vector file`) : parseReplicaId(m[1] as string);
}

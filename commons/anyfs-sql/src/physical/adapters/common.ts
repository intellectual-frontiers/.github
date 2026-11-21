// Spec: 0003-sql-port FR-003, FR-004
/**
 * What the adapters share: a gate that lets one transaction at a time use a connection (so that a read on a connection never sees the half-made change of a transaction another task has open), and the
 * reading of a value a driver gives into a value of the port. A driver gives a number for a small integer, a wide integer for a large one, a text where a database has no integer, bytes as bytes,
 * a buffer or an array buffer: each is made into one of the five values the port knows.
 *
 * @example
 * ```ts
 * import { Gate, valueOf } from "./common.ts";
 * valueOf(new ArrayBuffer(2)); // Uint8Array [0, 0]
 * ```
 *
 * @module
 */
import type { SqlRow, SqlValue } from "@intellectual-frontiers/anyfs-sql/governance";

/** A gate: what runs through it runs one at a time, in the order it came. */
export class Gate {
  #tail: Promise<void> = Promise.resolve();

  /** Runs the function when everything before it has ended. */
  async run<T>(work: () => Promise<T>): Promise<T> {
    const before = this.#tail;
    let release: () => void = () => undefined;
    this.#tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await before;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

/** A value a driver gave, as a value of the port. */
export function valueOf(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  switch (typeof value) {
    case "bigint":
    case "number":
    case "string":
      return value;
    case "boolean":
      return value ? 1 : 0;
    default:
      break;
  }
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** A row a driver gave (an object, often with no prototype), as a row of the port. */
export function rowOf(row: unknown): SqlRow {
  const out: Record<string, SqlValue> = {};
  if (typeof row === "object" && row !== null) for (const [k, v] of Object.entries(row)) out[k] = valueOf(v);
  return out;
}

/** The gates of the files this process has open: two connections to one file in one process share one, since a connection that waits for the other's lock would stop the process the other needs. */
const FILE_GATES = new Map<string, Gate>();

/** The gate of a file by its absolute path. */
export function gateOfFile(absolute: string): Gate {
  const have = FILE_GATES.get(absolute);
  if (have !== undefined) return have;
  const made = new Gate();
  FILE_GATES.set(absolute, made);
  return made;
}

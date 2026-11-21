// Spec: 0007-bridge-exchange FR-004
/**
 * What a replica keeps of its exchange, on its own side: the number of its last row that it has published, and the delta files it has taken from the medium (applied, or put aside as not to be taken). It is never
 * written to the medium. A cursor that is lost costs time and nothing else, because a delta applied twice has the effect of once and a file published again is the same file.
 *
 * @example
 * ```ts
 * import { memoryCursor } from "./cursor.ts";
 * const cursor = memoryCursor();
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { describeProblem, expectAny, type Path } from "@intellectual-frontiers/anyfs/governance";
import type { Store } from "@intellectual-frontiers/anyfs/logical";

/** What a cursor holds. */
export type CursorState = {
  /** The number of the last of the replica's own rows that it has published, 0 where it has published none. */
  readonly published: number;
  /** The paths of the delta files taken. */
  readonly applied: readonly string[];
  /** The paths of the delta files put aside, which are not tried again. */
  readonly quarantined: readonly string[];
};

/** A cursor with nothing in it. */
export const EMPTY_CURSOR: CursorState = { published: 0, applied: [], quarantined: [] };

/** Where the state of an exchange is kept. */
export type Cursor = {
  load(): Promise<Result<CursorState, string>>;
  save(state: CursorState): Promise<Result<void, string>>;
};

/** A cursor that lives as long as the program does. */
export function memoryCursor(initial: CursorState = EMPTY_CURSOR): Cursor {
  let state = initial;
  return {
    load: async () => ok(state),
    save: async (next) => {
      state = next;
      return ok(undefined);
    },
  };
}

const sortedText = (xs: readonly string[]): readonly string[] => [...new Set(xs)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** The text a cursor is kept as: JSON, with its lists sorted. */
export function encodeCursor(state: CursorState): string {
  return JSON.stringify({ format: 1, published: state.published, applied: sortedText(state.applied), quarantined: sortedText(state.quarantined) });
}

/** A cursor from its text, or why it is not one. */
export function decodeCursor(text: string): Result<CursorState, string> {
  let x: unknown;
  try {
    x = JSON.parse(text) as unknown;
  } catch {
    return err("a cursor is JSON");
  }
  if (typeof x !== "object" || x === null) return err("a cursor is an object");
  const o = x as { readonly [k: string]: unknown };
  const list = (v: unknown): readonly string[] | undefined => (Array.isArray(v) && v.every((e) => typeof e === "string") ? (v as string[]) : undefined);
  const applied = list(o["applied"]);
  const quarantined = list(o["quarantined"]);
  if (o["format"] !== 1 || typeof o["published"] !== "number" || !Number.isSafeInteger(o["published"]) || o["published"] < 0 || applied === undefined || quarantined === undefined) return err("a cursor is format 1 with a number published and two lists");
  return ok({ published: o["published"], applied, quarantined });
}

/** A cursor kept as one file of a store of this replica's own (never the medium). */
export function storeCursor(store: Store<"read" | "write">, path: Path): Cursor {
  return {
    load: async () => {
      const r = await store.read(path);
      if (r.kind === "err") return r.error.kind === "missing" ? ok(EMPTY_CURSOR) : err(describeProblem(r.error));
      return decodeCursor(new TextDecoder().decode(r.value.bytes));
    },
    save: async (state) => {
      const w = await store.write(path, new TextEncoder().encode(encodeCursor(state)), expectAny);
      return w.kind === "err" ? err(describeProblem(w.error)) : ok(undefined);
    },
  };
}

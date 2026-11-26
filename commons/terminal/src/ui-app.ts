// Spec: 0002-ui FR-023
/**
 * The loop of an interactive screen (commons terminal 0002-ui FR-023): `runScreen` enters the alternate screen, draws a view from a state,
 * redraws on each key and on a resize, and gives back the value the caller's `onKey` ended with. It leaves the alternate screen and
 * shows the cursor again on the end, on the abort of the signal and when the caller's functions throw (the error goes on). It uses the
 * sequences and the frame of the full screen of the flow, so a test reads it on the emulator of `vt`.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import type { UiCaps } from "./ui-caps.ts";
import type { UiOut } from "./ui-driver.ts";
import type { KeyReader, Key } from "./ui-keys.ts";
import { type Drawn, ENTER, frameOf, LEAVE } from "./ui-screen.ts";

/** What a key did to the state of a screen: the next state, or the value the screen ends with. */
export type ScreenStep<S, V> = { readonly kind: "state"; readonly state: S } | { readonly kind: "done"; readonly value: V };

/** How a screen ended without a value. */
export type ScreenEnd =
  | { readonly kind: "aborted" }
  | { readonly kind: "end" }
  /** The caps are not `full`, or the input is not a TTY: nothing was drawn; the caller goes on in lines. */
  | { readonly kind: "not-interactive" };

/** What `runScreen` is given. */
export type ScreenOptions<S, V> = {
  /** The state the screen starts with. */
  readonly init: S;
  /** The screen for a state at a size: exactly that many lines of exactly that many columns, and the cursor where the person types. */
  readonly view: (state: S, size: { readonly columns: number; readonly rows: number }) => Drawn;
  /** What a key does to the state; Ctrl+C is not given to it: it aborts. */
  readonly onKey: (state: S, key: Key) => ScreenStep<S, V>;
  readonly out: Pick<UiOut, "write" | "columns" | "rows" | "onResize">;
  /** The keys, from a raw input whose raw mode the caller has set. */
  readonly in: KeyReader;
  readonly caps: Pick<UiCaps, "level" | "columns" | "rows">;
  readonly signal?: AbortSignal | undefined;
};

/** Runs a screen to the value it ends with, or to how it ended without one. */
export async function runScreen<S, V>(o: ScreenOptions<S, V>): Promise<Result<V, ScreenEnd>> {
  if (o.caps.level !== "full" || !o.in.isTTY) return err({ kind: "not-interactive" });
  if (o.signal?.aborted === true) return err({ kind: "aborted" });
  let state = o.init;
  const size = (): { columns: number; rows: number } => ({ columns: o.out.columns ?? o.caps.columns, rows: o.out.rows ?? o.caps.rows });
  const draw = (): void => o.out.write(frameOf(o.view(state, size())));
  o.out.write(ENTER);
  const unsubscribe = o.out.onResize?.(() => {
    try {
      draw();
    } catch {
      // A failure of the view surfaces on the next key; a resize never throws into the terminal.
    }
  });
  try {
    draw();
    for (;;) {
      const got = await o.in.read(o.signal);
      if (got.kind === "aborted") return err({ kind: "aborted" });
      if (got.kind === "end") return err({ kind: "end" });
      if (got.kind === "unknown") continue;
      if (got.key.name === "ctrl-c") return err({ kind: "aborted" });
      const next = o.onKey(state, got.key);
      if (next.kind === "done") return ok(next.value);
      state = next.state;
      draw();
    }
  } finally {
    unsubscribe?.();
    o.out.write(LEAVE);
  }
}

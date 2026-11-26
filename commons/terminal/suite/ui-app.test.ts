/**
 * Tests of `runScreen` (commons terminal 0002-ui FR-023): redraw on key and resize on the emulator, the value, and the terminal restored on
 * abort, Ctrl+C, the end of the input and a throw.
 *
 * @module
 */
import { type Key, keyReader, type RawIn, renderSelect, runScreen, selectKey, selectStart, type SelectState } from "../src/ui.ts";
import { createScreen } from "../src/vt.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";
import { capsOf, recorder } from "./ui-helpers.ts";

const FR = "0002-ui FR-023";

/** A raw input the test types into. */
function typist(): RawIn & { type(text: string): void; end(): void } {
  const queue: string[] = [];
  let wake: (() => void) | undefined;
  let ended = false;
  return {
    isTTY: true,
    type(t) {
      queue.push(t);
      wake?.();
    },
    end() {
      ended = true;
      wake?.();
    },
    async readRaw(signal) {
      for (;;) {
        const t = queue.shift();
        if (t !== undefined) return { kind: "data", text: t };
        if (ended) return { kind: "end" };
        if (signal?.aborted === true) return { kind: "aborted" };
        await new Promise<void>((r) => {
          wake = r;
          signal?.addEventListener("abort", () => r(), { once: true });
        });
      }
    },
  };
}

const items = ["Enroll a server", "Converge a host", "Manage access"].map((label, i) => ({ id: `synthetic-task-${i + 1}`, label }));
const view = (s: SelectState, size: { columns: number; rows: number }) => renderSelect(s, size, { colour: false });
const onKey = (s: SelectState, k: Key) => {
  const r = selectKey(s, k);
  return r.outcome === undefined ? ({ kind: "state", state: r.state } as const) : ({ kind: "done", value: r.outcome } as const);
};
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 5));
const screenOf = (writes: string, w: number, h: number) => {
  const s = createScreen({ width: w, height: h });
  s.write(writes);
  return s;
};

proves([FR], "draws, redraws on a key and on a resize, and returns the value", async () => {
  const out = recorder(40, 6);
  const t = typist();
  const p = runScreen({ init: selectStart(items), view, onKey, out, in: keyReader(t), caps: capsOf("full", 40, 6) });
  await settle();
  assert(out.text().startsWith("\u001b[?1049h"));
  assertEquals(screenOf(out.text(), 40, 6).lines()[0], "> Enroll a server");
  t.type("\u001b[B");
  await settle();
  assertEquals(screenOf(out.text(), 40, 6).lines()[1], "> Converge a host");
  out.resize(24, 4);
  await settle();
  const s = screenOf(out.text(), 24, 4);
  assertEquals(s.lines()[1], "> Converge a host");
  t.type("\r\n");
  const r = await p;
  assertEquals(r, { kind: "ok", value: { kind: "chosen", id: "synthetic-task-2" } });
  assert(out.text().endsWith("\u001b[?25h\u001b[?1049l"));
});

proves([FR], "the abort of the signal, Ctrl+C and the end of the input leave the alternate screen", async () => {
  for (const how of ["signal", "ctrl-c", "end"] as const) {
    const out = recorder(40, 6);
    const t = typist();
    const c = new AbortController();
    const p = runScreen({ init: selectStart(items), view, onKey, out, in: keyReader(t), caps: capsOf("full", 40, 6), signal: c.signal });
    await settle();
    if (how === "signal") c.abort();
    else if (how === "ctrl-c") t.type("\u0003");
    else t.end();
    const r = await p;
    assertEquals(r, { kind: "err", error: { kind: how === "end" ? "end" : "aborted" } });
    assert(out.text().endsWith("\u001b[?25h\u001b[?1049l"), how);
    assertEquals(out.text().split("\u001b[?1049h").length, 2, "entered once");
  }
});

proves([FR], "a throw in the view or in onKey restores the terminal and goes on", async () => {
  for (const where of ["view", "onKey"] as const) {
    const out = recorder(40, 6);
    const t = typist();
    const p = runScreen({
      init: 0,
      view: (n: number, size) => {
        if (where === "view" && n > 0) throw new Error("synthetic view failure");
        return { lines: Array.from({ length: size.rows }, () => " ".repeat(size.columns)), cursor: undefined };
      },
      onKey: (n: number) => {
        if (where === "onKey") throw new Error("synthetic key failure");
        return { kind: "state", state: n + 1 } as const;
      },
      out,
      in: keyReader(t),
      caps: capsOf("full", 40, 6),
    });
    await settle();
    t.type("a");
    let failed = "";
    try {
      await p;
    } catch (e) {
      failed = (e as Error).message;
    }
    assertEquals(failed, `synthetic ${where === "view" ? "view" : "key"} failure`);
    assert(out.text().endsWith("\u001b[?25h\u001b[?1049l"));
  }
});

proves([FR], "not interactive: plain or a pipe writes nothing and says so", async () => {
  const out = recorder(40, 6);
  const t = typist();
  const plain = await runScreen({ init: selectStart(items), view, onKey, out, in: keyReader(t), caps: capsOf("plain", 40, 6) });
  assertEquals(plain, { kind: "err", error: { kind: "not-interactive" } });
  const pipe = await runScreen({ init: selectStart(items), view, onKey, out, in: keyReader({ ...t, isTTY: false }), caps: capsOf("full", 40, 6) });
  assertEquals(pipe, { kind: "err", error: { kind: "not-interactive" } });
  assertEquals(out.writes.length, 0);
});

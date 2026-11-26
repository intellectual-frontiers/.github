/**
 * Tests of `src/ui-keys.ts` (commons terminal 0002-ui FR-019): keys from Unix and Windows sequences, unknown sequences as values, a chunk
 * of several keys in order, the end and the abort.
 *
 * @module
 */
import { decodeKeys, keyReader, rawReader, type Key } from "../src/ui.ts";
import { assert, assertEquals, proves } from "@intellectual-frontiers/test";

const FR = "0002-ui FR-019";
const names = (s: string): string[] => decodeKeys(s).map((r) => (r.kind === "ok" ? (r.value.name === "char" ? r.value.text : r.value.name) : `?${r.error.sequence}`));

proves([FR], "arrows, Enter, Esc, Tab, Backspace, Ctrl+C and printable characters", () => {
  assertEquals(names("\u001b[A\u001b[B\u001b[C\u001b[D"), ["up", "down", "right", "left"]);
  assertEquals(names("\r\t\u007f\u0003\u001b"), ["enter", "tab", "backspace", "ctrl-c", "escape"]);
  assertEquals(names("ab /é"), ["a", "b", " ", "/", "é"]);
  assertEquals(names("\u001b[3~\u001b[5~\u001b[6~\u001b[H\u001b[F\u001b[Z"), ["delete", "pageup", "pagedown", "home", "end", "shift-tab"]);
});

proves([FR], "Windows: CR, LF and CRLF are each one Enter; SS3 arrows, scan codes and a modifier on an arrow", () => {
  assertEquals(names("\r\n"), ["enter"]);
  assertEquals(names("\r\n\r\n"), ["enter", "enter"]);
  assertEquals(names("\n"), ["enter"]);
  assertEquals(names("\u001bOA\u001bOB"), ["up", "down"]);
  assertEquals(names("àHàP\u0000K\u0000M"), ["up", "down", "left", "right"]);
  assertEquals(names("\u001b[1;5A"), ["up"]);
  assertEquals(names("\b"), ["backspace"]);
});

proves([FR], "an unknown sequence is an err in its place and the rest is decoded", () => {
  assertEquals(names("a\u001b[99Xb"), ["a", "?\u001b[99X", "b"]);
  assertEquals(names("\u001bx"), ["?\u001bx"]);
  assertEquals(names("\u0001"), ["?\u0001"]);
  assertEquals(names("\u001b["), ["?\u001b["]);
});

async function* chunks(...c: string[]): AsyncGenerator<string> {
  for (const x of c) yield x;
}

proves([FR], "the reader gives the keys of a chunk in order, then the end", async () => {
  const r = keyReader(rawReader(chunks("ab", "\u001b[A\r\n"), true));
  const got: string[] = [];
  for (;;) {
    const k = await r.read();
    if (k.kind === "end") break;
    got.push(k.kind === "key" ? (k.key as Key).name + (k.key.text === "" ? "" : `:${k.key.text}`) : k.kind);
  }
  assertEquals(got, ["char:a", "char:b", "up", "enter"]);
});

proves([FR], "the reader gives an unknown sequence as unknown, and the abort of the signal", async () => {
  const r = keyReader(rawReader(chunks("\u001b[99X"), true));
  assertEquals((await r.read()).kind, "unknown");
  const never = keyReader({ isTTY: true, readRaw: () => new Promise(() => undefined) });
  const c = new AbortController();
  const p = never.read(c.signal);
  c.abort();
  // The raw input never answers: the abort is the caller's to honour through readRaw, so a raw input that does honour it is used here.
  const honours = keyReader(rawReader({ [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<string>>(() => undefined) }) }, true));
  const c2 = new AbortController();
  const q = honours.read(c2.signal);
  c2.abort();
  assertEquals(await q, { kind: "aborted" });
  assert(p instanceof Promise);
});

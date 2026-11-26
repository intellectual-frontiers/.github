// Spec: 0002-ui FR-019
/**
 * The keys of a terminal in raw mode (commons terminal 0002-ui FR-019): `decodeKeys` turns what a terminal sends into typed keys (arrows,
 * Enter, Esc, Tab, Backspace, Ctrl+C and printable characters, from a Unix terminal and from Windows, where Enter is `\r` or `\r\n` and
 * the arrows may come as `ESC O A` or as a scan code), and `keyReader` reads them from a raw input the caller supplies. The caller sets
 * the raw mode of the terminal; this module never names the host.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { ABORT, raceAbort } from "./ui-driver.ts";

/** The named keys; a printable character is `char` with its text. */
export type KeyName =
  | "char"
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "pageup"
  | "pagedown"
  | "delete"
  | "enter"
  | "escape"
  | "tab"
  | "shift-tab"
  | "backspace"
  | "ctrl-c"
  | "ctrl-d";

/** One key: its name, and for `char` the character typed. */
export type Key = { readonly name: KeyName; readonly text: string };

/** A sequence that is no key this module knows. */
export type KeyError = { readonly kind: "unknown-sequence"; readonly sequence: string };

const named = (name: KeyName): Key => ({ name, text: "" });
const ESC = "\u001b";

const LETTERS: Readonly<Record<string, KeyName>> = { A: "up", B: "down", C: "right", D: "left", H: "home", F: "end", Z: "shift-tab" };
const TILDES: Readonly<Record<string, KeyName>> = { "1": "home", "3": "delete", "4": "end", "5": "pageup", "6": "pagedown", "7": "home", "8": "end" };
// The scan codes a legacy Windows console sends after 0x00 or 0xE0.
const SCAN: Readonly<Record<string, KeyName>> = { H: "up", P: "down", K: "left", M: "right", G: "home", O: "end", I: "pageup", Q: "pagedown", S: "delete" };

/**
 * Decodes what one read of a raw terminal gave into keys, in order; a sequence that is not known is an `err` in its place and the rest is
 * still decoded. `\r\n`, `\r` and `\n` are each one Enter; an `ESC` alone is Escape; a modifier on an arrow (`ESC [ 1 ; 5 A`) is ignored.
 */
export function decodeKeys(input: string): readonly Result<Key, KeyError>[] {
  const out: Result<Key, KeyError>[] = [];
  const cs = [...input];
  let i = 0;
  while (i < cs.length) {
    const c = cs[i] ?? "";
    i++;
    if (c === ESC) {
      const n = cs[i];
      if (n === undefined) out.push(ok(named("escape")));
      else if (n === "[" || n === "O") {
        let j = i + 1;
        let params = "";
        while (j < cs.length && /[0-9;]/.test(cs[j] ?? "")) params += cs[j++];
        const f = cs[j];
        const seq = cs.slice(i - 1, j + 1).join("");
        if (f === undefined) out.push(err({ kind: "unknown-sequence", sequence: seq }));
        else {
          const k = f === "~" ? TILDES[params.split(";")[0] ?? ""] : LETTERS[f];
          out.push(k === undefined ? err({ kind: "unknown-sequence", sequence: seq }) : ok(named(k)));
          j++;
        }
        i = j;
      } else {
        out.push(err({ kind: "unknown-sequence", sequence: ESC + n }));
        i++;
      }
    } else if (c === "\r") {
      if (cs[i] === "\n") i++;
      out.push(ok(named("enter")));
    } else if (c === "\n") out.push(ok(named("enter")));
    else if (c === "\t") out.push(ok(named("tab")));
    else if (c === "\u007f" || c === "\b") out.push(ok(named("backspace")));
    else if (c === "\u0003") out.push(ok(named("ctrl-c")));
    else if (c === "\u0004") out.push(ok(named("ctrl-d")));
    else if ((c === "à" || c === "\u0000") && cs[i] !== undefined) {
      const k = SCAN[cs[i] ?? ""];
      out.push(k === undefined ? err({ kind: "unknown-sequence", sequence: c + (cs[i] ?? "") }) : ok(named(k)));
      i++;
    } else if ((c.codePointAt(0) ?? 0) < 0x20 || c === "\u007f" || /^[\u0080-\u009f]$/.test(c)) out.push(err({ kind: "unknown-sequence", sequence: c }));
    else out.push(ok({ name: "char", text: c }));
  }
  return out;
}

/** What one read of the raw input gave: text, the end, or the abort of the signal. */
export type RawRead = { readonly kind: "data"; readonly text: string } | { readonly kind: "end" } | { readonly kind: "aborted" };

/** The raw input the caller supplies, with its raw mode already set by the caller. */
export type RawIn = {
  /** True where a person is at it (a TTY). */
  readonly isTTY: boolean;
  /** The next chunk of what was typed, as text. */
  readRaw(signal?: AbortSignal): Promise<RawRead>;
};

/** What reading a key gave. */
export type KeyRead =
  | { readonly kind: "key"; readonly key: Key }
  | { readonly kind: "unknown"; readonly error: KeyError }
  | { readonly kind: "end" }
  | { readonly kind: "aborted" };

/** Keys, one at a time. */
export type KeyReader = {
  readonly isTTY: boolean;
  read(signal?: AbortSignal): Promise<KeyRead>;
};

/** A raw input over any stream of chunks (text or UTF-8 bytes), such as `process.stdin` once its raw mode is on. */
export function rawReader(chunks: AsyncIterable<string | Uint8Array>, isTTY: boolean): RawIn {
  const it = chunks[Symbol.asyncIterator]();
  const decoder = new TextDecoder();
  let pending: Promise<IteratorResult<string | Uint8Array>> | undefined;
  let ended = false;
  return {
    isTTY,
    async readRaw(signal) {
      if (ended) return { kind: "end" };
      if (signal?.aborted === true) return { kind: "aborted" };
      pending ??= it.next();
      const raced = await raceAbort(pending, signal);
      if (raced === ABORT) return { kind: "aborted" };
      pending = undefined;
      if (raced.done === true) {
        ended = true;
        return { kind: "end" };
      }
      return { kind: "data", text: typeof raced.value === "string" ? raced.value : decoder.decode(raced.value, { stream: true }) };
    },
  };
}

/** Reads typed keys from a raw input: a chunk with several keys gives them one by one, in order. */
export function keyReader(raw: RawIn): KeyReader {
  const queue: Result<Key, KeyError>[] = [];
  return {
    isTTY: raw.isTTY,
    async read(signal) {
      for (;;) {
        const next = queue.shift();
        if (next !== undefined) return next.kind === "ok" ? { kind: "key", key: next.value } : { kind: "unknown", error: next.error };
        const got = await raw.readRaw(signal);
        if (got.kind !== "data") return got;
        queue.push(...decodeKeys(got.text));
      }
    },
  };
}

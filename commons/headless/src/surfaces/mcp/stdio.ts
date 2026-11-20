// Spec: 0013-mcp-surface FR-006
/**
 * The standard streams as the transport of a tool server (commons headless 0013-mcp-surface FR-006): lines from standard input, lines to standard output, and nothing else on standard output.
 * `linesOf` is the pure framing (chunks of bytes into lines, a partial line kept for the next chunk), so a test drives it with no stream.
 *
 * @example
 * ```ts
 * import { framer } from "./stdio.ts";
 * const f = framer();
 * f.push("a\nb"); // ["a"]
 * f.push("c\n"); // ["bc"]
 * ```
 *
 * @module
 */
import { stdio } from "@intellectual-frontiers/system";
import type { Transport } from "./server.ts";

/** Chunks of text into lines: each `push` gives the lines it completed and keeps the rest; `end` gives what is left. A `\r` before the line break is not part of the line. */
export function framer(): { readonly push: (chunk: string) => readonly string[]; readonly end: () => readonly string[] } {
  let rest = "";
  return {
    push: (chunk) => {
      const parts = (rest + chunk).split("\n");
      rest = parts.pop() ?? "";
      return parts.map((l) => l.replace(/\r$/, ""));
    },
    end: () => {
      const left = rest.replace(/\r$/, "");
      rest = "";
      return left === "" ? [] : [left];
    },
  };
}

/** The transport of this process: standard input in lines, a line and its break written to standard output. */
export function stdioTransport(): Transport {
  return {
    lines: (async function* (): AsyncGenerator<string> {
      const decoder = new TextDecoder();
      const f = framer();
      const buffer = new Uint8Array(65_536);
      for (;;) {
        const n = await stdio.stdin.read(buffer);
        if (n === null) break;
        yield* f.push(decoder.decode(buffer.subarray(0, n), { stream: true }));
      }
      yield* f.end();
    })(),
    write: (line) => void stdio.stdout.writeSync(`${line}\n`),
  };
}

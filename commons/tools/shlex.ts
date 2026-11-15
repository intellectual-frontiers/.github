// The words of a command template, split as Python's `shlex.split` splits them (POSIX mode, no comments): the generated tables were first written with it, and a
// harness reads the same words from them.
import { err, ok, type Result } from "./core.ts";

const SPACE = " \t\r\n";

/** The words of `text`; why not, where a quotation is not closed or an escape ends the text. */
export function words(text: string): Result<string[], string> {
  const out: string[] = [];
  let word = "";
  let inWord = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i] ?? "";
    if (SPACE.includes(c)) {
      if (inWord) out.push(word);
      word = "";
      inWord = false;
      i++;
      continue;
    }
    inWord = true;
    if (c === "\\") {
      const next = text[i + 1];
      if (next === undefined) return err("No escaped character");
      word += next;
      i += 2;
      continue;
    }
    if (c === "'") {
      const end = text.indexOf("'", i + 1);
      if (end < 0) return err("No closing quotation");
      word += text.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    if (c === '"') {
      i++;
      for (;;) {
        const d = text[i];
        if (d === undefined) return err("No closing quotation");
        if (d === '"') break;
        if (d === "\\" && (text[i + 1] === '"' || text[i + 1] === "\\")) {
          word += text[i + 1] ?? "";
          i += 2;
          continue;
        }
        word += d;
        i++;
      }
      i++;
      continue;
    }
    word += c;
    i++;
  }
  if (inWord) out.push(word);
  return ok(out);
}

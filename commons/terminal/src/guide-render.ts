// Spec: 0002-guide FR-003
/**
 * A step as the lines a person reads (commons terminal 0002-guide FR-003): `renderStep(step, caps)` is pure, takes the capabilities decided by
 * `capabilitiesOf` and returns text lines that fit the columns, wrapped by display width (a wide character goes whole to the next line).
 *
 * - `plain`: ASCII furniture, no escape sequence, nothing that moves the cursor.
 * - `ansi` and `full`: the same lines with the tag painted in its role (colour only); `full` shows the palette's emoji marks where the
 *   terminal does.
 *
 * Text that comes from the caller (`summary`, `say`, hints, results) may hold anything: every control character and escape sequence in it is
 * removed before it is shown, so that a step can never move the cursor or recolour the screen.
 *
 * @example
 * ```ts
 * import { renderStep } from "./guide-render.ts";
 * renderStep({ id: "a", kind: "done", summary: "All set", say: "Nothing more." }, { level: "plain", colour: false, emoji: false, columns: 40, rows: 24 });
 * // ["[done] All set", "  Nothing more."]
 * ```
 *
 * @module
 */
import { type GuideCaps } from "./guide-caps.ts";
import type { AskField, GuideKind, GuideStep } from "./guide-model.ts";
import { mark, paint, type Role } from "./palette.ts";
import { cutToWidth, displayWidth, graphemes, splitAtWidth } from "./width.ts";

const ESC = String.fromCharCode(0x1b);
/** Escape sequences (CSI, OSC and the two-character ones), then every other control character. */
const ESCAPES = new RegExp(`${ESC}(?:\\[[0-?]*[ -/]*[@-~]|\\][^\\u0007${ESC}]*(?:\\u0007|${ESC}\\\\)?|[@-Z\\\\-_])`, "g");
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

/** A text from the caller made safe to show: escape sequences and control characters removed, tabs as spaces, line ends as `\n`. */
export function clean(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(ESCAPES, "")
    .replace(CONTROLS, "");
}

/**
 * A text wrapped to `width` columns (FR-010): paragraphs kept, and a word (a token with no space: an identifier, a path, a hash) is never
 * broken where it can go whole to the next line. A word that fits the width but not the room left by the indent goes whole on a line with
 * less indent (never cut); only a word wider than the width itself, and a wide character, are cut between graphemes. A first line
 * that cannot hold the word at all is left with its indent only, and the word starts the next line.
 */
export function wrap(text: string, width: number, indent = 0, first = indent): readonly string[] {
  const out: string[] = [];
  const total = Math.max(1, width);
  for (const paragraph of clean(text).split("\n")) {
    let line = "";
    let lead = out.length === 0 ? first : indent;
    const room = (): number => Math.max(1, total - lead);
    const flush = (): void => {
      out.push(" ".repeat(lead) + line);
      line = "";
      lead = indent;
    };
    const words = paragraph.split(" ").filter((w) => w !== "");
    if (words.length === 0) {
      out.push("");
      continue;
    }
    for (let word of words) {
      if (displayWidth(word) > room() && displayWidth(word) <= total) {
        // It fits the width, not what the indent leaves: it goes whole to its own line, indented as far as it allows.
        if (line !== "" || out.length === 0) flush();
        lead = Math.min(lead, Math.max(0, total - displayWidth(word)));
      }
      while (displayWidth(word) > room()) {
        // A word wider than the width itself: what fits after what is already there goes first, else it is cut.
        if (line !== "") {
          flush();
          continue;
        }
        const { head, tail } = splitAtWidth(word, room());
        if (head === "") {
          // A character wider than the line itself: show it alone rather than loop.
          const g = graphemes(word)[0] ?? "";
          line = g;
          word = word.slice(g.length);
        } else {
          line = head;
          word = tail;
        }
        flush();
      }
      if (word === "") continue;
      const next = line === "" ? word : `${line} ${word}`;
      if (displayWidth(next) > room()) {
        flush();
        line = word;
      } else line = next;
    }
    if (line !== "") flush();
  }
  return out.length === 0 ? [""] : out;
}

type Tag = { readonly ascii: string; readonly role: Role; readonly emoji?: "hint" | "action" | "pending" | "done" };

const TAGS: Readonly<Record<GuideKind, Tag>> = {
  question: { ascii: "[ask]", role: "hint", emoji: "hint" },
  run: { ascii: "[run]", role: "accent" },
  human: { ascii: "[you]", role: "accent", emoji: "action" },
  wait: { ascii: "[wait]", role: "dim", emoji: "pending" },
  done: { ascii: "[done]", role: "success", emoji: "done" },
};

/** The tag at the start of a step's first line: ASCII, or the palette's emoji where the level is `full` and the terminal shows them. */
export function tagOf(kind: GuideKind, caps: GuideCaps): string {
  const t = TAGS[kind];
  return caps.emoji && t.emoji !== undefined ? mark(t.emoji, caps) : t.ascii;
}

const field = (f: AskField): string => `${f.field}: ${f.prompt}${f.hint === "" ? "" : ` (${f.hint})`}`;

/** The inputs of a verb on one line: `key=value` of each, a value that is not text as JSON. */
function inputsOf(inputs: Readonly<Record<string, unknown>>): string {
  const parts = Object.entries(inputs).map(([k, v]) => `${k}=${typeof v === "string" ? v : (JSON.stringify(v) ?? String(v))}`);
  return parts.length === 0 ? "(none)" : parts.join(" ");
}

/**
 * The lines of a step at the capabilities' level (FR-003): the tag and the summary, the `say` text, then what is particular to the kind (the
 * verb and its inputs of a `run`, the fields of a `question`, exactly what the person is to do at a `human` step), then the evidence. Every
 * line fits `caps.columns`; at `plain` there is no escape sequence and the guide's own furniture is ASCII.
 */
export function renderStep(step: GuideStep, caps: GuideCaps): readonly string[] {
  const parts = renderStepParts(step, caps);
  return [...parts.head, ...parts.body];
}

/**
 * A step as lines: `head` (pinned), `body`, and `command`, the indexes into `body` of the lines that hold what the person must type or run
 * (FR-016): the `Command:` paragraph of `command`, a paragraph of `say` that begins `Command:`, and the `will run` and `inputs` lines of a `run`.
 */
export type StepParts = { readonly head: readonly string[]; readonly body: readonly string[]; readonly command: readonly number[] };

/** A step as two runs of lines: `head`, the mark and the summary (what the full screen keeps pinned), and `body`, everything after it (FR-013). */
export function renderStepParts(step: GuideStep, caps: GuideCaps): StepParts {
  const cols = Math.max(20, caps.columns);
  const tag = tagOf(step.kind, caps);
  const lead = displayWidth(tag) + 1;
  const head = wrap(step.summary, cols, lead, lead);
  const lines: string[] = [];
  const roleOf = TAGS[step.kind].role;
  const headLines = [`${paint(roleOf, tag, caps)} ${(head[0] ?? "").slice(lead)}`, ...head.slice(1)];
  const command: number[] = [];
  const mine = (from: number): void => {
    for (let i = from; i < lines.length; i++) command.push(i);
  };
  if (step.say.trim() !== "") {
    // Paragraph by paragraph: one that begins `Command:` is what the person types, so it is marked and its continuation is indented.
    for (const para of clean(step.say).split("\n")) {
      const isCommand = para.trimStart().startsWith("Command:");
      const at = lines.length;
      lines.push(...(isCommand ? wrap(para.trim(), cols, 4, 2) : wrap(para, cols, 2)));
      if (isCommand) mine(at);
    }
  }
  if (step.command !== undefined && step.command.trim() !== "") {
    const at = lines.length;
    lines.push(...wrap(`Command: ${step.command}`, cols, 4, 2));
    mine(at);
  }
  const block = (title: string, items: readonly string[]): void => {
    lines.push(`  ${title}`);
    for (const item of items) lines.push(...wrap(item, cols, 6, 6).map((l, i) => (i === 0 ? `    - ${l.slice(6)}` : l)));
  };
  switch (step.kind) {
    case "run":
      {
        const at = lines.length;
        lines.push(...wrap(`will run: ${step.verb.id}`, cols, 4, 2));
        lines.push(...wrap(`inputs: ${inputsOf(step.verb.inputs)}`, cols, 4, 2));
        mine(at);
      }
      break;
    case "question":
      block("you are asked for:", step.ask.map(field));
      break;
    case "human":
      lines.push(...wrap("This step is yours: the guide will not do it and will not confirm it for you.", cols, 2));
      if (step.ask !== undefined && step.ask.length > 0) {
        block("then type:", step.ask.map(field));
        lines.push(...wrap("Press Enter after each value.", cols, 2));
      } else lines.push(...wrap("When it is done, press Enter.", cols, 2));
      break;
    case "wait":
    case "done":
      break;
  }
  if (step.evidence !== undefined && step.evidence.length > 0) block("evidence:", step.evidence);
  const fit = (l: string): string => (displayWidth(l) > cols ? cutToWidth(l, cols) : l);
  return { head: headLines.map(fit), body: lines.map(fit), command };
}

/** The lines of a prompt for one field: its prompt and hint wrapped, and as the last line the mark of where to type, which is written without a line end. */
export function renderPrompt(f: AskField, caps: Pick<GuideCaps, "columns">): readonly string[] {
  const cols = Math.max(20, caps.columns);
  const body = wrap(`${f.prompt}${f.hint === "" ? "" : ` (${f.hint})`}`, cols, 2);
  return [...body, "  > "];
}

/** The lines that tell what came of a verb or of a refusal: a mark, the text wrapped, and the lines of the result indented. */
export function renderResult(ok: boolean, summary: string, details: readonly string[], caps: GuideCaps): readonly string[] {
  const cols = Math.max(20, caps.columns);
  const tag = ok ? (caps.emoji ? mark("done", caps) : "[ok]") : caps.emoji ? mark("failed", caps) : "[failed]";
  const lead = displayWidth(tag) + 1;
  const head = wrap(summary, cols, lead, lead);
  const lines = [`${paint(ok ? "success" : "failure", tag, caps)} ${(head[0] ?? "").slice(lead)}`, ...head.slice(1)];
  // A failure is printed once: a detail that only says the summary again is not shown.
  for (const d of details) if (clean(d).trim() !== clean(summary).trim()) lines.push(...wrap(d, cols, 4, 2));
  return lines.map((l) => (displayWidth(l) > cols ? cutToWidth(l, cols) : l));
}

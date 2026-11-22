// Spec: 0004-planning-sources FR-008
/**
 * The source for Markdown (0037-planning FR-026): each task list item of GitHub Flavored Markdown 0.29-gfm section 5.3 is an item. A task list item is a list item whose first block is a paragraph that begins
 * with a marker (optional spaces, `[`, a whitespace character or `x` or `X`, `]`) and at least one whitespace character before any other content, under any list marker the list allows (`-`, `+`, `*`, or an
 * ordered number with `.` or `)`); unchecked where the character is whitespace and checked otherwise. A task nested under another is its child, linked as parent of. Closing an item changes the one character between
 * the brackets to `x`, reopening it to a space, and no other byte; a task list in a fenced code block is not read.
 *
 * @remarks
 * The reader works on lines: a list item is a line of optional indentation, a list marker, one or more spaces or a tab and its content; a child is a list item indented at least to the content of the one above;
 * continuation lines indented to the content are the item's body. It reads no list inside a block quote and takes a lazy continuation line as part of the item above, which is the common shape of `tasks.md` and of the body
 * of an issue. The checked state of Markdown says only done, so a task checked reads as closed as completed and a close for another reason cannot be written and goes to the outbox.
 *
 * @example
 * ```ts
 * import { markdownLens } from "./markdown.ts";
 * markdownLens().name; // "markdown"
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/core";
import { sha256 } from "@intellectual-frontiers/crypto/sha256";
import type { Observation, Patch } from "@intellectual-frontiers/planning/governance";
import { type FileLens, type FileRead, folderOf } from "../file-source.ts";
import type { SourceProblem } from "../source.ts";

/** A task found in a text: where it is, what it says and how it nests. */
export type Task = {
  readonly startLine: number;
  readonly endLine: number;
  /** The index in its line of the character between the brackets. */
  readonly markIndex: number;
  readonly mark: string;
  readonly title: string;
  readonly body: string;
  readonly ownText: string;
  readonly parentLine: number | undefined;
};

const ITEM = /^(?<indent>[ \t]*)(?<marker>[-+*]|\d{1,9}[.)])(?<pad>[ \t]+)(?<rest>.*)$/u;
const TASK = /^\[(?<mark>[ \t]|[xX])\](?=[ \t])/u;
const FENCE = /^ {0,3}(?<fence>`{3,}|~{3,})/u;

const width = (s: string): number => [...s].reduce((n, c) => n + (c === "\t" ? 4 - (n % 4) : 1), 0);

/** Every list item of a text, task or not, as the reader sees them, with the task items marked. */
export function tasksOf(text: string): readonly Task[] {
  const lines = text.split("\n");
  type Open = { readonly line: number; readonly indent: number; readonly offset: number; task: boolean; end: number; body: string[]; own: string[] };
  const stack: Open[] = [];
  const done: Task[] = [];
  const tasksByLine = new Map<number, Task>();
  const meta = new Map<number, { readonly markIndex: number; readonly mark: string; readonly title: string; readonly parent: number | undefined }>();
  let fence: { readonly char: string; readonly length: number } | undefined;
  let previousBlank = true;
  const close = (open: Open): void => {
    const m = meta.get(open.line);
    if (!open.task || m === undefined) return;
    const t: Task = { startLine: open.line, endLine: open.end, markIndex: m.markIndex, mark: m.mark, title: m.title, body: open.body.join("\n").replace(/\s+$/u, ""), ownText: open.own.join("\n"), parentLine: m.parent };
    tasksByLine.set(open.line, t);
    done.push(t);
  };
  for (const [i, line] of lines.entries()) {
    const n = i + 1;
    const f = FENCE.exec(line);
    if (fence !== undefined) {
      if (f?.groups?.["fence"] !== undefined && f.groups["fence"].startsWith(fence.char) && f.groups["fence"].length >= fence.length && line.trim() === f.groups["fence"]) fence = undefined;
      const top = stack.at(-1);
      if (top !== undefined) top.end = n;
      previousBlank = false;
      continue;
    }
    if (f?.groups?.["fence"] !== undefined) {
      fence = { char: f.groups["fence"].charAt(0), length: f.groups["fence"].length };
      previousBlank = false;
      // an opening fence inside an item belongs to it; one outside any list ends the list
      const top = stack.at(-1);
      if (top !== undefined && width(line) - line.trimStart().length >= top.offset) top.end = n;
      else while (stack.length > 0) close(stack.pop() as Open);
      continue;
    }
    if (line.trim() === "") {
      previousBlank = true;
      continue;
    }
    const m = ITEM.exec(line);
    const indentWidth = width(line.slice(0, line.length - line.trimStart().length));
    if (m?.groups !== undefined && !/^(?:[-*_])(?:[ \t]*[-*_]){2,}[ \t]*$/u.test(line.trim())) {
      const g = m.groups;
      const ind = width(g["indent"] ?? "");
      while (stack.length > 0 && (stack.at(-1)?.offset ?? 0) > ind) close(stack.pop() as Open);
      const offset = ind + width(g["marker"] ?? "") + Math.min(width(g["pad"] ?? ""), 4);
      const rest = g["rest"] ?? "";
      const t = TASK.exec(rest);
      const parent = [...stack].reverse().find((o) => o.task);
      const open: Open = { line: n, indent: ind, offset, task: t !== null, end: n, body: [], own: [line] };
      if (t?.groups !== undefined) {
        const markOffset = line.length - rest.length + 1;
        meta.set(n, { markIndex: markOffset, mark: t.groups["mark"] ?? " ", title: rest.slice(t[0].length).trim(), parent: parent?.line });
      }
      for (const o of stack) o.end = n;
      stack.push(open);
      previousBlank = false;
      continue;
    }
    // a heading or other block outside the list ends it; text indented to the content is the item's body
    const top = stack.at(-1);
    if (top !== undefined && (indentWidth >= top.offset || !previousBlank) && !/^ {0,3}#{1,6}(?:\s|$)/u.test(line)) {
      for (const o of stack) o.end = n;
      if (indentWidth >= top.offset || !previousBlank) {
        top.body.push(line.trim());
        top.own.push(line);
      }
    } else while (stack.length > 0) close(stack.pop() as Open);
    previousBlank = false;
  }
  while (stack.length > 0) close(stack.pop() as Open);
  return done.sort((a, b) => a.startLine - b.startLine);
}

const normal = (title: string): string => title.toLowerCase().replace(/\s+/gu, " ").trim();

async function observationsOf(path: string, text: string): Promise<readonly Observation[]> {
  const tasks = tasksOf(text);
  const seen = new Map<string, number>();
  const keyed = await Promise.all(
    tasks.map(async (t) => {
      const title = normal(t.title);
      const k = seen.get(title) ?? 0;
      seen.set(title, k + 1);
      return { t, fingerprint: await sha256(`markdown\u0000${path}\u0000${title}\u0000${k}`) };
    }),
  );
  const byLine = new Map(keyed.map((x) => [x.t.startLine, x.fingerprint]));
  return Promise.all(
    keyed.map(async ({ t, fingerprint }): Promise<Observation> => {
      const parent = t.parentLine === undefined ? undefined : byLine.get(t.parentLine);
      return {
        source: "markdown",
        locator: { kind: "file-span", path, startLine: t.startLine, endLine: t.endLine },
        contentHash: await sha256(t.ownText),
        fingerprint,
        content: {
          kind: "task",
          title: t.title,
          body: t.body,
          labels: [],
          assignees: [],
          state: t.mark === " " || t.mark === "\t" ? { kind: "open" } : { kind: "closed", reason: "completed" },
          origin: "derived",
          external: [],
          ...(parent === undefined ? {} : { parent }),
        },
        raw: { line: t.startLine, mark: t.mark, title: t.title },
      };
    }),
  );
}

function edit(file: FileRead, patch: Patch): Result<string | undefined, SourceProblem> {
  const data = patch.event.data;
  const o = file.observations.find((x) => x.fingerprint === patch.fingerprint);
  if (o === undefined || o.locator.kind !== "file-span") return err({ kind: "refused", message: "the thing is not in this file" });
  const lines = file.text.split("\n");
  const task = tasksOf(file.text).find((t) => t.startLine === (o.locator.kind === "file-span" ? o.locator.startLine : -1));
  const line = lines[(task?.startLine ?? 1) - 1];
  if (task === undefined || line === undefined) return err({ kind: "refused", message: "the line of the thing is not found" });
  const replace = (mark: string): string => `${line.slice(0, task.markIndex)}${mark}${line.slice(task.markIndex + 1)}`;
  switch (data.type) {
    case "closed": {
      if (data.reason !== "completed") return err({ kind: "unexpressed", reason: "a checked task says done and no other reason, so a close for another reason cannot be written" });
      if (task.mark === "x" || task.mark === "X") return ok(undefined);
      lines[task.startLine - 1] = replace("x");
      return ok(lines.join("\n"));
    }
    case "reopened": {
      if (task.mark === " " || task.mark === "\t") return ok(undefined);
      lines[task.startLine - 1] = replace(" ");
      return ok(lines.join("\n"));
    }
    default:
      return err({ kind: "unexpressed", reason: `a task list item holds only whether it is checked, not a ${data.type} event` });
  }
}

/** The lens for the task lists of the Markdown files (`.md`, `.markdown`) of a place. */
export function markdownLens(): FileLens {
  return {
    name: "markdown",
    capabilities: ["read", "create", "close"],
    reads: (path) => /\.(?:md|markdown)$/iu.test(path),
    parse: async (path, text) => ({ observations: await observationsOf(path, text), findings: [] }),
    edit,
    create: (patch, files) => {
      const d = patch.event.data;
      if (d.type !== "opened") return err({ kind: "refused", message: "only an opening makes an item" });
      if (d.title.includes("\n") || d.title.trim() === "") return err({ kind: "refused", message: "a task list item is one line of text" });
      const folder = folderOf(patch.place);
      const path = `${folder === "" ? "" : `${folder}/`}tasks.md`;
      const have = files.find((f) => f.path === path);
      const line = `- [ ] ${d.title}`;
      const text = have === undefined ? `${line}\n` : `${have.text}${have.text.endsWith("\n") || have.text === "" ? "" : "\n"}${line}\n`;
      return ok({ path, text });
    },
  };
}

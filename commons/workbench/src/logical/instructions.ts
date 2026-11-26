// Spec: 0007-workbench-operate FR-014
/**
 * The check of the instructions a person reads: a README or a generated page must never ask a person to type what the program can find out. A product gives the rules (an option, or a pattern, and why it is inferable); this finds every
 * command of a fenced code block or an inline code span of the text that breaks one. Pure.
 *
 * @example
 * ```ts
 * import { typedInferables } from "./instructions.ts";
 * typedInferables("```bash\ndemo serve --address 10.0.0.1\n```", [{ name: "address", option: "address", why: "the controller picks its address" }]).length; // 1
 * ```
 *
 * @module
 */

/** A thing a person never types: by the option that names it, or by a pattern of the command. */
export type Inferable = { readonly name: string; readonly option?: string; readonly pattern?: RegExp; readonly why: string };

/** A command that asks a person to type an inferable thing. */
export type InstructionProblem = { readonly line: number; readonly command: string; readonly name: string; readonly why: string };

const SHELL = new Set(["", "bash", "sh", "shell", "console", "powershell", "pwsh", "ps1", "zsh"]);
const optionTest = (option: string): RegExp => new RegExp(`(^|\\s)--${option.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(\\s|=|$)`, "u");

/** The commands of a text, with the line each is on: every line of a fenced shell block, and every inline code span. */
export function commandsOf(markdown: string): readonly { readonly line: number; readonly command: string }[] {
  const out: { line: number; command: string }[] = [];
  let fence: string | undefined;
  for (const [i, raw] of markdown.split("\n").entries()) {
    const f = /^\s*```(\S*)/u.exec(raw);
    if (f !== null) {
      fence = fence === undefined ? (f[1] ?? "").toLowerCase() : undefined;
      continue;
    }
    if (fence !== undefined) {
      const t = raw.trim();
      if (SHELL.has(fence) && t !== "" && !t.startsWith("#")) out.push({ line: i + 1, command: t });
      continue;
    }
    for (const m of raw.matchAll(/`([^`]+)`/gu)) out.push({ line: i + 1, command: (m[1] ?? "").trim() });
  }
  return out;
}

/** Every command of the text that asks a person to type something the rules say is inferable. */
export function typedInferables(markdown: string, rules: readonly Inferable[]): readonly InstructionProblem[] {
  const problems: InstructionProblem[] = [];
  for (const c of commandsOf(markdown)) {
    for (const r of rules) {
      const hit = (r.option !== undefined && optionTest(r.option).test(c.command)) || (r.pattern !== undefined && r.pattern.test(c.command));
      if (hit) problems.push({ line: c.line, command: c.command, name: r.name, why: r.why });
    }
  }
  return problems;
}

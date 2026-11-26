// Spec: 0001-core FR-009
/**
 * A step of a command as data, shared by every library that says what to run: the words of the command, who runs it and which exit codes are a success. It is words only, never a shell string, so
 * that no text is ever parsed by a shell on the way to a program. A pure type with a decoder and the findings that refuse what is not safe to run.
 *
 * @example
 * ```ts
 * import { argvFindings } from "./argv.ts";
 * argvFindings({ argv: ["apt-get", "install", "-y", "git"], as: "root", expect: [0] }); // []
 * argvFindings({ argv: ["sh", "-c", "apt-get install git"], as: "root", expect: [0] }); // one finding: a shell given a command string
 * ```
 *
 * @module
 */
import { array, integer, literal, mapDecoder, object, string, type Decoder } from "./decode.ts";

/** What a step leaves as evidence: nothing but its exit code, the digest of what it printed, or the digest of a file it wrote. */
export type ArgvEvidence = { readonly kind: "exit" } | { readonly kind: "stdout-sha256" } | { readonly kind: "file-sha256"; readonly path: string };

/** A command as words, the identity it runs as (`user`, or `root` where it needs the administrator) and the exit codes that mean success. */
export type ArgvStep = {
  readonly argv: readonly string[];
  readonly as: "user" | "root";
  readonly expect: readonly number[];
  readonly evidence?: ArgvEvidence;
};

const evidence: Decoder<ArgvEvidence> = (input, path = "$") => {
  const kind = object({ kind: literal("exit", "stdout-sha256", "file-sha256") })(input, path);
  if (kind.kind === "err") return kind;
  if (kind.value.kind === "file-sha256") return mapDecoder(object({ kind: literal("file-sha256"), path: string }), (v): ArgvEvidence => ({ kind: "file-sha256", path: v.path }))(input, path);
  return mapDecoder(object({ kind: literal("exit", "stdout-sha256") }), (v): ArgvEvidence => ({ kind: v.kind }))(input, path);
};

/** The decoder of a step: the shape only; `argvFindings` judges what the shape holds. */
export const argvStep: Decoder<ArgvStep> = mapDecoder(
  object({ argv: array(string), as: literal("user", "root"), expect: array(integer) }, { evidence }),
  (v): ArgvStep => (v.evidence === undefined ? { argv: v.argv, as: v.as, expect: v.expect } : { argv: v.argv, as: v.as, expect: v.expect, evidence: v.evidence }),
);

const SHELLS: ReadonlyMap<string, readonly string[]> = new Map([
  ["sh", ["-c"]],
  ["bash", ["-c"]],
  ["zsh", ["-c"]],
  ["dash", ["-c"]],
  ["ksh", ["-c"]],
  ["cmd", ["/c", "/k"]],
  ["powershell", ["-command", "-c"]],
  ["pwsh", ["-command", "-c"]],
]);

const base = (program: string): string => (program.split(/[\\/]/u).at(-1) ?? "").toLowerCase().replace(/\.exe$/u, "");

/** Why a step is not safe to run, each reason as a sentence; none where it is. */
export function argvFindings(step: ArgvStep): readonly string[] {
  const out: string[] = [];
  const program = step.argv[0];
  if (program === undefined) return ["the argument vector is empty"];
  if (program === "") out.push("the program is empty");
  if (step.argv.some((w) => w.includes("\0"))) out.push("a word has a NUL");
  const flags = SHELLS.get(base(program));
  if (flags !== undefined && step.argv.slice(1).some((w) => flags.includes(w.toLowerCase()))) out.push(`${base(program)} is given a command string: say the words of the command, not a shell string`);
  if (step.expect.length === 0) out.push("no exit code is expected");
  if (step.expect.some((c) => !Number.isInteger(c) || c < 0 || c > 255)) out.push("an expected exit code is not an integer from 0 to 255");
  return out;
}

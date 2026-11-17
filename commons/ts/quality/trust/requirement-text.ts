/**
 * The text of a requirement as the specifications state it at a revision (commons 0022-trust FR-018): the Assessor and Internal pages show it beside
 * a nonconformance, and the Public page never does. `requirementTextOf` is the pure lookup, made from the text of the specifications it is given;
 * `readRequirementTexts` reads them from Git at the tested revision, so the page says what the requirement said when it was tested, not what it
 * says now.
 *
 * @remarks
 * A requirement is named `NNNN-slug FR-nnn`: the folder of its specification and its number. A requirement is a bullet `- **FR-nnn**: text`, and
 * the lines that continue it (indented) belong to it. Its text is returned as one line.
 *
 * @example
 * ```ts
 * import { requirementTextOf } from "./requirement-text.ts";
 * const text = requirementTextOf(new Map([["0099-demo", "- **FR-001**: The first requirement.\n"]]));
 * text("0099-demo FR-001"); // "The first requirement."
 * ```
 *
 * @module
 */
import { err, ok, type Result } from "../../kernel/result.ts";
import { gitText } from "../host/git.ts";

/** A lookup of the text of a requirement by its name (`NNNN-slug FR-nnn`), or none where the specifications do not state it. */
export type RequirementText = (requirement: string) => string | undefined;

/** The requirements of one specification's text: each number (`FR-nnn`) with its text on one line. */
export function requirementsOf(spec: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  let current: { id: string; text: string[] } | undefined;
  const close = (): void => {
    if (current !== undefined) out.set(current.id, current.text.join(" ").replace(/\s+/g, " ").trim());
    current = undefined;
  };
  for (const line of spec.replaceAll("\r\n", "\n").split("\n")) {
    const m = /^- \*\*(FR-\d{3,})\*\*: ?(.*)$/.exec(line);
    if (m !== null) {
      close();
      current = { id: m[1] ?? "", text: [m[2] ?? ""] };
    } else if (current !== undefined && /^\s+\S/.test(line)) current.text.push(line.trim());
    else close();
  }
  close();
  return out;
}

/** The lookup made from the text of specifications, by the name of the folder of each (`0021-ifqs`). */
export function requirementTextOf(specs: ReadonlyMap<string, string>): RequirementText {
  const parsed = new Map<string, ReadonlyMap<string, string>>();
  for (const [slug, text] of specs) parsed.set(slug, requirementsOf(text));
  return (requirement) => {
    const m = /^(\S+) (FR-\d{3,})$/.exec(requirement.trim());
    if (m === null) return undefined;
    return parsed.get(m[1] ?? "")?.get(m[2] ?? "");
  };
}

/** The lookup that knows no requirement: the page of a harness that gives no specifications shows none. */
export const NO_REQUIREMENT_TEXT: RequirementText = () => undefined;

/** Where a specification is in a revision: any `specs/<folder>/spec.md`. */
const SPEC_PATH = /(?:^|\/)specs\/([^/]+)\/spec\.md$/;

/** The text of the specifications of a revision of the repository, read with `git`, as a lookup (the revision is the tested one). */
export async function readRequirementTexts(repo: string, revision: string): Promise<Result<RequirementText, string>> {
  const listed = await gitText(repo, ["ls-tree", "-r", "--name-only", revision]);
  if (listed.kind === "err") return err(`the specifications at ${revision} could not be listed`);
  const specs = new Map<string, string>();
  for (const path of listed.value.split("\n")) {
    const slug = SPEC_PATH.exec(path)?.[1];
    if (slug === undefined) continue;
    const body = await gitText(repo, ["show", `${revision}:${path}`]);
    if (body.kind === "ok") specs.set(slug, body.value);
  }
  return ok(requirementTextOf(specs));
}

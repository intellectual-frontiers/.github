// Spec: 0018-sql-history FR-001
/**
 * The file of a step (commons data 0018-sql-history FR-001): SQL a person can read, with a header and markers that a program reads back. The same step gives the same text every time and the text
 * gives the step back.
 *
 * @module
 */
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import type { Verification, Step, StepStatement } from "@intellectual-frontiers/data/sql/lifecycle";
import { canonical } from "@intellectual-frontiers/data/sql/lifecycle";

/** A step as a file holds it: what a run needs, and what a person needs to read. */
export interface FrozenStep {
  readonly id: string;
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly key: string;
  readonly kind: string;
  readonly class: string;
  readonly why?: string;
  readonly reversibility: string;
  readonly idempotency?: string;
  readonly manual: boolean;
  readonly of: readonly string[];
  readonly up: readonly StepStatement[];
  readonly down?: readonly StepStatement[];
  readonly verify?: Verification;
}

/** The step of a plan as it is frozen. */
export const frozenOf = (s: Step): FrozenStep => ({
  id: s.id,
  name: s.name,
  from: s.from,
  to: s.to,
  key: s.key,
  kind: s.kind,
  class: s.class,
  ...(s.why === undefined ? {} : { why: s.why }),
  reversibility: s.reversibility,
  ...(s.idempotency === undefined ? {} : { idempotency: s.idempotency }),
  manual: s.manual,
  of: s.of,
  up: s.up,
  ...(s.down === undefined ? {} : { down: s.down }),
  ...(s.verify === undefined ? {} : { verify: s.verify }),
});

const one = (t: string): string => t.replace(/\s*\r?\n\s*/g, " ").trim();

/** A name as a file name: lower case words and hyphens. */
export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** The path of a step's file in a folder. */
export const pathOf = (folder: string, number: number, name: string): string =>
  `${folder}/${String(number).padStart(4, "0")}_${slug(name)}.sql`;

const statementLine = (s: StepStatement): string =>
  `-- @statement ${canonical({ group: s.group, origin: s.origin, of: s.of, guard: s.guard, natural: s.natural })}\n${s.sql}`;

/**
 * A step as the text of its file.
 *
 * @param s - the step
 * @param number - its place in the history, from 1
 * @returns the text
 */
export function renderStep(s: FrozenStep, number: number): string {
  const header = canonical({
    format: 1,
    number,
    id: s.id,
    name: s.name,
    from: s.from,
    to: s.to,
    key: s.key,
    kind: s.kind,
    class: s.class,
    why: s.why,
    reversibility: s.reversibility,
    idempotency: s.idempotency,
    manual: s.manual,
    of: s.of,
  });
  const out = [`-- step ${number}: ${one(s.name)}`, `-- @header ${header}`];
  if (s.verify !== undefined) out.push(`-- @verify ${canonical(s.verify)}`);
  out.push("-- @section up", ...s.up.map(statementLine));
  if (s.down !== undefined) out.push("-- @section down", ...s.down.map(statementLine));
  return `${out.join("\n")}\n`;
}

/**
 * The step a file holds.
 *
 * @param text - the text of the file
 * @returns the step and its number, or what is wrong with the file
 */
export function parseStep(text: string): Result<{ readonly number: number; readonly step: FrozenStep }, readonly string[]> {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  let header: Record<string, unknown> | undefined;
  let verify: Verification | undefined;
  let section: "up" | "down" | undefined;
  const up: StepStatement[] = [];
  const down: StepStatement[] = [];
  let hasDown = false;
  let meta: Record<string, unknown> | undefined;
  let body: string[] = [];
  const errors: string[] = [];
  const flush = (): void => {
    if (meta === undefined) return;
    const g = meta["guard"] as StepStatement["guard"] | undefined;
    const s: StepStatement = {
      group: meta["group"] as StepStatement["group"],
      origin: meta["origin"] as NonNullable<StepStatement["origin"]>,
      of: (meta["of"] ?? []) as StepStatement["of"],
      sql: body.join("\n"),
      ...(g === undefined ? {} : { guard: g }),
      ...(meta["natural"] === true ? { natural: true } : {}),
    };
    (section === "down" ? down : up).push(s);
    meta = undefined;
    body = [];
  };
  const json = (raw: string, what: string): Record<string, unknown> | undefined => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      errors.push(`${what} is not JSON`);
      return undefined;
    }
  };
  for (const line of lines) {
    if (line.startsWith("-- @header ")) header = json(line.slice(11), "the header");
    else if (line.startsWith("-- @verify ")) verify = json(line.slice(11), "the verification") as unknown as Verification | undefined;
    else if (line.startsWith("-- @section ")) {
      flush();
      section = line.slice(12).trim() === "down" ? "down" : "up";
      if (section === "down") hasDown = true;
    } else if (line.startsWith("-- @statement ")) {
      flush();
      meta = json(line.slice(14), "a statement's marker");
    } else if (meta !== undefined) body.push(line);
  }
  flush();
  if (header === undefined) errors.push("there is no header");
  if (errors.length > 0 || header === undefined) return err(errors);
  const h = header;
  return ok({
    number: Number(h["number"]),
    step: {
      id: String(h["id"]),
      name: String(h["name"]),
      from: String(h["from"]),
      to: String(h["to"]),
      key: String(h["key"]),
      kind: String(h["kind"]),
      class: String(h["class"]),
      ...(h["why"] === undefined ? {} : { why: String(h["why"]) }),
      reversibility: String(h["reversibility"]),
      ...(h["idempotency"] === undefined ? {} : { idempotency: String(h["idempotency"]) }),
      manual: h["manual"] === true,
      of: (h["of"] ?? []) as readonly string[],
      up,
      ...(hasDown ? { down } : {}),
      ...(verify === undefined ? {} : { verify }),
    },
  });
}

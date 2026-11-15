/**
 * Path patterns: literal text and segments written with the tagged template `path`, which read a path into a typed key and write a key
 * back as a path, each the inverse of the other (commons 0010-file-aide FR-007, FR-008).
 *
 * @module
 */
import { absurd, err, ok, type Result } from "../../../kernel/mod.ts";
import { type PathError, type RelPath, relPath } from "./names.ts";
import { type AnySegment, escapeRegExp, type ValueOf } from "./segment.ts";

/**
 * The key a pattern reads from a path: one field for each segment that is not computed from another, of that segment's type. It is
 * computed by mapping over the union of the pattern's segments, never by parsing a template literal type (FR-008).
 */
export type KeyOf<S extends readonly AnySegment[]> = {
  readonly [X in S[number] as X extends { readonly derived: false } ? X["name"] : never]: ValueOf<X>;
};

/** One part of one name of a pattern: literal text or a segment. */
export type Part = { readonly kind: "text"; readonly text: string } | { readonly kind: "segment"; readonly segment: AnySegment };

/** Why a path or a key does not fit a pattern. */
export type MatchError =
  | PathError
  | { readonly kind: "mismatch"; readonly path: string; readonly pattern: string; readonly why: string }
  | { readonly kind: "bad-key"; readonly pattern: string; readonly field: string; readonly why: string };

/** A pattern of paths, with the type of the key it reads and writes. */
export interface Pattern<K> {
  /** The pattern as written, with each segment as `${name}`. */
  readonly text: string;
  /** Its names in order, each a list of parts. */
  readonly names: readonly (readonly Part[])[];
  /** Its segments, in order. */
  readonly segments: readonly AnySegment[];
  /** What is wrong with the pattern itself; a layout refuses a pattern with any (FR-007). */
  readonly problems: readonly string[];
  /** Reads a path, which must already be normalized, into its key. */
  parse(path: string): Result<K, MatchError>;
  /** Writes a key as a path. */
  format(key: K): Result<RelPath, MatchError>;
  /** Paths formatted from the witnesses of its segments, by which a layout finds two entries that match the same path (FR-010). */
  witnesses(): readonly string[];
}

/** The key type of a pattern. */
export type KeyOfPattern<P> = P extends Pattern<infer K> ? K : never;

const field = (key: object, name: string): unknown => Object.getOwnPropertyDescriptor(key, name)?.value;

function groupsOf(source: string): number | undefined {
  try {
    return (new RegExp(`(?:${source})|`, "u").exec("")?.length ?? 1) - 1;
  } catch {
    return undefined;
  }
}

function shape(strings: readonly string[], segments: readonly AnySegment[]): { names: Part[][]; problems: string[] } {
  const names: Part[][] = [[]];
  const problems: string[] = [];
  const current = (): Part[] => names[names.length - 1] ?? [];
  strings.forEach((text, i) => {
    text.split("/").forEach((piece, j) => {
      if (j > 0) names.push([]);
      if (piece !== "") current().push({ kind: "text", text: piece });
    });
    const segment = segments[i];
    if (segment !== undefined) current().push({ kind: "segment", segment });
  });
  if (strings[0]?.startsWith("/") === true) problems.push("it begins with /");
  names.forEach((parts, i) => {
    if (parts.length === 0) problems.push(`its name ${i + 1} is empty`);
    const only = parts.length === 1 ? parts[0] : undefined;
    if (only?.kind === "text" && (only.text === "." || only.text === "..")) problems.push(`its name ${i + 1} is ${only.text}`);
    parts.forEach((part, j) => {
      const before = parts[j - 1];
      if (part.kind === "segment" && before?.kind === "segment" && part.segment.variable && before.segment.variable)
        problems.push(`${before.segment.name} and ${part.segment.name} are side by side and both vary in length`);
      if (part.kind === "segment" && part.segment.role.kind === "rest" && (i !== names.length - 1 || parts.length !== 1))
        problems.push(`${part.segment.name} is the rest of a path and must be the whole of the last name`);
    });
  });
  const seen = new Set<string>();
  for (const s of segments) {
    if (seen.has(s.name)) problems.push(`${s.name} is named twice`);
    seen.add(s.name);
    if (groupsOf(s.source) !== 0) problems.push(`${s.name}'s regular expression is not valid or has a capturing group`);
    if (s.role.kind === "fanout") {
      const of = s.role.of;
      if (!segments.some((o) => o.name === of && !o.derived))
        problems.push(`${s.name} is a fan-out of ${of}, which the pattern does not have`);
    }
  }
  return { names, problems };
}

/**
 * Makes a pattern of paths from literal text and segments: `` path`${kind}/${work}/issues.d/${id}.json5` ``. A segment may share a name with
 * text and other segments, but two segments side by side must not both vary in length; the rest of a path must be the whole of the last name.
 * What is wrong is kept in `problems`, which a layout refuses.
 *
 * @param strings - the literal text
 * @param segments - the segments, in order
 */
export function path<const S extends readonly AnySegment[]>(strings: TemplateStringsArray, ...segments: S): Pattern<KeyOf<S>> {
  return makePattern<KeyOf<S>>([...strings], segments);
}

/** The pattern of a key type `K` from literal text and segments; `path` is how a caller makes one. */
function makePattern<K>(strings: readonly string[], segments: readonly AnySegment[]): Pattern<K> {
  const { names, problems } = shape(strings, segments);
  const text = strings.map((s, i) => s + (segments[i] === undefined ? "" : `\${${segments[i]?.name ?? ""}}`)).join("");
  const last = names[names.length - 1];
  const tail = last?.length === 1 && last[0]?.kind === "segment" && last[0].segment.role.kind === "rest" ? last[0].segment : undefined;
  const fixed = tail === undefined ? names : names.slice(0, -1);
  const matchers = fixed.map(
    (parts) => new RegExp(`^${parts.map((p) => (p.kind === "text" ? escapeRegExp(p.text) : `(${p.segment.source})`)).join("")}$`, "u"),
  );
  const mismatch = (p: string, why: string): MatchError => ({ kind: "mismatch", path: p, pattern: text, why });

  const parse = (p: string): Result<K, MatchError> => {
    if (problems.length > 0) return err(mismatch(p, `the pattern is not valid: ${problems.join("; ")}`));
    const checked = relPath(p);
    if (checked.kind === "err") return checked;
    if (checked.value !== p) return err(mismatch(p, "it is not in Unicode's normalization form C"));
    const given = p.split("/");
    if (tail === undefined ? given.length !== fixed.length : given.length <= fixed.length)
      return err(
        mismatch(
          p,
          `it has ${given.length} name${given.length === 1 ? "" : "s"}, and the pattern ${tail === undefined ? fixed.length : `more than ${fixed.length}`}`,
        ),
      );
    const values = new Map<string, unknown>();
    const texts = new Map<string, string>();
    for (const [i, parts] of fixed.entries()) {
      const name = given[i] ?? "";
      const m = matchers[i]?.exec(name);
      if (m === null || m === undefined) return err(mismatch(p, `its name ${JSON.stringify(name)} does not fit`));
      let g = 1;
      for (const part of parts) {
        if (part.kind === "text") continue;
        const t = m[g++] ?? "";
        const r = read(part.segment, t);
        if (r.kind === "err") return err(mismatch(p, r.error));
        values.set(part.segment.name, r.value);
        texts.set(part.segment.name, t);
      }
    }
    if (tail !== undefined) {
      const t = given.slice(fixed.length).join("/");
      const r = read(tail, t);
      if (r.kind === "err") return err(mismatch(p, r.error));
      values.set(tail.name, r.value);
    }
    for (const s of segments) {
      const role = s.role;
      switch (role.kind) {
        case "plain":
        case "rest":
          break;
        case "fanout": {
          const want = (texts.get(role.of) ?? "").slice(0, role.chars);
          if (texts.get(s.name) !== want) return err(mismatch(p, `${s.name} is not the first ${role.chars} characters of ${role.of}`));
          values.delete(s.name);
          break;
        }
        default:
          absurd(role);
      }
    }
    // the decoder's one cast: every field of K was read above by the segment that types it
    return ok(Object.freeze(Object.fromEntries(values)) as K);
  };

  const format = (key: K): Result<RelPath, MatchError> => {
    const bad = (f: string, why: string): MatchError => ({ kind: "bad-key", pattern: text, field: f, why });
    if (problems.length > 0) return err(bad("", `the pattern is not valid: ${problems.join("; ")}`));
    if (typeof key !== "object" || key === null) return err(bad("", "the key is not an object"));
    const texts = new Map<string, string>();
    for (const s of segments) {
      if (s.derived) continue;
      const r = write(s, field(key, s.name));
      if (r.kind === "err") return err(bad(s.name, r.error));
      texts.set(s.name, r.value);
    }
    const textOf = (s: AnySegment): string => {
      const role = s.role;
      switch (role.kind) {
        case "plain":
        case "rest":
          return texts.get(s.name) ?? "";
        case "fanout":
          return (texts.get(role.of) ?? "").slice(0, role.chars);
        default:
          return absurd(role);
      }
    };
    const out = names.map((parts) => parts.map((part) => (part.kind === "text" ? part.text : textOf(part.segment))).join("")).join("/");
    const r = relPath(out);
    if (r.kind === "err") return err(bad("", r.error.why));
    const back = parse(r.value);
    if (back.kind === "err") return err(bad("", back.error.kind === "mismatch" ? back.error.why : "it does not read back"));
    return r;
  };

  const witnesses = (): readonly string[] => {
    const plain = segments.filter((s) => !s.derived);
    const n = Math.max(1, ...plain.map((s) => s.witnesses.length));
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const key = Object.fromEntries(plain.map((s) => [s.name, s.witnesses[i % Math.max(1, s.witnesses.length)]]));
      // a key made of each segment's own witnesses, which `format` checks again field by field
      const r = format(key as K);
      if (r.kind === "ok") out.push(r.value);
    }
    return out;
  };

  return { text, names, segments, problems, parse, format, witnesses };
}

function read(s: AnySegment, t: string): Result<unknown, string> {
  const r = s.parse(t);
  if (r.kind === "err") return r;
  if (s.derived) return r;
  const back = s.format(r.value);
  if (back.kind === "err") return back;
  return back.value === t ? r : err(`${JSON.stringify(t)} is not written as ${s.name} writes it (${JSON.stringify(back.value)})`);
}

function write(s: AnySegment, value: unknown): Result<string, string> {
  if (value === undefined) return err(`the key has no ${s.name}`);
  const r = s.format(value);
  if (r.kind === "err") return r;
  if (s.role.kind !== "rest" && r.value.includes("/")) return err(`${s.name}'s text holds /`);
  return new RegExp(`^(?:${s.source})$`, "u").test(r.value) ? r : err(`${JSON.stringify(r.value)} is not what ${s.name} matches`);
}

/**
 * The same pattern below a literal prefix of names, as a layout mounted under another holds it (FR-010).
 *
 * @param prefix - the names before it, joined by `/`
 * @param pattern - the pattern
 */
export function under<K>(prefix: string, pattern: Pattern<K>): Pattern<K> {
  const strings: string[] = [];
  const segs: AnySegment[] = [];
  let text = `${prefix}/`;
  pattern.names.forEach((parts, i) => {
    if (i > 0) text += "/";
    for (const part of parts) {
      if (part.kind === "text") text += part.text;
      else {
        strings.push(text);
        segs.push(part.segment);
        text = "";
      }
    }
  });
  strings.push(text);
  return makePattern<K>(strings, segs);
}

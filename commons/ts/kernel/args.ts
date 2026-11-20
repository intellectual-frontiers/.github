/**
 * A typed command-line parser (commons 0005-typescript-runtime FR-047): a command's options are declared once as data (`flag`, `value`,
 * `many`), the type of what `parseArgs` gives is inferred from that declaration, and a command line that does not fit is a `UsageError`,
 * a union told apart by `kind` that `formatUsageError` says in one sentence; `helpText` writes the help from the same declaration. It
 * unifies the parsers of two harnesses: erga's `@erga/agent` `args.ts` (declared options, an undeclared option refused with a "did you mean", help that
 * wins over everything and runs nothing: erga 247-ergactl FR-006 and FR-007) and Stolos's `parseArgs` (short letters, required options, defaults, repeatable options). It is pure: the
 * caller passes the words, `proc.args` from `runtime/proc.ts`.
 *
 * The grammar: `--name VALUE` and `--name=VALUE`; `-x VALUE`; bundled short flags `-abc`, whose last letter may take the next word as its
 * value; `--no-name` for a flag declared `negatable`; `--` ends the options, and the words after it are kept apart as `rest`; `-` and a
 * word such as `-5` are arguments, since no option is a digit. A short option's value is never attached (`-ofile`, `-o=file`), which other
 * parsers read differently. A value-taking option takes the next word whatever it is, as getopt does. Every option is given at most once
 * (a `many` option as often as wanted): a second value would otherwise silently replace the first. `--help`, or a short word with the
 * letter `h`, anywhere before `--` asks for help, which wins over every other word and every error, so `-h` and the name `help` are
 * reserved.
 *
 * @example
 * ```ts
 * import { flag, integerText, many, parseArgs, value } from "./args.ts";
 * const spec = {
 *   verbose: flag({ short: "v", help: "Say more." }),
 *   out: value({ short: "o", help: "Where to write.", valueName: "FILE" }),
 *   tag: many({ help: "A tag." }),
 *   jobs: value({ help: "How many at once.", parse: integerText, default: 4 }),
 * };
 * parseArgs(["-v", "--tag", "a", "--tag=b", "--jobs", "8", "--", "x"], spec);
 * // { kind: "ok", value: { kind: "args", options: { verbose: true, out: undefined, tag: ["a", "b"], jobs: 8 }, positionals: [], rest: ["x"] } }
 * ```
 *
 * @module
 */
import { absurd, err, ok, type Result } from "@intellectual-frontiers/core";
import type { DecodeError } from "@intellectual-frontiers/core";

/** A short option's letter: any ASCII letter but `h`, which is help's. */
export type ShortName =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

/** What turns an option's text into its value: a function of the text, or any of the kernel's decoders (`./decode.ts`), which take it as `unknown`. */
export type Parser<T> = (text: string) => Result<T, string | DecodeError>;

/** What an option is when the command line does not give it: nothing (`undefined`), a usage error, or a default. */
export type Presence = "none" | "required" | "default";

/** The fallback of an option of presence `P`: the default's value is kept with it. */
export type Fallback<T, P extends Presence> = P extends "none"
  ? { readonly kind: "none" }
  : P extends "required"
    ? { readonly kind: "required" }
    : { readonly kind: "default"; readonly value: T };

/** A switch that takes no value: `true` when given, `false` with `--no-name` where it is negatable, else its fallback. */
export type FlagOption<P extends "none" | "default" = "none" | "default", L extends ShortName = ShortName> = {
  readonly kind: "flag";
  readonly short: L | undefined;
  readonly help: string;
  readonly negatable: boolean;
  readonly fallback: Fallback<boolean, P>;
};

/** An option given at most once with one value, parsed into a `T`. */
export type ValueOption<T, P extends Presence = Presence, L extends ShortName = ShortName> = {
  readonly kind: "value";
  readonly short: L | undefined;
  readonly help: string;
  readonly valueName: string;
  readonly parse: Parser<T>;
  readonly fallback: Fallback<T, P>;
};

/** An option given any number of times, each value parsed into a `T`, kept in the order given. */
export type ManyOption<T, L extends ShortName = ShortName> = {
  readonly kind: "many";
  readonly short: L | undefined;
  readonly help: string;
  readonly valueName: string;
  readonly parse: Parser<T>;
};

/** One declared option. */
export type Option = FlagOption | ValueOption<unknown> | ManyOption<unknown>;

/** A command's options, by name: the key `dryRun` is the option `--dry-run`. */
export type Spec = { readonly [name: string]: Option };

/** The value an option gives, as its declaration says. */
export type OptionValue<O> = O extends { readonly kind: "flag"; readonly fallback: infer F }
  ? [F] extends [{ readonly kind: "none" }]
    ? boolean | undefined
    : boolean
  : O extends { readonly kind: "many"; readonly parse: Parser<infer T> }
    ? readonly T[]
    : O extends { readonly kind: "value"; readonly parse: Parser<infer T>; readonly fallback: infer F }
      ? [F] extends [{ readonly kind: "none" }]
        ? T | undefined
        : T
      : never;

/** The values of a spec's options, by the same names. */
export type OptionValues<S extends Spec> = { readonly [K in keyof S]: OptionValue<S[K]> };

/** The short letter an option declares, if any. */
type ShortOf<O> = O extends { readonly short: infer L } ? Exclude<L, undefined> : never;

/** The short letters that two options of a spec declare. */
type RepeatedShorts<S> = { [K in keyof S]: ShortOf<S[K]> & ShortOf<S[Exclude<keyof S, K>]> }[keyof S];

/**
 * `unknown` where a spec is well formed, else a type naming what is wrong, which the spec then does not satisfy: a short letter declared
 * twice, a name written with a dash (names are camelCase keys), or the name `help`, which is reserved.
 */
export type SpecCheck<S> = [RepeatedShorts<S>] extends [never]
  ? [Extract<keyof S, `${string}-${string}`>] extends [never]
    ? ["help"] extends [keyof S]
      ? { readonly "help is reserved": never }
      : unknown
    : { readonly "option names are camelCase keys": Extract<keyof S, `${string}-${string}`> }
  : { readonly "a short letter is declared twice": RepeatedShorts<S> };

/** A word, or words, that a command takes after its options: exactly one, at most one, or any number. */
export type Operand = { readonly name: string; readonly help: string; readonly arity: "one" | "optional" | "many" };

/** A command line that fits its spec: the options' values, the arguments, and the words after `--`. */
export type Args<S extends Spec> = {
  readonly kind: "args";
  readonly options: OptionValues<S>;
  readonly positionals: readonly string[];
  readonly rest: readonly string[];
};

/** What a command line asks: help, which runs nothing else (erga 247-ergactl FR-006), or the command with its arguments. */
export type Parsed<S extends Spec> = { readonly kind: "help" } | Args<S>;

/** Why a command line does not fit its spec. `option` is the option as it was written, or its long name where it was given twice or not at all. */
export type UsageError =
  | { readonly kind: "unknown-option"; readonly option: string; readonly suggestion: string | undefined }
  | { readonly kind: "missing-value"; readonly option: string }
  | { readonly kind: "unexpected-value"; readonly option: string; readonly value: string }
  | { readonly kind: "attached-value"; readonly option: string; readonly word: string }
  | { readonly kind: "invalid-value"; readonly option: string; readonly value: string; readonly reason: string }
  | { readonly kind: "repeated-option"; readonly option: string }
  | { readonly kind: "missing-option"; readonly option: string }
  | { readonly kind: "missing-argument"; readonly argument: string }
  | { readonly kind: "unexpected-argument"; readonly argument: string; readonly takes: readonly string[] };

/** The fields every option declares. */
type Common<L extends ShortName> = { readonly short?: L; readonly help: string };

/** The fields an option with a value declares: the name of its value in the help, `VALUE` by default. */
type Valued<L extends ShortName> = Common<L> & { readonly valueName?: string };

/** A flag: `false` when not given; with `negatable`, `--no-name` gives `false` and an absent flag gives `undefined`, or the `default`. */
export function flag<L extends ShortName = never>(
  o: Common<L> & { readonly negatable: true; readonly default: boolean },
): FlagOption<"default", L>;
/** A negatable flag with no default. */
export function flag<L extends ShortName = never>(o: Common<L> & { readonly negatable: true }): FlagOption<"none", L>;
/** A flag that cannot be negated. */
export function flag<L extends ShortName = never>(o: Common<L>): FlagOption<"default", L>;
/** The implementation of `flag`. */
export function flag(o: Common<ShortName> & { readonly negatable?: true; readonly default?: boolean }): FlagOption {
  const negatable = o.negatable === true;
  return {
    kind: "flag",
    short: o.short,
    help: o.help,
    negatable,
    fallback: negatable && o.default === undefined ? { kind: "none" } : { kind: "default", value: o.default ?? false },
  };
}

/** An option with one value, parsed by `parse`, that must be given. */
export function value<T, L extends ShortName = never>(
  o: Valued<L> & { readonly parse: Parser<T>; readonly required: true },
): ValueOption<T, "required", L>;
/** An option with one value, parsed by `parse`, and a default. */
export function value<T, L extends ShortName = never>(
  o: Valued<L> & { readonly parse: Parser<T>; readonly default: NoInfer<T> },
): ValueOption<T, "default", L>;
/** An option with one value, parsed by `parse`, `undefined` when not given. */
export function value<T, L extends ShortName = never>(o: Valued<L> & { readonly parse: Parser<T> }): ValueOption<T, "none", L>;
/** An option with one text value that must be given. */
export function value<L extends ShortName = never>(o: Valued<L> & { readonly required: true }): ValueOption<string, "required", L>;
/** An option with one text value and a default. */
export function value<L extends ShortName = never>(o: Valued<L> & { readonly default: string }): ValueOption<string, "default", L>;
/** An option with one text value, `undefined` when not given. */
export function value<L extends ShortName = never>(o: Valued<L>): ValueOption<string, "none", L>;
/** The implementation of `value`. */
export function value(
  o: Valued<ShortName> & { readonly parse?: Parser<unknown>; readonly required?: true; readonly default?: unknown },
): ValueOption<unknown> {
  return {
    kind: "value",
    short: o.short,
    help: o.help,
    valueName: o.valueName ?? "VALUE",
    parse: o.parse ?? text,
    fallback: o.required === true ? { kind: "required" } : "default" in o ? { kind: "default", value: o.default } : { kind: "none" },
  };
}

/** An option given any number of times, each value parsed by `parse`. */
export function many<T, L extends ShortName = never>(o: Valued<L> & { readonly parse: Parser<T> }): ManyOption<T, L>;
/** An option given any number of times, each value its text. */
export function many<L extends ShortName = never>(o: Valued<L>): ManyOption<string, L>;
/** The implementation of `many`. */
export function many(o: Valued<ShortName> & { readonly parse?: Parser<unknown> }): ManyOption<unknown> {
  return { kind: "many", short: o.short, help: o.help, valueName: o.valueName ?? "VALUE", parse: o.parse ?? text };
}

/** The parser of a text value: the text itself. */
const text: Parser<string> = (t) => ok(t);

/** A parser of an integer written in decimal, with an optional `-`, within the safe integers. */
export function integerText(t: string): Result<number, string> {
  return /^-?(0|[1-9][0-9]*)$/.test(t) && Number.isSafeInteger(Number(t)) ? ok(Number(t)) : err("expected an integer");
}

/** The long option of a spec's key: `dryRun` is `--dry-run`. */
export function longName(key: string): string {
  return `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** The number of insertions, deletions and substitutions that turn `a` into `b` (Levenshtein). */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row.push(Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/** The candidate nearest `word` by edit distance, the first of equals, if it is within two edits or half the word's length; else nothing. */
export function suggest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = editDistance(word, c);
    if (d < bestDistance) {
      best = c;
      bestDistance = d;
    }
  }
  return bestDistance <= Math.max(2, Math.floor(word.length / 2)) ? best : undefined;
}

/** Whether a word asks for help: `--help`, or a short word with the letter `h` (`-h`, `-vh`). */
function asksHelp(word: string): boolean {
  return word === "--help" || /^-[A-Za-z]*h[A-Za-z]*$/.test(word);
}

/** One declared option with its key and long name. */
type Entry = { readonly key: string; readonly long: string; readonly option: Option };

/** The words an operand is shown as: `FILE`, `[FILE]`, `[FILE...]`. */
function operandWord(o: Operand): string {
  switch (o.arity) {
    case "one":
      return o.name;
    case "optional":
      return `[${o.name}]`;
    case "many":
      return `[${o.name}...]`;
    default:
      return absurd(o.arity);
  }
}

/**
 * Parses `argv` against `spec`, and the arguments against `operands` (none by default): help where it is asked for, else every option's
 * value with the arguments and the words after `--`, or the first thing that does not fit.
 */
export function parseArgs<S extends Spec>(
  argv: readonly string[],
  spec: S & SpecCheck<S>,
  operands: readonly Operand[] = [],
): Result<Parsed<S>, UsageError> {
  const end = argv.indexOf("--");
  if ((end < 0 ? argv : argv.slice(0, end)).some(asksHelp)) return ok({ kind: "help" });
  const entries: readonly Entry[] = Object.keys(spec).flatMap((key) => {
    const option = spec[key];
    return option === undefined ? [] : [{ key, long: longName(key), option }];
  });
  const longs = [
    ...entries.flatMap((e) => (e.option.kind === "flag" && e.option.negatable ? [e.long, `--no-${e.long.slice(2)}`] : [e.long])),
    "--help",
  ];
  const given = new Map<string, unknown>();
  const listed = new Map<string, unknown[]>();
  const positionals: string[] = [];
  let rest: readonly string[] = [];
  let i = 0;

  /** Records the value of `e`, written `written`, whose text is `inline` or else the next word. */
  const take = (e: Entry, written: string, inline: string | undefined, negated: boolean): UsageError | undefined => {
    const o = e.option;
    if (o.kind !== "many" && given.has(e.key)) return { kind: "repeated-option", option: e.long };
    if (o.kind === "flag") {
      if (inline !== undefined) return { kind: "unexpected-value", option: written, value: inline };
      given.set(e.key, !negated);
      return undefined;
    }
    const t = inline ?? argv[++i];
    if (t === undefined) return { kind: "missing-value", option: written };
    const parsed = o.parse(t);
    if (parsed.kind === "err") {
      const reason = typeof parsed.error === "string" ? parsed.error : `expected ${parsed.error.expected}, found ${parsed.error.found}`;
      return { kind: "invalid-value", option: written, value: t, reason };
    }
    if (o.kind === "value") given.set(e.key, parsed.value);
    else listed.set(e.key, [...(listed.get(e.key) ?? []), parsed.value]);
    return undefined;
  };

  for (; i < argv.length; i++) {
    const word = argv[i] ?? "";
    if (word === "--") {
      rest = argv.slice(i + 1);
      break;
    }
    if (word.startsWith("--")) {
      const eq = word.indexOf("=");
      const name = eq < 0 ? word : word.slice(0, eq);
      const inline = eq < 0 ? undefined : word.slice(eq + 1);
      if (name === "--help") return err({ kind: "unexpected-value", option: name, value: inline ?? "" });
      const direct = entries.find((e) => e.long === name);
      const positive = name.startsWith("--no-") ? entries.find((e) => e.long === `--${name.slice(5)}`) : undefined;
      const negated = direct === undefined && positive !== undefined && positive.option.kind === "flag" && positive.option.negatable;
      const e = direct ?? (negated ? positive : undefined);
      if (e === undefined) return err({ kind: "unknown-option", option: name, suggestion: suggest(name, longs) });
      const problem = take(e, name, inline, negated);
      if (problem !== undefined) return err(problem);
      continue;
    }
    if (word.length < 2 || !word.startsWith("-") || /^-[0-9]/.test(word)) {
      positionals.push(word);
      continue;
    }
    for (let j = 1; j < word.length; j++) {
      const letter = word.charAt(j);
      const written = `-${letter}`;
      const e = entries.find((x) => x.option.short === letter);
      if (e === undefined) return err({ kind: "unknown-option", option: written, suggestion: suggest(`-${word}`, longs) });
      const after = word.slice(j + 1);
      if (e.option.kind === "flag") {
        if (after.startsWith("=")) return err({ kind: "unexpected-value", option: written, value: after.slice(1) });
      } else if (after !== "") {
        return err({ kind: "attached-value", option: written, word });
      }
      const problem = take(e, written, undefined, false);
      if (problem !== undefined) return err(problem);
    }
  }

  const values: [string, unknown][] = [];
  for (const e of entries) {
    const o = e.option;
    switch (o.kind) {
      case "many":
        values.push([e.key, listed.get(e.key) ?? []]);
        break;
      case "flag":
      case "value": {
        if (given.has(e.key)) {
          values.push([e.key, given.get(e.key)]);
          break;
        }
        const f = o.fallback;
        switch (f.kind) {
          case "none":
            values.push([e.key, undefined]);
            break;
          case "default":
            values.push([e.key, f.value]);
            break;
          case "required":
            return err({ kind: "missing-option", option: e.long });
          default:
            return absurd(f);
        }
        break;
      }
      default:
        return absurd(o);
    }
  }

  const least = operands.filter((o) => o.arity === "one");
  const most = operands.some((o) => o.arity === "many") ? Number.POSITIVE_INFINITY : operands.filter((o) => o.arity !== "many").length;
  const missing = least[positionals.length];
  if (missing !== undefined) return err({ kind: "missing-argument", argument: missing.name });
  const extra = positionals[most];
  if (extra !== undefined) return err({ kind: "unexpected-argument", argument: extra, takes: operands.map(operandWord) });

  // The one assertion: each value above was computed from its own key's declaration, as `OptionValue` describes, which the compiler cannot follow through `Object.fromEntries`.
  const options = Object.fromEntries(values) as OptionValues<S>;
  return ok({ kind: "args", options, positionals, rest });
}

/** A usage error as one sentence; `command` names the command (`ergactl toolchain list`), "this command" by default. */
export function formatUsageError(e: UsageError, command = "this command"): string {
  switch (e.kind) {
    case "unknown-option":
      return `${e.option} is not an option of ${command}${e.suggestion === undefined ? "" : `; did you mean ${e.suggestion}?`}`;
    case "missing-value":
      return `${e.option} needs a value`;
    case "unexpected-value":
      return `${e.option} takes no value, but was given ${JSON.stringify(e.value)}`;
    case "attached-value":
      return `${e.option} takes its value as the next word, not attached as in ${e.word}`;
    case "invalid-value":
      return `${JSON.stringify(e.value)} is not a valid value of ${e.option}: ${e.reason}`;
    case "repeated-option":
      return `${e.option} is given more than once`;
    case "missing-option":
      return `${e.option} is required`;
    case "missing-argument":
      return `${command} needs ${e.argument}`;
    case "unexpected-argument":
      return `${command} does not take ${e.argument}: ${e.takes.length === 0 ? "it takes no arguments" : `it takes ${e.takes.join(" ")}`}`;
    default:
      return absurd(e);
  }
}

/** A default as the help shows it: text and numbers as they are, anything else as JSON. */
function shown(v: unknown): string {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "bigint" ? String(v) : JSON.stringify(v);
}

/** The left column of an option's line in the help, and what follows its description. */
function optionLine(e: Entry): { readonly left: string; readonly note: string } {
  const o = e.option;
  const short = o.short === undefined ? "    " : `-${o.short}, `;
  switch (o.kind) {
    case "flag":
      return {
        left: `${short}${o.negatable ? `--[no-]${e.long.slice(2)}` : e.long}`,
        note: o.negatable && o.fallback.kind === "default" ? ` (default: ${o.fallback.value ? e.long : `--no-${e.long.slice(2)}`})` : "",
      };
    case "value": {
      const f = o.fallback;
      const note = f.kind === "default" ? ` (default: ${shown(f.value)})` : f.kind === "required" ? " (required)" : "";
      return { left: `${short}${e.long} ${o.valueName}`, note };
    }
    case "many":
      return { left: `${short}${e.long} ${o.valueName}`, note: " (repeatable)" };
    default:
      return absurd(o);
  }
}

/** Lines of two columns, the second aligned two spaces after the widest first. */
function columns(rows: readonly (readonly [string, string])[]): readonly string[] {
  const width = Math.max(0, ...rows.map(([l]) => l.length));
  return rows.map(([l, r]) => `  ${l.padEnd(width)}  ${r}`.trimEnd());
}

/** The help of a command: its summary, its usage, its options aligned with their defaults, and its arguments. */
export function helpText<S extends Spec>(
  program: string,
  summary: string,
  spec: S & SpecCheck<S>,
  operands: readonly Operand[] = [],
): string {
  return helpOf(program, summary, spec, operands);
}

/** The help of a command whose spec was checked where it was declared (a verb of `./commands.ts`), as `helpText` gives it. */
export function helpOf(program: string, summary: string, spec: Spec, operands: readonly Operand[] = []): string {
  const entries: readonly Entry[] = Object.keys(spec).flatMap((key) => {
    const option = spec[key];
    return option === undefined ? [] : [{ key, long: longName(key), option }];
  });
  const required = entries.flatMap((e) =>
    e.option.kind === "value" && e.option.fallback.kind === "required" ? [`${e.long} ${e.option.valueName}`] : [],
  );
  const usage = [program, "[OPTIONS]", ...required, ...operands.map(operandWord)].join(" ");
  const rows = entries.map((e): readonly [string, string] => {
    const line = optionLine(e);
    return [line.left, `${e.option.help}${line.note}`];
  });
  return [
    `${program}: ${summary}`,
    "",
    `Usage: ${usage}`,
    "",
    "Options:",
    ...columns([...rows, ["-h, --help", "Show this help and do nothing else."]]),
    ...(operands.length === 0 ? [] : ["", "Arguments:", ...columns(operands.map((o) => [operandWord(o), o.help]))]),
  ].join("\n");
}

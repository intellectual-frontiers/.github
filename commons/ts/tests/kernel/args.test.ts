/**
 * Tests of `kernel/args.ts`: every rule of the grammar, every kind of usage error and its sentence, the "did you mean", the help text,
 * the types inferred from a declaration (with negative controls), and a property: declared options written into a command line in any
 * valid form parse back to the same values.
 *
 * @module
 */
import fc from "fast-check";
import {
  type Args,
  editDistance,
  flag,
  formatUsageError,
  helpText,
  integerText,
  longName,
  many,
  type Operand,
  parseArgs,
  type Parsed,
  type Spec,
  suggest,
  type UsageError,
  value,
} from "../../kernel/args.ts";
import { literal } from "../../kernel/decode.ts";
import { err, ok, type Result } from "../../kernel/result.ts";
import { type Equal, expectType } from "../../kernel/types.ts";
import { assertEquals, fail, proves } from "../../runtime/test.ts";

const FR = "0005-typescript-runtime FR-047";
const TYPES = "0005-typescript-runtime FR-014";

const spec = {
  verbose: flag({ short: "v", help: "Say more." }),
  quiet: flag({ short: "q", help: "Say less." }),
  color: flag({ help: "Colour the output.", negatable: true }),
  cache: flag({ help: "Use the cache.", negatable: true, default: true }),
  out: value({ short: "o", help: "Where to write.", valueName: "FILE" }),
  tag: many({ short: "t", help: "A tag." }),
  jobs: value({ short: "j", help: "How many at once.", parse: integerText, default: 4, valueName: "N" }),
  level: value({ help: "How strict.", parse: literal("low", "high") }),
  dryRun: flag({ help: "Change nothing." }),
};

/** The options parsed from `argv`, or a failure of the test. */
function args<S extends Spec>(r: Result<Parsed<S>, UsageError>): Args<S> {
  if (r.kind === "err") return fail(`expected options, got ${formatUsageError(r.error)}`);
  if (r.value.kind === "help") return fail("expected options, got help");
  return r.value;
}

/** The usage error of a command line that must not parse. */
function refusal<S extends Spec>(r: Result<Parsed<S>, UsageError>): UsageError {
  return r.kind === "err" ? r.error : fail("expected a usage error");
}

const HELP: Result<Parsed<typeof spec>, UsageError> = ok({ kind: "help" });

const NONE = {
  verbose: false,
  quiet: false,
  color: undefined,
  cache: true,
  out: undefined,
  tag: [],
  jobs: 4,
  level: undefined,
  dryRun: false,
};

proves([FR], "nothing given: every option its fallback", () => {
  assertEquals(parseArgs([], spec), ok({ kind: "args" as const, options: NONE, positionals: [], rest: [] }));
});

proves([FR], "long options: --name VALUE, --name=VALUE, an empty value, a value that starts with a dash", () => {
  assertEquals(args(parseArgs(["--out", "a.txt"], spec)).options.out, "a.txt");
  assertEquals(args(parseArgs(["--out=a=b"], spec)).options.out, "a=b");
  assertEquals(args(parseArgs(["--out="], spec)).options.out, "");
  assertEquals(args(parseArgs(["--out", "-x"], spec)).options.out, "-x");
  assertEquals(args(parseArgs(["--jobs", "-3"], spec)).options.jobs, -3);
  assertEquals(args(parseArgs(["--dry-run"], spec)).options.dryRun, true);
  assertEquals(longName("dryRun"), "--dry-run");
});

proves([FR], "short options: -x VALUE, bundled flags -vq, a bundle whose last letter takes the next word", () => {
  assertEquals(args(parseArgs(["-o", "a"], spec)).options.out, "a");
  const r = args(parseArgs(["-vqo", "a"], spec)).options;
  assertEquals([r.verbose, r.quiet, r.out], [true, true, "a"]);
});

proves([FR], "a negatable flag: --name gives true, --no-name false, absent its default or undefined", () => {
  assertEquals(args(parseArgs(["--color"], spec)).options.color, true);
  assertEquals(args(parseArgs(["--no-color"], spec)).options.color, false);
  assertEquals(args(parseArgs(["--no-cache"], spec)).options.cache, false);
  assertEquals(refusal(parseArgs(["--no-verbose"], spec)), { kind: "unknown-option", option: "--no-verbose", suggestion: "--verbose" });
});

proves([FR], "a repeatable option keeps every value in order; values are parsed by a function or a decoder", () => {
  assertEquals(args(parseArgs(["-t", "a", "--tag=b", "--tag", "c"], spec)).options.tag, ["a", "b", "c"]);
  assertEquals(args(parseArgs(["--jobs=12", "--level", "high"], spec)).options, { ...NONE, jobs: 12, level: "high" });
});

proves([FR], "-- ends the options and the words after it are kept apart; - and -5 are arguments", () => {
  const r = args(parseArgs(["a", "-v", "-", "-5", "--", "--out", "-h"], spec, [{ name: "WORD", help: "A word.", arity: "many" }]));
  assertEquals(r.positionals, ["a", "-", "-5"]);
  assertEquals(r.rest, ["--out", "-h"]);
  assertEquals(r.options.verbose, true);
});

proves([FR], "help wins over every other word and every error before --, and runs nothing else", () => {
  assertEquals(parseArgs(["--help"], spec), HELP);
  assertEquals(parseArgs(["--bogus", "-h"], spec), HELP);
  assertEquals(parseArgs(["-vh", "extra"], spec), HELP);
  assertEquals(parseArgs(["--out", "--help"], spec), HELP);
  assertEquals(refusal(parseArgs(["--help=yes"], spec)), { kind: "unexpected-value", option: "--help", value: "yes" });
  assertEquals(args(parseArgs(["--", "--help"], spec)).rest, ["--help"]);
});

proves([FR], "an undeclared option is refused, with the nearest declared name", () => {
  assertEquals(refusal(parseArgs(["--verbos"], spec)), { kind: "unknown-option", option: "--verbos", suggestion: "--verbose" });
  assertEquals(refusal(parseArgs(["--zzzzzzzz"], spec)), { kind: "unknown-option", option: "--zzzzzzzz", suggestion: undefined });
  assertEquals(refusal(parseArgs(["--hepl"], spec)), { kind: "unknown-option", option: "--hepl", suggestion: "--help" });
  assertEquals(refusal(parseArgs(["-z"], spec)), { kind: "unknown-option", option: "-z", suggestion: undefined });
  // A long option written with one dash: the letter that is not declared, and the long option it was meant to be.
  assertEquals(refusal(parseArgs(["-verbose"], spec)), { kind: "unknown-option", option: "-e", suggestion: "--verbose" });
  assertEquals(
    formatUsageError(refusal(parseArgs(["--jsn"], { json: flag({ help: "JSON." }) })), "ergactl toolchain list"),
    "--jsn is not an option of ergactl toolchain list; did you mean --json?",
  );
});

proves([FR], "a value-taking option at the end with no value, and a flag given a value, are refused", () => {
  assertEquals(refusal(parseArgs(["--out"], spec)), { kind: "missing-value", option: "--out" });
  assertEquals(refusal(parseArgs(["-vo"], spec)), { kind: "missing-value", option: "-o" });
  assertEquals(refusal(parseArgs(["--verbose=yes"], spec)), { kind: "unexpected-value", option: "--verbose", value: "yes" });
  assertEquals(refusal(parseArgs(["--no-color=1"], spec)), { kind: "unexpected-value", option: "--no-color", value: "1" });
  assertEquals(refusal(parseArgs(["-v=1"], spec)), { kind: "unexpected-value", option: "-v", value: "1" });
});

proves([FR], "a short option's value is never attached: -ofile, -o=file and -ov are refused", () => {
  assertEquals(refusal(parseArgs(["-ofile"], spec)), { kind: "attached-value", option: "-o", word: "-ofile" });
  assertEquals(refusal(parseArgs(["-o=file"], spec)), { kind: "attached-value", option: "-o", word: "-o=file" });
  assertEquals(refusal(parseArgs(["-ov", "x"], spec)), { kind: "attached-value", option: "-o", word: "-ov" });
});

proves([FR], "a value its parser refuses is an invalid value, with the parser's or the decoder's reason", () => {
  assertEquals(refusal(parseArgs(["--jobs", "four"], spec)), {
    kind: "invalid-value",
    option: "--jobs",
    value: "four",
    reason: "expected an integer",
  });
  assertEquals(refusal(parseArgs(["-j", "1.5"], spec)), {
    kind: "invalid-value",
    option: "-j",
    value: "1.5",
    reason: "expected an integer",
  });
  assertEquals(refusal(parseArgs(["--level=mid"], spec)), {
    kind: "invalid-value",
    option: "--level",
    value: "mid",
    reason: 'expected one of low, high, found the string "mid"',
  });
  assertEquals(integerText("9007199254740993").kind, "err");
  assertEquals(integerText("007").kind, "err");
  assertEquals(integerText("-0"), ok(-0));
});

proves([FR], "an option given twice is refused, a flag and its negation included (no value silently replaced)", () => {
  assertEquals(refusal(parseArgs(["--out", "a", "-o", "b"], spec)), { kind: "repeated-option", option: "--out" });
  assertEquals(refusal(parseArgs(["-v", "--verbose"], spec)), { kind: "repeated-option", option: "--verbose" });
  assertEquals(refusal(parseArgs(["-vv"], spec)), { kind: "repeated-option", option: "--verbose" });
  assertEquals(refusal(parseArgs(["--color", "--no-color"], spec)), { kind: "repeated-option", option: "--color" });
});

proves([FR], "a required option not given is refused; given, its type has no undefined", () => {
  const s = { host: value({ help: "The host.", required: true }), port: value({ help: "The port.", parse: integerText, required: true }) };
  assertEquals(refusal(parseArgs(["--host", "a"], s)), { kind: "missing-option", option: "--port" });
  assertEquals(args(parseArgs(["--host", "a", "--port", "22"], s)).options, { host: "a", port: 22 });
});

proves([FR], "arguments are checked against the declared operands: none by default, too few, too many", () => {
  const operands: readonly Operand[] = [
    { name: "SOURCE", help: "What to copy.", arity: "one" },
    { name: "TARGET", help: "Where to.", arity: "optional" },
  ];
  assertEquals(refusal(parseArgs(["x"], spec)), { kind: "unexpected-argument", argument: "x", takes: [] });
  assertEquals(refusal(parseArgs([], spec, operands)), { kind: "missing-argument", argument: "SOURCE" });
  assertEquals(args(parseArgs(["a", "b"], spec, operands)).positionals, ["a", "b"]);
  assertEquals(refusal(parseArgs(["a", "b", "c"], spec, operands)), {
    kind: "unexpected-argument",
    argument: "c",
    takes: ["SOURCE", "[TARGET]"],
  });
});

proves([FR], "each usage error is one sentence", () => {
  const sentences: readonly [UsageError, string][] = [
    [{ kind: "unknown-option", option: "-z", suggestion: undefined }, "-z is not an option of this command"],
    [{ kind: "missing-value", option: "--out" }, "--out needs a value"],
    [{ kind: "unexpected-value", option: "--verbose", value: "yes" }, '--verbose takes no value, but was given "yes"'],
    [{ kind: "attached-value", option: "-o", word: "-ofile" }, "-o takes its value as the next word, not attached as in -ofile"],
    [
      { kind: "invalid-value", option: "--jobs", value: "x", reason: "expected an integer" },
      '"x" is not a valid value of --jobs: expected an integer',
    ],
    [{ kind: "repeated-option", option: "--out" }, "--out is given more than once"],
    [{ kind: "missing-option", option: "--port" }, "--port is required"],
    [{ kind: "missing-argument", argument: "SOURCE" }, "cp needs SOURCE"],
    [{ kind: "unexpected-argument", argument: "c", takes: ["SOURCE", "[TARGET]"] }, "cp does not take c: it takes SOURCE [TARGET]"],
    [{ kind: "unexpected-argument", argument: "c", takes: [] }, "cp does not take c: it takes no arguments"],
  ];
  for (const [e, s] of sentences) assertEquals(formatUsageError(e, e.kind.endsWith("argument") ? "cp" : undefined), s);
});

proves([FR], "the suggestion is the nearest declared name within two edits or half the word", () => {
  assertEquals(editDistance("kitten", "sitting"), 3);
  assertEquals(editDistance("", "abc"), 3);
  assertEquals(suggest("--jsn", ["--quiet", "--json"]), "--json");
  assertEquals(suggest("--x", ["--json"]), undefined);
  assertEquals(suggest("--a", []), undefined);
});

proves([FR], "the help: summary, usage, options aligned with defaults and notes, help itself, then the arguments", () => {
  const s = {
    verbose: flag({ short: "v", help: "Say more." }),
    cache: flag({ help: "Use the cache.", negatable: true, default: true }),
    host: value({ help: "The host.", required: true, valueName: "NAME" }),
    jobs: value({ short: "j", help: "How many at once.", parse: integerText, default: 4, valueName: "N" }),
    tag: many({ help: "A tag." }),
  };
  const text = helpText("deploy", "Deploy a site.", s, [
    { name: "SITE", help: "The site.", arity: "one" },
    { name: "PATH", help: "Paths to send.", arity: "many" },
  ]);
  assertEquals(
    text,
    [
      "deploy: Deploy a site.",
      "",
      "Usage: deploy [OPTIONS] --host NAME SITE [PATH...]",
      "",
      "Options:",
      "  -v, --verbose     Say more.",
      "      --[no-]cache  Use the cache. (default: --cache)",
      "      --host NAME   The host. (required)",
      "  -j, --jobs N      How many at once. (default: 4)",
      "      --tag VALUE   A tag. (repeatable)",
      "  -h, --help        Show this help and do nothing else.",
      "",
      "Arguments:",
      "  SITE       The site.",
      "  [PATH...]  Paths to send.",
    ].join("\n"),
  );
  assertEquals(
    helpText("x", "Nothing.", {}),
    "x: Nothing.\n\nUsage: x [OPTIONS]\n\nOptions:\n  -h, --help  Show this help and do nothing else.",
  );
});

proves([FR, TYPES], "the parsed options' type is inferred from the declaration", () => {
  const r = parseArgs([], spec);
  const options = args(r).options;
  expectType<
    Equal<
      typeof options,
      {
        readonly verbose: boolean;
        readonly quiet: boolean;
        readonly color: boolean | undefined;
        readonly cache: boolean;
        readonly out: string | undefined;
        readonly tag: readonly string[];
        readonly jobs: number;
        readonly level: "low" | "high" | undefined;
        readonly dryRun: boolean;
      }
    >
  >();
  const s = {
    host: value({ help: "h", required: true }),
    name: value({ help: "n", default: "x" }),
    ports: many({ help: "p", parse: integerText }),
  };
  const o = args(parseArgs(["--host", "a"], s)).options;
  expectType<Equal<typeof o, { readonly host: string; readonly name: string; readonly ports: readonly number[] }>>();
  expectType<Equal<typeof r, Result<Parsed<typeof spec>, UsageError>>>();
  assertEquals(o, { host: "a", name: "x", ports: [] });
  assertEquals(options, NONE);
});

proves([FR, TYPES], "a malformed declaration does not compile (negative controls)", () => {
  // @ts-expect-error -- a short option is one letter
  flag({ short: "vv", help: "x" });
  // @ts-expect-error -- the letter h is help's
  flag({ short: "h", help: "x" });
  // @ts-expect-error -- a default needs a negatable flag, or it could never be false
  flag({ help: "x", default: true });
  // @ts-expect-error -- required and default together mean nothing
  value({ help: "x", required: true, default: "a" });
  // @ts-expect-error -- the default has the parser's type
  value({ help: "x", parse: integerText, default: "4" });
  // @ts-expect-error -- a parser takes the text and gives a Result
  value({ help: "x", parse: (t: string) => t.length });
  // @ts-expect-error -- two options with the letter v
  parseArgs([], { a: flag({ short: "v", help: "a" }), b: value({ short: "v", help: "b" }) });
  // @ts-expect-error -- names are camelCase keys, not dashed
  parseArgs([], { "dry-run": flag({ help: "a" }) });
  // @ts-expect-error -- help is reserved
  parseArgs([], { help: flag({ help: "a" }) });
  const o = args(parseArgs([], spec)).options;
  // @ts-expect-error -- an option that is not declared is not in the result
  assertEquals(o.verbos, undefined);
  // @ts-expect-error -- the result is read-only
  o.verbose = true;
  // @ts-expect-error -- an optional value may be undefined
  const out: string = o.out;
  assertEquals([out], [undefined]);
});

/** A value a property may write: anything that is not itself a request for help. */
const word = fc.string({ maxLength: 8 }).filter((s) => s !== "--help" && !/^-[A-Za-z]*h[A-Za-z]*$/.test(s));
/** An argument: a word that does not start with a dash. */
const argument = fc.string({ maxLength: 8 }).filter((s) => !s.startsWith("-"));

proves([FR, TYPES], "declared options written into a command line in any valid form parse back to the same values (round trip)", () => {
  const operands: readonly Operand[] = [{ name: "FILE", help: "Files.", arity: "many" }];
  const arb = fc.record({
    verbose: fc.boolean(),
    quiet: fc.boolean(),
    color: fc.option(fc.boolean(), { nil: undefined }),
    out: fc.option(word, { nil: undefined }),
    tag: fc.array(word, { maxLength: 4 }),
    jobs: fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: undefined }),
    level: fc.option(fc.constantFrom("low" as const, "high" as const), { nil: undefined }),
    positionals: fc.array(argument, { maxLength: 4 }),
    rest: fc.option(fc.array(fc.string({ maxLength: 6 }), { maxLength: 3 }), { nil: undefined }),
    forms: fc.array(fc.nat(2), { minLength: 12, maxLength: 12 }),
    order: fc.array(fc.double({ noNaN: true }), { minLength: 16, maxLength: 16 }),
  });
  fc.assert(
    fc.property(arb, (v) => {
      type Chunk = { readonly words: readonly string[]; readonly tag?: string; readonly positional?: string };
      const form = (n: number): number => v.forms[n] ?? 0;
      const chunks: Chunk[] = [];
      if (v.verbose && v.quiet && form(0) === 0) chunks.push({ words: ["-vq"] });
      else {
        if (v.verbose) chunks.push({ words: [form(1) === 0 ? "-v" : "--verbose"] });
        if (v.quiet) chunks.push({ words: [form(2) === 0 ? "-q" : "--quiet"] });
      }
      if (v.color !== undefined) chunks.push({ words: [v.color ? "--color" : "--no-color"] });
      const valued = (long: string, short: string | undefined, text: string, f: number): readonly string[] =>
        f === 0 ? [`--${long}`, text] : f === 1 || short === undefined ? [`--${long}=${text}`] : [`-${short}`, text];
      if (v.out !== undefined) chunks.push({ words: valued("out", "o", v.out, form(3)) });
      if (v.jobs !== undefined) chunks.push({ words: valued("jobs", "j", String(v.jobs), form(4)) });
      if (v.level !== undefined) chunks.push({ words: valued("level", undefined, v.level, form(5)) });
      v.tag.forEach((t, n) => chunks.push({ words: valued("tag", "t", t, form(6 + (n % 6))), tag: t }));
      for (const p of v.positionals) chunks.push({ words: [p], positional: p });
      const sorted = chunks
        .map((c, n) => ({ c, key: v.order[n] ?? 0 }))
        .sort((a, b) => a.key - b.key)
        .map((x) => x.c);
      const argv = [...sorted.flatMap((c) => c.words), ...(v.rest === undefined ? [] : ["--", ...v.rest])];
      const parsed = args(parseArgs(argv, spec, operands));
      assertEquals(parsed, {
        kind: "args",
        options: {
          ...NONE,
          verbose: v.verbose,
          quiet: v.quiet,
          color: v.color,
          out: v.out,
          tag: sorted.flatMap((c) => (c.tag === undefined ? [] : [c.tag])),
          jobs: v.jobs ?? 4,
          level: v.level,
        },
        positionals: sorted.flatMap((c) => (c.positional === undefined ? [] : [c.positional])),
        rest: v.rest ?? [],
      });
    }),
  );
});

proves([FR], "errors are values: a usage error is returned, never thrown", () => {
  const r = parseArgs(["--out"], spec);
  assertEquals(r, err({ kind: "missing-value", option: "--out" }));
});

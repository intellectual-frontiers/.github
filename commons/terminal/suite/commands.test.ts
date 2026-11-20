/**
 * Tests of `kernel/commands.ts`: a tree resolved to its verb with the arguments left for it, help asked for at every level (and no verb
 * run for it), unknown words with the words known there and the nearest, the problems of a declared tree, and help rendered from the
 * declaration alone.
 *
 * @module
 */
import { flag } from "../src/args.ts";
import { commandHelp, formatCommandError, group, resolveCommand, treeProblems, validCommandName, verb } from "../src/commands.ts";
import { assert, assertEquals, assertStringIncludes, fail, proves } from "@intellectual-frontiers/test";

const FR = "0001-terminal FR-002";

const build = verb({
  name: "build",
  summary: "Build the works.",
  options: { jobs: flag({ help: "Many at once." }) },
  operands: [{ name: "WORK", help: "The works.", arity: "many" }],
  examples: [{ args: ["essay"], says: "builds every essay" }],
});
const tree = group({
  name: "tool",
  summary: "A tool.",
  children: [
    group({ name: "work", summary: "The works.", children: [build] }),
    group({
      name: "rendition",
      summary: "Renditions.",
      children: [group({ name: "edition", summary: "Editions.", children: [verb({ name: "list", summary: "List.", options: {} })] })],
    }),
  ],
});

proves([FR], "an argument vector resolves to its verb, with the words after it left for the verb", () => {
  const r = resolveCommand(tree, ["work", "build", "essay", "--jobs", "--", "--help"]);
  if (r.kind !== "ok" || r.value.kind !== "verb") return fail("a verb");
  assertEquals(r.value.path, ["tool", "work", "build"]);
  assertEquals(r.value.verb.name, "build");
  assertEquals(r.value.args, ["essay", "--jobs", "--", "--help"]);
  const deep = resolveCommand(tree, ["rendition", "edition", "list"]);
  assert(deep.kind === "ok" && deep.value.kind === "verb" && deep.value.path.join(" ") === "tool rendition edition list");
});

proves([FR], "help is asked for at every level, and names the node it is for", () => {
  const at = (argv: string[]): string => {
    const r = resolveCommand(tree, argv);
    return r.kind === "ok" && r.value.kind === "help" ? r.value.path.join(" ") : "not help";
  };
  assertEquals(at([]), "tool");
  assertEquals(at(["--help"]), "tool");
  assertEquals(at(["work"]), "tool work");
  assertEquals(at(["work", "-h"]), "tool work");
  assertEquals(at(["work", "build", "essay", "--help"]), "tool work build");
  assertEquals(at(["rendition", "edition"]), "tool rendition edition");
});

proves([FR], "a word not known is named with where, the words known there, and the nearest", () => {
  const r = resolveCommand(tree, ["wrk", "build"]);
  if (r.kind !== "err") return fail("an error");
  assertEquals(r.error, { kind: "unknown-command", path: ["tool"], word: "wrk", known: ["work", "rendition"], suggestion: "work" });
  assertEquals(formatCommandError(r.error), "wrk is not a command of tool; did you mean work? Run tool --help to see what it takes.");
  const v = resolveCommand(tree, ["work", "biuld"]);
  assert(v.kind === "err" && v.error.suggestion === "build" && v.error.path.join(" ") === "tool work");
  const far = resolveCommand(tree, ["work", "zzzzzzzz"]);
  assert(far.kind === "err" && far.error.suggestion === undefined);
  const opt = resolveCommand(tree, ["--hepl"]);
  assert(opt.kind === "err" && opt.error.suggestion === "--help");
  assertStringIncludes(opt.kind === "err" ? formatCommandError(opt.error) : "", "is not an option of tool");
});

proves([FR], "the problems of a declared tree: names that may not be one, and two children of one name", () => {
  assert(validCommandName("agora-work") && !validCommandName("Work") && !validCommandName("1x") && !validCommandName(""));
  const bad = group({ name: "tool", summary: "", children: [build, build, verb({ name: "Bad", summary: "", options: {} })] });
  assertEquals(treeProblems(bad), [
    { kind: "duplicate", path: ["tool"], name: "build" },
    { kind: "bad-name", path: ["tool"], name: "Bad" },
  ]);
  assertEquals(treeProblems(tree), []);
});

proves([FR], "help is rendered from the declaration alone: a group's commands, a verb's options, arguments and examples", () => {
  const g = commandHelp(["tool"], tree);
  assertStringIncludes(g, "tool: A tool.");
  assertStringIncludes(g, "  work       The works.");
  assertStringIncludes(g, "Run tool COMMAND --help");
  const v = commandHelp(["tool", "work", "build"], build);
  assertStringIncludes(v, "Usage: tool work build [OPTIONS] [WORK...]");
  assertStringIncludes(v, "--jobs");
  assertStringIncludes(v, "tool work build essay  builds every essay");
});

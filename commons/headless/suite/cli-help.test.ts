/**
 * Tests of `surfaces/cli/help.ts`: the help, the completions for four shells and the man page, all generated from the tree, so that each command and option is in
 * them and none is named that the parser does not accept (commons headless 0004-headless-cli FR-010).
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { longName } from "@intellectual-frontiers/terminal/args";
import { EXIT_NAMES, exitCodeOf } from "../src/governance/mod.ts";
import { placedCommands, standardOptions, branch, command, programOf, outcomeOf } from "../src/logical/mod.ts";
import { completions, completionTable, effectLines, helpFor, isShell, manPage, SHELLS } from "../src/surfaces/cli/help.ts";
import { run } from "../src/surfaces/cli/run.ts";
import { sample, world } from "./world.ts";

const p = sample();

proves(["0004-headless-cli FR-010"], "the help of every level is made from the declaration, and a verb's help says its effect, its repetition and its audience, with the options of its effect", () => {
  const top = helpFor(p, []) ?? "";
  for (const c of ["status", "sync", "wipe", "work"]) assertStringIncludes(top, c);
  assertStringIncludes(top, "Built in: help, explain, completions, man, run, --version");
  assertStringIncludes(helpFor(p, ["work"]) ?? "", "build");
  assertEquals(helpFor(p, ["work", "nope"]), undefined);
  assertEquals(helpFor(p, ["nope"]), undefined);
  const wipe = helpFor(p, ["wipe"]) ?? "";
  for (const want of ["--dry-run", "--yes", "-y, --yes", "--json", "-q, --quiet", "--no-color", "--non-interactive", "Effect: destroys something that cannot be undone (--dry-run shows what it would do; it asks first; --yes confirms without asking)", "Repeating it: not promised to be safe", "For: anyone"]) {
    assertStringIncludes(wipe, want);
  }
  const status = helpFor(p, ["status"]) ?? "";
  assertStringIncludes(status, "--sarif");
  assertStringIncludes(status, "Effect: only reads: it changes nothing");
  assertStringIncludes(status, "Repeating it: safe, it changes nothing the second time");
  assert(!status.includes("--dry-run") && !status.includes("--yes"));
  assertStringIncludes(status, "Examples:");
  assertStringIncludes(helpFor(p, ["sync"]) ?? "", "--check changes nothing and ends with findings where it would");
  assertEquals(effectLines({ ...placedCommands(p.children)[1]!.facts, audience: "human" }).at(-1), "For: a person");
  assertEquals(effectLines({ ...placedCommands(p.children)[1]!.facts, audience: "machine" }).at(-1), "For: programs");
});

/** Every word of a command line the parser accepts for a placed command: its long options with their negations, and its short letters. */
function acceptedWords(id: string): readonly string[] {
  const placed = placedCommands(p.children).find((x) => x.id === id)!;
  const spec = { ...placed.command.options, ...standardOptions(placed.facts, placed.reach) };
  return Object.entries(spec).flatMap(([k, o]) => [longName(k), ...(o.kind === "flag" && o.negatable ? [`--no-${longName(k).slice(2)}`] : []), ...(o.short === undefined ? [] : [`-${o.short}`])]);
}

proves(["0004-headless-cli FR-010"], "the completion table has every command and every option of the tree, and its words are all words the parser accepts", () => {
  const table = completionTable(p);
  const at = (...path: string[]) => table.find((c) => c.path.join(" ") === path.join(" "))?.words;
  assertEquals(at(), ["status", "sync", "wipe", "work", "help", "explain", "completions", "man", "run", "--help", "--version"]);
  assertEquals(at("work"), ["build", "plan", "--help"]);
  for (const placed of placedCommands(p.children)) {
    const words = at(...placed.path) ?? [];
    for (const w of acceptedWords(placed.id)) assert(words.includes(w), `${placed.id} completes ${w}`);
    for (const w of words) assert(w === "--help" || acceptedWords(placed.id).includes(w), `${placed.id} names ${w}, which the parser does not accept`);
  }
  assert(at("wipe")?.includes("--yes") && !at("sync")?.includes("--yes"));
  assert(at("sync")?.includes("--no-color") && at("sync")?.includes("-q"));
});

proves(["0004-headless-cli FR-010"], "the completion scripts are made for bash, zsh, fish and PowerShell, hold every word of the table, and the bash script is valid bash", () => {
  assertEquals(SHELLS, ["bash", "zsh", "fish", "powershell"]);
  assert(isShell("zsh") && !isShell("tcsh"));
  const table = completionTable(p);
  for (const shell of SHELLS) {
    const script = completions(p, shell);
    assertStringIncludes(script, "tool");
    // fish writes an option as `-l long` and `-s s`
    const written = (w: string): string => (shell !== "fish" ? w : w.startsWith("--") ? `-l ${w.slice(2)}` : w.startsWith("-") ? `-s ${w.slice(1)}` : w);
    for (const c of table) for (const w of c.words) assertStringIncludes(script, written(w));
  }
  assertStringIncludes(completions(p, "bash"), "complete -F _tool tool");
  assertStringIncludes(completions(p, "zsh"), "#compdef tool");
  assertStringIncludes(completions(p, "fish"), "complete -c tool");
  assertStringIncludes(completions(p, "powershell"), "Register-ArgumentCompleter -Native -CommandName 'tool'");
  const bash = spawnSync("bash", ["-n"], { input: completions(p, "bash"), encoding: "utf8" });
  if (bash.error === undefined) assertEquals([bash.status, bash.stderr], [0, ""]);
  // the program's name may hold what an identifier may not
  const odd = programOf({ name: "my-tool", summary: "S.", version: "1", children: [] });
  assertStringIncludes(completions(odd, "bash"), "_my_tool()");
  // a command added to the tree is in all of them with nothing else written
  const more = programOf({ name: "tool", summary: "T.", version: "1", children: [...p.children, branch({ name: "extra", summary: "E.", children: [command({ name: "deep", summary: "D.", options: {}, action: { kind: "report" }, run: () => Promise.resolve(outcomeOf(null)) })] })] });
  for (const shell of SHELLS) assertStringIncludes(completions(more, shell), "deep");
});

proves(["0004-headless-cli FR-010"], "the man page lists each command with its effect and options and the exit statuses of the one table, and holds no date", () => {
  const man = manPage(p);
  assertStringIncludes(man, '.TH TOOL 1 "" "tool 1.2.3"');
  for (const placed of placedCommands(p.children)) assertStringIncludes(man, `.B tool ${placed.id}`);
  assertStringIncludes(man, ".B \\-\\-dry\\-run");
  assertStringIncludes(man, "Effect: destroys something");
  assertStringIncludes(man, ".SH EXIT STATUS");
  for (const n of EXIT_NAMES) assertStringIncludes(man, `.B ${exitCodeOf(n)}\n`);
  assert(!/\b(19|20)\d\d\b/.test(man.replace(/1\.2\.3/, "")), "no date");
  assertEquals(manPage(p), manPage(p));
  // a line that begins with a dot or an apostrophe would be read as a request
  const dotted = manPage(programOf({ name: "t", summary: ".starts with a dot", version: "1", children: [] }));
  assert(dotted.split("\n").every((l) => !l.startsWith(".starts")));
});

proves(["0004-headless-cli FR-010", "0004-headless-cli FR-011"], "help is shown by --help, -h and `help`, at every level, and the same text each way", async () => {
  const say = async (...argv: string[]) => (await run(p, argv, world())).out;
  assertEquals(await say("sync", "--help"), await say("sync", "-h"));
  assertEquals(await say("sync", "--help"), await say("help", "sync"));
  assertEquals(await say("work", "--help"), await say("help", "work"));
  assertEquals(await say("work", "build", "--help"), await say("help", "work", "build"));
  assertEquals(await say("--help"), await say("help"));
  assertStringIncludes(await say("work"), "Commands:");
});

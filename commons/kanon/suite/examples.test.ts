/**
 * Tests of the worked example (commons kanon 0001-kanon-checker FR-019): `suite/examples/reminders` passes the check, each projection is made from the action of Governance, and four broken copies of it
 * give the four codes the Kanon guides of the documentation quote. Each broken copy is a real temporary folder.
 *
 * @module
 */
import { assert, assertEquals, assertStringIncludes, proves } from "@intellectual-frontiers/test";
import { fs, path } from "@intellectual-frontiers/system";
import { findings } from "../src/host.ts";
import { ACTIONS } from "./examples/reminders/src/governance/mod.ts";
import { VERBS } from "./examples/reminders/src/logical/mod.ts";
import { HELP } from "./examples/reminders/src/physical/cli/mod.ts";
import { TOOLS } from "./examples/reminders/src/physical/tool/mod.ts";

const EXAMPLE = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "examples", "reminders");

/** A copy of the example in a temporary folder, with the edits given (a file's path from the example to the text that replaces a piece of it). */
function broken(edits: Readonly<Record<string, readonly [string, string]>>): string {
  const root = fs.makeTempDirSync({ prefix: "kanon-example-" });
  const copy = (from: string, to: string): void => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readDirSync(from)) {
      const source = `${from}/${e.name}`;
      if (e.isDirectory) copy(source, `${to}/${e.name}`);
      else fs.writeTextFileSync(`${to}/${e.name}`, fs.readTextFileSync(source));
    }
  };
  copy(EXAMPLE, root);
  for (const [file, [was, now]] of Object.entries(edits)) {
    const text = fs.readTextFileSync(`${root}/${file}`);
    assert(text.includes(was), `${file} holds ${was}`);
    fs.writeTextFileSync(`${root}/${file}`, text.replace(was, now));
  }
  return root;
}

/** The rules the check finds in a folder, in order. */
function rulesOf(root: string): readonly string[] {
  const r = findings(root);
  assert(r.kind === "ok");
  return r.value.map((f) => f.rule);
}

proves(["0001-kanon-checker FR-019"], "the example passes the import check with nothing held by a baseline", () => {
  assertEquals(rulesOf(EXAMPLE), []);
});

proves(["0001-kanon-checker FR-019"], "each projection of the example is made from the action of Governance: a verb, a usage line and a tool for each, with the hints of its effect", () => {
  assertEquals(VERBS.map((v) => v.from), ACTIONS.map((a) => a.id));
  assertEquals(HELP.length, ACTIONS.length);
  assertEquals(TOOLS.length, ACTIONS.length);
  for (const a of ACTIONS) {
    const tool = TOOLS.find((t) => t.name === a.id.split(" ").join("_"));
    assert(tool !== undefined, `a tool for ${a.id}`);
    assertEquals(tool.annotations.readOnlyHint, a.effect === "read");
    assertEquals(tool.annotations.destructiveHint, a.effect === "destructive");
    assertEquals(tool.annotations.idempotentHint, a.idempotent);
  }
  assertStringIncludes(HELP.join("\n"), "reminder clear --yes");
});

proves(["0001-kanon-checker FR-019"], "a surface that imports the other surface is layers/around", () => {
  const root = broken({ "src/physical/tool/tool.ts": ['import { type Verb, VERBS } from "@example/reminders/logical";', 'import { type Verb, VERBS } from "@example/reminders/logical";\nimport { usageOf } from "@example/reminders/cli";'] });
  assertEquals(rulesOf(root), ["layers/around"]);
});

proves(["0001-kanon-checker FR-019"], "a relative import of another unit is layers/relative, and a path the exports do not name is layers/private", () => {
  assertEquals(rulesOf(broken({ "src/logical/verbs.ts": ['"@example/reminders/governance"', '"../governance/reminder.ts"'] })), ["layers/relative"]);
  assertEquals(rulesOf(broken({ "src/logical/verbs.ts": ['"@example/reminders/governance"', '"@example/reminders/src/governance/reminder.ts"'] })), ["layers/private"]);
});

proves(["0001-kanon-checker FR-019"], "Governance that imports Logical is layers/above", () => {
  const root = broken({ "src/governance/reminder.ts": ["export type Effect", 'import { VERBS } from "@example/reminders/logical";\nexport const COUNT = VERBS.length;\nexport type Effect'] });
  assertEquals(rulesOf(root), ["layers/above"]);
});

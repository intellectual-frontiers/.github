// The shared specification checker (commons 0003-spec-kit): commons' own folder is clean, each rule is broken in a copy and named, and the command line is the one a
// harness runs (erga's `ergactl press check commons-specs`: `deno run --no-config --allow-read commons/tools/spec-kit-check.ts`, in a `.github` checkout, reading both streams).
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { check, message } from "../commons/tools/spec-kit-check.ts";
import { copyTree, ROOT } from "./helpers.ts";

const TOOL = `${ROOT}/commons/tools/spec-kit-check.ts`;
const KIT = `${ROOT}/commons/spec-kit`;

class Kit {
  readonly root: string;
  private constructor(readonly tmp: string) {
    this.root = `${tmp}/kit`;
    copyTree(KIT, this.root);
  }
  static make(): Kit {
    return new Kit(Deno.makeTempDirSync({ prefix: "commons-speckit-" }));
  }
  [Symbol.dispose](): void {
    Deno.removeSync(this.tmp, { recursive: true });
  }
  findings(): string {
    return check(this.root).map((f) => `${f.where}: ${message(f.problem)}`).join("\n");
  }
  edit(rel: string, old: string, now: string): void {
    const f = `${this.root}/${rel}`;
    const text = Deno.readTextFileSync(f);
    assertStringIncludes(text, old);
    Deno.writeTextFileSync(f, text.replace(old, () => now));
  }
}

/** The checker as erga runs it: no configuration, read access alone, from the checkout's folder. */
async function run(args: readonly string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  const o = await new Deno.Command(Deno.execPath(), { args: ["run", "--no-config", "--allow-read", TOOL, ...args], cwd: ROOT, stdout: "piped", stderr: "piped" }).output();
  const dec = new TextDecoder();
  return { code: o.code, stdout: dec.decode(o.stdout), stderr: dec.decode(o.stderr) };
}

Deno.test("commons' own folder is clean from the command line, with no configuration and read access alone (0003-spec-kit FR-006, SC-001)", async () => {
  const p = await run([]);
  assertEquals([p.code, p.stdout, p.stderr], [0, "", ""]);
  using bad = Kit.make();
  bad.edit("registry.tsv", "0003\tspec-kit", "0009\tspec-kit");
  const q = await run(["--root", bad.root]);
  assertEquals(q.code, 1);
  assertStringIncludes(q.stderr, "registry.tsv");
  assertEquals(q.stdout, "");
});

Deno.test("a gap, a repeated number and a missing folder in the register (0003-spec-kit FR-001)", () => {
  using k = Kit.make();
  k.edit("registry.tsv", "0005\tsql-aide\tin force", "0005\tsql-aide\tin force\n0005\tother\tin force\n0007\tnone\tin force");
  const out = k.findings();
  assertStringIncludes(out, "assigned twice");
  assertStringIncludes(out, "gap at 0006");
  assertStringIncludes(out, "0007-none is in force but its specification does not exist");
});

Deno.test("a spec with no row, and a register that is missing (0003-spec-kit FR-001, FR-006)", () => {
  using k = Kit.make();
  copyTree(`${k.root}/specs/0003-spec-kit`, `${k.root}/specs/0009-extra`);
  assertStringIncludes(k.findings(), "has no row in registry.tsv");
  Deno.removeSync(`${k.root}/registry.tsv`);
  const out = k.findings();
  assertStringIncludes(out, "register of specification numbers is missing");
  assertStringIncludes(out, "specs/0009-extra: has no **Spec ID:** line naming 0009-extra", "it went on to check the specifications");
});

Deno.test("the form of a specification (0003-spec-kit FR-002)", () => {
  using k = Kit.make();
  const s = "specs/0003-spec-kit/spec.md";
  k.edit(s, "**Spec ID:** 0003-spec-kit", "**Spec ID:** 0004-x");
  k.edit(s, "**Status:** Draft", "**Status:** Maybe");
  Deno.writeTextFileSync(`${k.root}/${s}`, Deno.readTextFileSync(`${k.root}/${s}`).replaceAll("## Assumptions", "## Zzz"));
  const out = k.findings();
  assertStringIncludes(out, "**Spec ID:** line naming 0003-spec-kit");
  assertStringIncludes(out, "**Status:** must be one of ['Draft', 'Adopted', 'Superseded']");
  assertStringIncludes(out, "has no ## Assumptions section");
});

Deno.test("sections out of order (0003-spec-kit FR-002)", () => {
  using k = Kit.make();
  const s = `${k.root}/specs/0003-spec-kit/spec.md`;
  const [a, b] = ["## Key entities", "## Success criteria"];
  Deno.writeTextFileSync(s, Deno.readTextFileSync(s).replaceAll(a, "@@").replaceAll(b, a).replaceAll("@@", b));
  assertStringIncludes(k.findings(), "sections are out of the order");
});

Deno.test("requirement numbers and edge cases (0003-spec-kit FR-003)", () => {
  using k = Kit.make();
  const s = "specs/0003-spec-kit/spec.md";
  k.edit(s, "the tool names the gap, per FR-001.", "the tool names the gap, per FR-099.");
  k.edit(s, "- A `none` row with no reason: the tool names it, per FR-005.", "- A `none` row with no reason: the tool names it.");
  const out = k.findings();
  assertStringIncludes(out, "cites a requirement that is not here");
  assertStringIncludes(out, "an edge case cites no requirement");
  k.edit(s, "- **FR-002**", "- **FR-001**");
  assertStringIncludes(k.findings(), "used twice");
});

Deno.test("a bare citation of another repository's spec (0003-spec-kit FR-004)", () => {
  using k = Kit.make();
  k.edit("specs/0003-spec-kit/spec.md", "`archon 0024-spec-format` and `archon 0002-specs`.", "0136-machine-bootstrap of archon.");
  assertStringIncludes(k.findings(), "cites 0136-machine-bootstrap");
});

Deno.test("the enforcement register (0003-spec-kit FR-005)", () => {
  using k = Kit.make();
  const f = `${k.root}/enforcement.tsv`;
  const rows = Deno.readTextFileSync(f).split("\n").filter((r) => r !== "" && !r.startsWith("0003-spec-kit FR-001"));
  rows.push("0003-spec-kit FR-099\tcheck\t.github: x\tn", "0003-spec-kit FR-002\tnone\t-\t", "0003-spec-kit FR-003\tmaybe\t-\tn", "0003-spec-kit FR-004\tcheck\tno colon\tn");
  Deno.writeTextFileSync(f, rows.join("\n") + "\n");
  const out = k.findings();
  assertStringIncludes(out, "0003-spec-kit FR-001 has no row");
  assertStringIncludes(out, "FR-099 is not a requirement of any specification here");
  assertStringIncludes(out, "FR-002 has two rows");
  assertStringIncludes(out, "FR-003: the mechanism must be one of");
  assertStringIncludes(out, "FR-004: who enforces it is '<repository>: <command>'");
});

Deno.test("a none row must say why (0003-spec-kit FR-005)", () => {
  using k = Kit.make();
  const f = `${k.root}/enforcement.tsv`;
  Deno.writeTextFileSync(f, Deno.readTextFileSync(f).replace(/^0003-spec-kit FR-007\t.*$/m, "0003-spec-kit FR-007\tnone\t-\t"));
  assertStringIncludes(k.findings(), "a requirement nothing enforces has '-' for who and says why");
});

Deno.test("the tool imports nothing outside commons/tools, reads no ontology and runs no command (0003-spec-kit FR-006, FR-007)", () => {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = Deno.readTextFileSync(`${ROOT}/commons/tools/${file}`);
    for (const m of text.matchAll(/^(?:import|export)[^;]*? from "([^"]+)";/gm)) {
      const spec = m[1] ?? "";
      assert(/^\.\/[\w-]+\.ts$/.test(spec), `${file} imports ${spec}`);
      visit(spec.slice(2));
    }
    const code = text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    assert(!code.includes("ontology"), `${file} reads an ontology`);
    assert(!/Deno\.(Command|run)\b/.test(code), `${file} runs a command`);
  };
  visit("spec-kit-check.ts");
  assertEquals([...seen].sort(), ["core.ts", "spec-kit-check.ts"]);
});

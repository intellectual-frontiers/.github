/**
 * The shared specification checker (commons 0003-mizan): commons' own folder is clean, each rule is broken in a copy and named, and the command line is the one a
 * harness runs (`bun commons/tools/mizan-check.ts`, or the same on Node 26, in a `.github` checkout, reading both streams). Everything is real: the real tool, run as
 * a program, on real copies of commons' specification folder in a temporary folder.
 *
 * @module
 */
import { cpSync } from "node:fs";
import { fs, path, proc } from "../commons/system/src/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../commons/test/src/test.ts";
import { check, message } from "../commons/tools/mizan-check.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const copyTree = (from: string, to: string): void => cpSync(from, to, { recursive: true });

const TOOL = `${ROOT}/commons/tools/mizan-check.ts`;
const KIT = `${ROOT}/commons/spec-kit`;

class Kit {
  readonly root: string;
  readonly tmp: string;
  private constructor(tmp: string) {
    this.tmp = tmp;
    this.root = `${tmp}/kit`;
    copyTree(KIT, this.root);
  }
  static make(): Kit {
    return new Kit(fs.makeTempDirSync({ prefix: "commons-mizan-" }));
  }
  [Symbol.dispose](): void {
    fs.removeSync(this.tmp, { recursive: true });
  }
  findings(): string {
    return check(this.root)
      .map((f) => `${f.where}: ${message(f.problem)}`)
      .join("\n");
  }
  edit(rel: string, old: string, now: string): void {
    const f = `${this.root}/${rel}`;
    const text = fs.readTextFileSync(f);
    assertStringIncludes(text, old);
    fs.writeTextFileSync(
      f,
      text.replace(old, () => now),
    );
  }
}

/** The checker as a harness runs it, from the checkout's folder, on the runtime this test runs on. */
async function run(args: readonly string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  const o = await proc.run([proc.execPath(), TOOL, ...args], { cwd: ROOT });
  return { code: o.code, stdout: o.stdout, stderr: o.stderr };
}

proves(
  ["0003-mizan FR-006", "0003-mizan SC-001"],
  "commons' own folder is clean from the command line, with no configuration",
  async () => {
    const p = await run([]);
    assertEquals([p.code, p.stdout, p.stderr], [0, "", ""]);
    using bad = Kit.make();
    bad.edit("registry.tsv", "0003\tmizan", "0005\tmizan");
    const q = await run(["--root", bad.root]);
    assertEquals(q.code, 1);
    assertStringIncludes(q.stderr, "registry.tsv");
    assertEquals(q.stdout, "");
  },
);

proves(["0003-mizan FR-001"], "a gap, a repeated number and a missing folder in the register", () => {
  using k = Kit.make();
  // the register's next free number, and the one after it, which leaves a gap
  const next = fs.readTextFileSync(`${KIT}/registry.tsv`).trim().split("\n").length;
  const [gap, after] = [next, next + 1].map((n) => String(n).padStart(4, "0"));
  k.edit("registry.tsv", "0004\trules\tin force", `0004\trules\tin force\n0004\tother\tin force\n${after}\tnone\tin force`);
  const out = k.findings();
  assertStringIncludes(out, "assigned twice");
  assertStringIncludes(out, `gap at ${gap}`);
  assertStringIncludes(out, `${after}-none is in force but its specification does not exist`);
});

proves(["0003-mizan FR-001", "0003-mizan FR-006"], "a spec with no row, and a register that is missing", () => {
  using k = Kit.make();
  copyTree(`${k.root}/specs/0003-mizan`, `${k.root}/specs/0009-extra`);
  assertStringIncludes(k.findings(), "has no row in registry.tsv");
  fs.removeSync(`${k.root}/registry.tsv`);
  const out = k.findings();
  assertStringIncludes(out, "register of specification numbers is missing");
  assertStringIncludes(out, "specs/0009-extra: has no **Spec ID:** line naming 0009-extra", "it went on to check the specifications");
});

proves(["0003-mizan FR-002"], "the form of a specification", () => {
  using k = Kit.make();
  const s = "specs/0003-mizan/spec.md";
  k.edit(s, "**Spec ID:** 0003-mizan", "**Spec ID:** 0004-x");
  k.edit(s, "**Status:** Draft", "**Status:** Maybe");
  fs.writeTextFileSync(`${k.root}/${s}`, fs.readTextFileSync(`${k.root}/${s}`).replaceAll("## Assumptions", "## Zzz"));
  const out = k.findings();
  assertStringIncludes(out, "**Spec ID:** line naming 0003-mizan");
  assertStringIncludes(out, "**Status:** must be one of ['Draft', 'Active', 'Deferred', 'Adopted', 'Superseded']");
  assertStringIncludes(out, "has no ## Assumptions section");
});

proves(["0003-mizan FR-002"], "sections out of order", () => {
  using k = Kit.make();
  const s = `${k.root}/specs/0003-mizan/spec.md`;
  const [a, b] = ["## Key entities", "## Success criteria"];
  fs.writeTextFileSync(s, fs.readTextFileSync(s).replaceAll(a, "@@").replaceAll(b, a).replaceAll("@@", b));
  assertStringIncludes(k.findings(), "sections are out of the order");
});

proves(["0003-mizan FR-003"], "requirement numbers and edge cases", () => {
  using k = Kit.make();
  const s = "specs/0003-mizan/spec.md";
  k.edit(s, "the tool names the gap, per FR-001.", "the tool names the gap, per FR-099.");
  k.edit(s, "- A `none` row with no reason: the tool names it, per FR-005.", "- A `none` row with no reason: the tool names it.");
  const out = k.findings();
  assertStringIncludes(out, "cites a requirement that is not here");
  assertStringIncludes(out, "an edge case cites no requirement");
  k.edit(s, "- **FR-002**", "- **FR-001**");
  assertStringIncludes(k.findings(), "used twice");
});

proves(["0003-mizan FR-004"], "a bare citation of another repository's spec", () => {
  using k = Kit.make();
  k.edit("specs/0003-mizan/spec.md", "`archon 0024-spec-format` and `archon 0002-specs`.", "0136-machine-bootstrap of archon.");
  assertStringIncludes(k.findings(), "cites 0136-machine-bootstrap");
});

proves(["0003-mizan FR-008"], "a Part of line names another specification of the folder", () => {
  using k = Kit.make();
  assertEquals(k.findings(), "", "commons' own Part of lines name specifications it has");
  k.edit("specs/0009-sql-aide/spec.md", "**Part of:** 0005-typescript-runtime", "**Part of:** 0099-nothing");
  k.edit("specs/0010-file-aide/spec.md", "**Part of:** 0005-typescript-runtime", "**Part of:** 0010-file-aide");
  const out = k.findings();
  assertStringIncludes(out, "specs/0009-sql-aide: **Part of:** names 0099-nothing, which is not another specification of this folder");
  assertStringIncludes(out, "specs/0010-file-aide: **Part of:** names 0010-file-aide");
});

proves(["0003-mizan FR-005"], "the enforcement register", () => {
  using k = Kit.make();
  const f = `${k.root}/enforcement.tsv`;
  const rows = fs
    .readTextFileSync(f)
    .split("\n")
    .filter((r) => r !== "" && !r.startsWith("0003-mizan FR-001"));
  rows.push(
    "0003-mizan FR-099\tcheck\t.github: x\tn",
    "0003-mizan FR-002\tnone\t-\t",
    "0003-mizan FR-003\tmaybe\t-\tn",
    "0003-mizan FR-004\tcheck\tno colon\tn",
  );
  fs.writeTextFileSync(f, rows.join("\n") + "\n");
  const out = k.findings();
  assertStringIncludes(out, "0003-mizan FR-001 has no row");
  assertStringIncludes(out, "FR-099 is not a requirement of any specification here");
  assertStringIncludes(out, "FR-002 has two rows");
  assertStringIncludes(out, "FR-003: the mechanism must be one of");
  assertStringIncludes(out, "FR-004: who enforces it is '<repository>: <command>'");
});

proves(["0003-mizan FR-005"], "a none row must say why", () => {
  using k = Kit.make();
  const f = `${k.root}/enforcement.tsv`;
  fs.writeTextFileSync(f, fs.readTextFileSync(f).replace(/^0003-mizan FR-007\t.*$/m, "0003-mizan FR-007\tnone\t-\t"));
  assertStringIncludes(k.findings(), "a requirement nothing enforces has '-' for who and says why");
});

proves(
  ["0003-mizan FR-006", "0003-mizan FR-007"],
  "the tool imports nothing outside commons/tools but two built-ins of node:, reads no ontology and runs no command",
  () => {
    const seen = new Set<string>();
    const visit = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      const text = fs.readTextFileSync(`${ROOT}/commons/tools/${file}`);
      for (const m of text.matchAll(/^(?:import|export)[^;]*? from "([^"]+)";/gm)) {
        const spec = m[1] ?? "";
        if (spec === "node:fs" || spec === "node:process") continue;
        assert(/^\.\/[\w-]+\.ts$/.test(spec), `${file} imports ${spec}`);
        visit(spec.slice(2));
      }
      const code = text
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      assert(!code.includes("ontology"), `${file} reads an ontology`);
      assert(!/child_process|\b(spawn|spawnSync|execSync|execFileSync)\(/.test(code), `${file} runs a command`);
    };
    visit("mizan-check.ts");
    assertEquals([...seen].sort(), ["core.ts", "mizan-check.ts"]);
  },
);

proves(["0003-mizan FR-010"], "Active, Deferred and Adopted are accepted, and a word outside the list is named", () => {
  using k = Kit.make();
  const s = "specs/0003-mizan/spec.md";
  for (const word of ["Active", "Deferred", "Adopted", "Superseded"]) {
    k.edit(s, "**Status:** Draft", `**Status:** ${word}`);
    assertEquals(k.findings(), "");
    k.edit(s, `**Status:** ${word}`, "**Status:** Draft");
  }
  k.edit(s, "**Status:** Draft", "**Status:** Maybe");
  assertStringIncludes(k.findings(), "**Status:** must be one of");
});

proves(["0003-mizan FR-009"], "the former name of the tool runs the checker and gives the same findings and exit status", async () => {
  const old = `${ROOT}/commons/tools/spec-kit-check.ts`;
  const clean = await proc.run([proc.execPath(), old], { cwd: ROOT });
  assertEquals([clean.code, clean.stdout, clean.stderr], [0, "", ""]);
  using bad = Kit.make();
  bad.edit("registry.tsv", "0003\tmizan", "0005\tmizan");
  const now = await proc.run([proc.execPath(), TOOL, "--root", bad.root], { cwd: ROOT });
  const was = await proc.run([proc.execPath(), old, "--root", bad.root], { cwd: ROOT });
  assertEquals(now.code, 1);
  assertEquals([was.code, was.stdout, was.stderr], [now.code, now.stdout, now.stderr]);
});

proves(["0003-mizan FR-012"], "a specification in GitHub Spec Kit's form is accepted, and its missing section and status are named", () => {
  using k = Kit.make();
  // the next free number of the register, so that adding a specification never breaks this test
  const n = String(fs.readTextFileSync(`${k.root}/registry.tsv`).trim().split("\n").length).padStart(4, "0");
  const kit = [
    "# Feature Specification: Example",
    "",
    `**Feature Branch**: \`${n}-example\``,
    "**Status**: Draft",
    "",
    "## User Scenarios & Testing *(mandatory)*",
    "",
    "### Edge Cases",
    "",
    "- Something happens with no citation.",
    "",
    "## Requirements *(mandatory)*",
    "",
    "- **FR-001**: The example MUST exist.",
    "",
    "## Success Criteria *(mandatory)*",
    "",
    "- **SC-001**: It exists.",
    "",
  ].join("\n");
  fs.writeTextFileSync(`${k.root}/registry.tsv`, `${fs.readTextFileSync(`${k.root}/registry.tsv`).trimEnd()}\n${n}\texample\tin force\n`);
  fs.mkdirSync(`${k.root}/specs/${n}-example`, { recursive: true });
  fs.writeTextFileSync(`${k.root}/specs/${n}-example/spec.md`, kit);
  fs.writeTextFileSync(
    `${k.root}/enforcement.tsv`,
    `${fs.readTextFileSync(`${k.root}/enforcement.tsv`).trimEnd()}\n${n}-example FR-001\tnone\t-\tAn example in a test\n`,
  );
  assertEquals(k.findings(), "");
  k.edit(`specs/${n}-example/spec.md`, "## Success Criteria *(mandatory)*", "## Zzz");
  k.edit(`specs/${n}-example/spec.md`, "**Status**: Draft", "**Status**: Implemented");
  const out = k.findings();
  assertStringIncludes(out, "has no ## Success Criteria section");
  assertStringIncludes(out, "**Status:** must be one of");
});

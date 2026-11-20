/**
 * A harness's folder of specifications as the shared checker reads it (commons 0003-mizan FR-041, FR-042): spec numbers of three digits as well as four, and the registers (`registry.tsv`,
 * `enforcement.tsv`, the baseline) in a folder of the harness's choosing. Everything is real: the real tool, run as a program on the runtime this test runs on, on real folders in a
 * temporary folder; the checks of `check.ts` run through its `main` and read the files the test writes.
 *
 * @module
 */
import { main as mizanRules } from "../commons/libraries/src/check.ts";
import { fs, path, proc } from "../commons/system/src/mod.ts";
import { assertEquals, assertStringIncludes, proves } from "../commons/test/src/test.ts";
import { check, message } from "../commons/tools/mizan-check.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const TOOL = `${ROOT}/commons/tools/mizan-check.ts`;
const CHECK = `${ROOT}/commons/libraries/src/check.ts`;

/** The text of a specification in the commons form, named `name`, with one requirement. */
function spec(name: string, extra = ""): string {
  return `# Feature Specification: A harness's own

**Spec ID:** ${name}
**Status:** Active
**Owner:** harness
**Domain:** harness

**Input:** One requirement.

## Edge cases

- Nothing happens, per FR-001.

## Assumptions

- None.

## Open questions

- None.

## Key entities

- **Thing** - a thing.

## Success criteria

- **SC-001**: It works.

## Review & acceptance checklist

- [x] Every requirement is testable
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided

- **FR-001**: The system MUST work.
${extra}`;
}

/** A folder of three-digit specifications: `specs/` in `<tmp>/kit`, its registers in `<tmp>/kit/<registers>`. */
function harness(tmp: string, registers: string): { readonly kit: string; readonly registers: string } {
  const kit = `${tmp}/kit`;
  const where = registers === "" ? kit : `${kit}/${registers}`;
  fs.mkdirSync(`${kit}/specs/001-first`, { recursive: true });
  fs.mkdirSync(`${kit}/specs/002-second`, { recursive: true });
  fs.mkdirSync(where, { recursive: true });
  fs.writeTextFileSync(`${kit}/specs/001-first/spec.md`, spec("001-first"));
  fs.writeTextFileSync(`${kit}/specs/002-second/spec.md`, spec("002-second", "\nIt names 001-first, a specification of this folder.\n"));
  fs.writeTextFileSync(`${where}/registry.tsv`, "number\tslug\tstate\n001\tfirst\tin force\n002\tsecond\tin force\n");
  fs.writeTextFileSync(
    `${where}/enforcement.tsv`,
    "requirement\tmechanism\tby\tnote\n001-first FR-001\tcheck\tharness: bun test\tone test\n002-second FR-001\tcheck\tharness: bun test\tone test\n",
  );
  return { kit, registers: where };
}

const findings = (root: string, register?: string): string =>
  check(root, register === undefined ? {} : { register })
    .map((f) => `${f.where}: ${message(f.problem)}`)
    .join("\n");

proves(
  ["0003-mizan FR-041"],
  "a folder that numbers its specifications with three digits is clean, and a gap, a bad number and a bare citation are named with its width",
  () => {
    const tmp = fs.makeTempDirSync({ prefix: "mizan-three-" });
    try {
      const h = harness(tmp, "");
      assertEquals(findings(h.kit), "");
      // a gap is told with three digits
      fs.writeTextFileSync(`${h.registers}/registry.tsv`, "number\tslug\tstate\n001\tfirst\tin force\n003\tsecond\tin force\n");
      assertStringIncludes(findings(h.kit), "gap at 002");
      // a number of two digits, and one of five, are not a number of a register
      fs.writeTextFileSync(`${h.registers}/registry.tsv`, "number\tslug\tstate\n01\tfirst\tin force\n00002\tsecond\tin force\n");
      assertStringIncludes(findings(h.kit), "a number of three or four digits");
      // a bare citation of a missing specification, written with three digits, is found in a three-digit folder
      fs.writeTextFileSync(`${h.registers}/registry.tsv`, "number\tslug\tstate\n001\tfirst\tin force\n002\tsecond\tin force\n");
      fs.writeTextFileSync(`${h.kit}/specs/002-second/spec.md`, spec("002-second", "\nIt names (009-missing) and archon 005-other.\n"));
      const out = findings(h.kit);
      assertStringIncludes(out, "cites 009-missing, which is not a specification here");
      assertEquals(out.includes("005-other"), false, "another repository's, named by its repository, is not read");
    } finally {
      fs.removeSync(tmp, { recursive: true });
    }
  },
);

proves(["0003-mizan FR-041"], "a folder of four digits still reads four, and names a spec folder that is neither", () => {
  const root = fs.makeTempDirSync({ prefix: "mizan-four-" });
  try {
    fs.mkdirSync(`${root}/specs/0001-first`, { recursive: true });
    fs.mkdirSync(`${root}/specs/12-short`, { recursive: true });
    fs.writeTextFileSync(`${root}/specs/0001-first/spec.md`, spec("0001-first"));
    fs.writeTextFileSync(`${root}/registry.tsv`, "number\tslug\tstate\n0001\tfirst\tin force\n");
    fs.writeTextFileSync(`${root}/enforcement.tsv`, "requirement\tmechanism\tby\tnote\n0001-first FR-001\tcheck\tharness: bun test\tone\n");
    const out = findings(root);
    assertStringIncludes(out, "specs/12-short: a spec folder is named NNN-slug or NNNN-slug");
    assertEquals(out.split("\n").length, 1, "the one folder that is neither is the only finding");
  } finally {
    fs.removeSync(root, { recursive: true });
  }
});

proves(
  ["0003-mizan FR-042"],
  "the registers are read from the folder the harness names, by the library and by the command line",
  async () => {
    const tmp = fs.makeTempDirSync({ prefix: "mizan-register-" });
    try {
      const h = harness(tmp, "tools/spec-register");
      // beside the specifications there are no registers: the default finds them missing; the named folder finds them
      assertStringIncludes(findings(h.kit), "the register of specification numbers is missing");
      assertEquals(findings(h.kit, h.registers), "");
      const ok = await proc.run([proc.execPath(), TOOL, "--root", h.kit, "--register", h.registers], { cwd: ROOT });
      assertEquals([ok.code, ok.stderr], [0, ""]);
      const bad = await proc.run([proc.execPath(), TOOL, "--root", h.kit, "--register"], { cwd: ROOT });
      assertEquals(bad.code, 1);
      assertStringIncludes(bad.stderr, "--register needs a folder");
      // the rules Mizan adds hold their baseline beside the registers, and a stale line in it is found there
      fs.writeTextFileSync(`${h.registers}/mizan.baseline.txt`, "# held\nmizan/requirement-keyword specs/001-first/spec.md FR-009\n");
      const stale = await proc.run([proc.execPath(), CHECK, "--root", h.kit, "--register", h.registers], { cwd: ROOT });
      assertEquals(stale.code, 1);
      assertStringIncludes(
        stale.stderr,
        `${h.registers}/mizan.baseline.txt: stale: "mizan/requirement-keyword specs/001-first/spec.md FR-009"`,
      );
      fs.writeTextFileSync(`${h.registers}/mizan.baseline.txt`, "# held\n");
      assertEquals(
        mizanRules(["--root", h.kit, "--register", h.registers, "--today", "2026-11-18"]),
        0,
        "the baseline beside the registers holds nothing, and nothing is found",
      );
    } finally {
      fs.removeSync(tmp, { recursive: true });
    }
  },
);

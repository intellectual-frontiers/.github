/**
 * The plain layout of Spec Kit (commons 0011-documentation FR-015, FR-024): a specification's title, status and input, its requirements
 * in both forms and over more than one line, the reasons of its `reviewed.tsv`, the constitution's page, and a specification two kits both
 * hold.
 *
 * @module
 */
import { path } from "@intellectual-frontiers/ifc-ts/runtime";
import { assert, assertEquals, proves } from "@intellectual-frontiers/ifc-ts/runtime/test";
import { Build } from "../build.ts";
import type { Finding } from "../check.ts";
import { parsePlainSpec, parseReviewed, readPlainKit, readSpecKits } from "../extract/specs.ts";
import { CONSTITUTION_PAGE, specPages } from "../pages/specs.ts";
import { resolved, ROOT } from "./helpers.ts";

const FIXTURE = path.join(ROOT, "commons/docs/suite/fixture-repo");

proves(["0011-documentation FR-024"], "a plain specification: its title, status, input, and requirements in both forms, on one line or more", () => {
  const s = parsePlainSpec(
    "001-x",
    "# Feature Specification: X\n\n**Feature Branch**: `001-x` **Created**: 2026-11-10 **Status**:\nImplemented **Input**: Why it is,\nin two lines.\n\n## Requirements\n\n- **FR-001** One.\n- **FR-002**: Two,\n  on two lines.\n- **FR-002a** Inserted.\n",
  );
  assertEquals([s.title, s.status, s.input, s.layout], ["X", "Implemented", "Why it is, in two lines.", "spec-kit"]);
  assertEquals(s.requirements, [{ id: "FR-001", text: "One." }, { id: "FR-002", text: "Two, on two lines." }, { id: "FR-002a", text: "Inserted." }]);
  assert(!s.body.includes("Feature Branch"), "the header is not the body");
  const t = parsePlainSpec("096-y", "# 096: The engine on Bun\n\nIssue 32.\n\n## Requirements\n\n- **FR-001** One.\n");
  assertEquals([t.title, t.status, t.input, t.body.startsWith("Issue 32.")], ["The engine on Bun", "", "", true]);
});

proves(["0011-documentation FR-024"], "reviewed.tsv: a requirement and its reason, bare or with its specification; comments are skipped", () => {
  const rows = parseReviewed("096-y", "# a comment\nFR-003\tCI runs it.\n096-y FR-004\tA reviewer reads it.\n001-x FR-001\tanother spec's\n");
  assertEquals([...rows.keys()], ["096-y FR-003", "096-y FR-004"]);
  assertEquals(rows.get("096-y FR-003"), { requirement: "096-y FR-003", mechanism: "review", by: "-", note: "CI runs it." });
});

proves(["0011-documentation FR-015", "0011-documentation FR-024"], "the fixture's kit: its specifications in order, their reviews, the constitution, and their pages", () => {
  const kit = readPlainKit(FIXTURE, "specs", ".specify/memory/constitution.md");
  assertEquals(kit.specs.map((s) => [s.id, s.file, s.title]), [["001-greeting", "specs/001-greeting/spec.md", "Greeting"], ["002-farewell", "specs/002-farewell/spec.md", "Farewell"]]);
  assertEquals([...kit.enforcement.keys()], ["001-greeting FR-002"]);
  assertEquals(kit.constitution?.title, "Fixture Constitution");
  const config = resolved({ name: "F", repository: "https://github.com/example/f", home: { dir: "." }, packages: [], specKits: [{ layout: "spec-kit", dir: "specs" }], citations: { prefix: "f", digits: 3 } }, path.join(FIXTURE, "x.ts"));
  const b = new Build(config, readSpecKits(FIXTURE, config.specKits));
  specPages(b);
  assertEquals(b.pages.map((p) => p.path), ["specs/index.html", "specs/matrix.html", CONSTITUTION_PAGE, "specs/001-greeting.html", "specs/002-farewell.html"]);
  const greeting = b.pages.find((p) => p.path === "specs/001-greeting.html");
  assertEquals(greeting?.badges?.map((x) => x.text), ["001", "Implemented"]);
  const entries = (greeting?.blocks ?? []).flatMap((x) => (x.kind === "entry" ? [[x.name, x.badges.map((y) => y.text).join(",")]] : []));
  assertEquals(entries, [["FR-001", ""], ["FR-002", "review"], ["SC-001", "success criterion"]]);
  assert(JSON.stringify(greeting?.blocks).includes("A reviewer reads the one template of the line."));
  assert(b.files.get(".specify/memory/constitution.md") === CONSTITUTION_PAGE);
});

proves(["0011-documentation FR-018", "0011-documentation FR-024"], "a specification two kits both hold is a finding, and the first is kept", () => {
  const found: Finding[] = [];
  const kit = readSpecKits(FIXTURE, [{ layout: "spec-kit", dir: "specs", constitution: undefined }, { layout: "spec-kit", dir: "specs", constitution: undefined }], found);
  assertEquals(kit.specs.length, 2);
  assertEquals(found.map((f) => [f.where, f.problem.kind]), [["specs/001-greeting/spec.md", "duplicate-spec"], ["specs/002-farewell/spec.md", "duplicate-spec"]]);
});

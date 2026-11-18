/** @module The Phase 0 spike: package-name imports resolve on Bun, Node and tsc. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { engineName } from "@intellectual-frontiers/data/engine";
import { physicalSees } from "@intellectual-frontiers/data/sql/physical";
import { extension } from "../extensions/probe/mod.ts";

test("the layers import each other by package name", () => {
  assert.equal(physicalSees, "physical <- governance.vocabulary");
  assert.deepEqual(extension.contributes, ["governance.vocabulary"]);
});

test("the kernel is reached by package name", () => {
  const r = engineName();
  assert.equal(r.kind, "ok");
});

test("a file the package does not export cannot be imported by package name", () => {
  const code = 'import("@intellectual-frontiers/data/engine/internal").then(() => process.exit(0), () => process.exit(7))';
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: import.meta.dirname });
  assert.equal(r.status, 7);
});

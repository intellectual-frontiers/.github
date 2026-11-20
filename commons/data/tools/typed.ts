// Spec: 0053-sql-typed FR-008
/**
 * Writes the typed tables of each model into `sql/typed/models/` (commons data 0053-sql-typed), or checks that they are what the models say.
 *
 *   bun tools/typed.ts --write    write them
 *   bun tools/typed.ts            check them: exit 1 where a file is missing, stale or stray
 *
 * @module
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeModules } from "../governance/api.ts";
import { allModules } from "../sql/cli/mod.ts";
import { projectDomain } from "../sql/logical/api.ts";
import { typedFiles } from "../sql/typed/generate.ts";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "sql", "typed", "models");

/** The files the models make, by name. */
export function expected(): ReadonlyMap<string, string> {
  const modules = allModules();
  const domain = composeModules("arca", { definition: "The arca data models" }, modules);
  if (domain.kind === "err") throw new Error(`the models do not compose: ${JSON.stringify(domain.error).slice(0, 300)}`);
  const projected = projectDomain(domain.value);
  if (projected.kind === "err") throw new Error(`the models do not project: ${JSON.stringify(projected.error).slice(0, 300)}`);
  const files = typedFiles(projected.value.schema, { modules });
  if (files.kind === "err") throw new Error(`the typed tables cannot be made: ${JSON.stringify(files.error)}`);
  return new Map(files.value.map((f) => [f.path, f.text]));
}

if (import.meta.main) {
  const want = expected();
  const have = new Map(existsSync(DIR) ? readdirSync(DIR).map((f) => [f, readFileSync(join(DIR, f), "utf8")] as const) : []);
  if (process.argv.includes("--write")) {
    mkdirSync(DIR, { recursive: true });
    for (const [f, text] of want) writeFileSync(join(DIR, f), text);
    for (const f of have.keys()) if (!want.has(f)) rmSync(join(DIR, f));
    console.log(`typed: wrote ${want.size} files`);
  } else {
    const bad = [...want].filter(([f, t]) => have.get(f) !== t).map(([f]) => `${f}: ${have.has(f) ? "stale" : "missing"}`);
    for (const f of have.keys()) if (!want.has(f)) bad.push(`${f}: stray`);
    for (const b of bad) console.log(`typed: ${b}`);
    console.log(bad.length === 0 ? "typed: up to date" : "typed: run `bun tools/typed.ts --write`");
    process.exit(bad.length === 0 ? 0 : 1);
  }
}

// Spec: 0001-arcactl-pg-kit FR-001, FR-006, FR-007
/**
 * The README and the findings of the UAT kit (commons data 0001-arcactl-pg-kit FR-001, FR-006, FR-007): the files the kit is made of, a secret that is never committed, a folder that is never packed, and a README whose every step has
 * its command and whose every script, file and `arcactl` command exists, so that a junior reader is not sent to what is not there.
 *
 * @module
 */
import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, proves } from "@intellectual-frontiers/test";
import { USAGE } from "@intellectual-frontiers/data/sql/cli";
import { scenarios } from "../scenarios/scenarios.ts";

const KIT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(KIT, "..", "..");
const read = (p: string): string => readFileSync(join(KIT, p), "utf8");

proves(["0001-arcactl-pg-kit FR-001"], "the kit has its files, keeps its secrets out of git, is not packed, and names PostgreSQL as the person's", () => {
  for (const f of ["README.md", "FINDINGS.md", "models/crm.ts", "sql/roles.sql", "sql/reset.sql", "scenarios/scenarios.ts", "scenarios/run.ts", "dbeaver/scopes.sql", "seed/tenants.sql", "seed/acme.sql", "seed/initech.sql", "seed/globex.sql", "seed/northwind.sql", "bin/env"])
    assert(existsSync(join(KIT, f)), `${f} is in the kit`);
  for (const f of ["roles", "schema", "seed", "rls-check", "psql-as", "reset", "rls-check.ts"]) {
    accessSync(join(KIT, "bin", f), constants.X_OK);
    assert(true);
  }
  assert(read(".gitignore").split("\n").includes(".env.uat"), "the secrets file is not committed");
  const lib = readFileSync(join(DATA, "library.ts"), "utf8");
  const pkg = readFileSync(join(DATA, "package.json"), "utf8");
  assert(!/acceptance/.test(lib) && !/"\.\/acceptance|acceptance\/\*\*/.test(pkg), "no export of the library is in the kit");
  const readme = read("README.md");
  assert(/does \*\*not\*\* start a database/.test(readme) && /arcactl(\.ts)? init/.test(readme) && readme.includes("doctor --scope workstation"), "it teaches finding the PostgreSQL and setting up the workstation");
  assert(!/docker|podman|compose/i.test(readme.replace(/<https?:[^>]*>/g, "")), "and uses no container");
  for (const script of ["bin/env", "bin/roles", "bin/schema", "bin/seed", "bin/psql-as", "bin/reset"]) assert(!/docker|podman/i.test(read(script)), `${script} starts no container`);
});

proves(["0001-arcactl-pg-kit FR-006"], "the README walks through every step with its command, and every script, file and arcactl command it names exists", () => {
  const readme = read("README.md");
  const steps = [...readme.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
  assert(JSON.stringify(steps) === JSON.stringify(Array.from({ length: 17 }, (_, i) => i)), `steps 0 to 16 in order, got ${steps.join(",")}`);
  // every section with a step has a command in a fenced block
  const sections = readme.split(/^## /m).slice(1).filter((s) => /^\d+\. /.test(s) && !s.startsWith("0."));
  for (const s of sections) assert(/```(bash|sql|ts)\n/.test(s), `step ${s.split(".")[0]} has a command`);
  // every script it names
  const scripts = new Set([...readme.matchAll(/acceptance\/arcactl-pg\/bin\/([a-z.-]+)/g)].map((m) => m[1] ?? ""));
  for (const s of scripts) assert(existsSync(join(KIT, "bin", s)), `bin/${s} exists`);
  // every file it links
  for (const m of readme.matchAll(/\]\((?!https?:)([^)#]+)\)/g)) assert(existsSync(join(KIT, m[1] ?? "")), `${m[1]} exists`);
  // every arcactl command and flag it runs is one the usage gives
  const commands = ["doctor", "shell", "sql", "lint", "generate", "list", "init", "scope"];
  const flags = new Set(["--help", "--module", "--schema", "--access", "--protect", "--seal", "--reach", "--wildcard", "--scope", "--discover", "--dry-run", "--undo", "--tenant", "--subtree", "--all", "--local", "--json", "--password-stdin", "--instance", "--host", "--port", "--database", "--user", "--yes", "--interactive", "--name", "--prefix"]);
  for (const m of readme.matchAll(/arcactl(?:\.ts)? ([a-z-]+)([^\n|]*)/g)) {
    const [, command = "", rest = ""] = m;
    if (!/^[a-z]/.test(command) || ["makes", "can", "does", "and", "prints", "in", "is", "or", "that", "never", "help", "asks", "with", "for", "when", "runs", "calls", "to", "describe", "doctor,", "scope`"].includes(command)) continue;
    assert(commands.includes(command) || command.startsWith("--"), `arcactl ${command} is a command`);
    for (const f of rest.matchAll(/(--[a-z-]+)/g)) assert(flags.has(f[1] ?? "") || USAGE.includes(f[1] ?? ""), `${f[1]} is a flag of arcactl`);
  }
  for (const c of ["sql", "doctor", "scope", "lint", "list", "generate", "init"]) assert(new RegExp(`arcactl(\\.ts)? ${c}`).test(readme), `arcactl ${c} is shown`);
  // the scenarios it counts
  assert(readme.includes(`${scenarios.length} scenarios`) && readme.includes(`${scenarios.length - 1} passed, 1 known gap`) || readme.includes(`${scenarios.length - 1} passed, 1 known gap, 0 failed`), "it counts the scenarios as they are");
  for (const id of ["S10", "S12", "S25"]) assert(scenarios.some((s) => s.id === id) && readme.includes(id), `${id} is a scenario and is named`);
  // what it promises of the schema
  assert(readme.includes("customer_account_tenant_all") && readme.includes("DBeaver") && readme.includes("Bootstrap queries") && readme.includes("RESET app.tenant"), "DBeaver, click by click, with how to set and clear a scope");
});

proves(["0001-arcactl-pg-kit FR-007"], "the findings template holds the findings the kit already knows, each with where it is shown, and what the kit's first run fixed", () => {
  const f = read("FINDINGS.md");
  for (const k of ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"]) assert(new RegExp(`\\| ${k} \\|`).test(f), `${k} is recorded`);
  assert(f.includes("scenario S25") && f.includes("tenantId") && f.includes("autocommit") && f.includes("hold the seal's key"), "the four that the spec names");
  for (const needed of ["**Step:**", "**Weight:**", "**I did:**", "**I expected:**", "**What happened:**"]) assert(f.includes(needed), `the template has ${needed}`);
  assert(f.includes("## Your findings"), "and a place for the tester's");
});

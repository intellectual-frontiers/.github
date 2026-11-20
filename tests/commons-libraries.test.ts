/**
 * Commons libraries (commons 0027-commons-libraries): every top-level folder of commons that has a spec kit of its own is an independent library, and this repository
 * knows it as one requirement proved by its own `verify`. The findings are made by `libraryFindings` over a repository's files; the real tree must have none, and each rule
 * is broken in a copy of the real files, in a temporary folder, and named. The specification checker is the real tool, run as a program (`--root` its spec kit).
 *
 * A library declares itself with a manifest, `library.ts` (0027-commons-libraries FR-012): the check of a manifest against its folder and the generator of the section "The libraries" are
 * `commons/libraries/src/libraries.ts`. `libraryFindings` is a function of this test for now: it moves to commons' tools when a second library needs it.
 *
 * @module
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fs, path, proc } from "../commons/system/src/mod.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../commons/test/src/test.ts";
import { check, message } from "../commons/tools/mizan-check.ts";
import { manifestFindings, synchronize } from "../commons/libraries/src/libraries.ts";
import { synchronize as readmeSync } from "../commons/libraries/src/readme.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const SPEC = "0027-commons-libraries";
const PARTS = ["registry.tsv", "enforcement.tsv", "mizan.baseline.txt", "specs"] as const;
const VERIFY_PARTS = ["tsc", "mizan-check.ts --root spec-kit", "libraries/src/check.ts --root spec-kit", "test"] as const;
const TRACE_PART = "tools/check.ts";

const read = (file: string): string => readFileSync(file, "utf8");
const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory();

/** The folders `commons/<name>/` that hold a `spec-kit/` of their own. */
function librariesOf(repo: string): readonly string[] {
  const commons = `${repo}/commons`;
  return readdirSync(commons)
    .filter((n) => isDir(`${commons}/${n}/spec-kit`))
    .sort();
}

/** The `.ts` files under a folder, leaving out `node_modules`. */
function tsFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === "node_modules") continue;
    const p = `${dir}/${n}`;
    if (isDir(p)) out.push(...tsFiles(p));
    else if (n.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Whether a folder is a metapackage (commons 0036-distribution FR-005): a library whose manifest names `bundle` and which has no spec kit of its own. */
function isMetapackage(repo: string, name: string): boolean {
  const manifest = `${repo}/commons/${name}/library.ts`;
  return existsSync(manifest) && /\bbundle:\s*"/.test(read(manifest)) && !isDir(`${repo}/commons/${name}/spec-kit`);
}

/** The libraries this specification names: every `commons/<name>` of a requirement of its section "The libraries". */
function namedLibraries(spec: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const section = spec.split("\n## ").find((s) => s.startsWith("The libraries")) ?? "";
  for (const line of section.split("\n")) {
    const fr = /^- \*\*(FR-\d+)\*\*/.exec(line);
    const lib = /`commons\/([a-z][a-z0-9-]*)`/.exec(line);
    if (fr?.[1] !== undefined && lib?.[1] !== undefined) out.set(lib[1], fr[1]);
  }
  return out;
}

/** What is wrong with the libraries of a repository, one sentence each. */
export function libraryFindings(repo: string): readonly string[] {
  const found: string[] = [];
  const spec = read(`${repo}/commons/spec-kit/specs/${SPEC}/spec.md`);
  const named = namedLibraries(spec);
  const enforcement = read(`${repo}/commons/spec-kit/enforcement.tsv`).split("\n");
  const parentSlugs = new Set(
    read(`${repo}/commons/spec-kit/registry.tsv`)
      .split("\n")
      .slice(1)
      .map((l) => l.split("\t")[1])
      .filter((s): s is string => s !== undefined && s !== ""),
  );
  const docs = read(`${repo}/commons/docs.config.ts`);
  const libraries = librariesOf(repo);
  for (const f of manifestFindings(repo)) found.push(f);
  for (const stale of synchronize(repo, false).stale) found.push(`${stale} is not what the manifests make (FR-011)`);
  for (const name of named.keys())
    if (!libraries.includes(name) && !isMetapackage(repo, name))
      found.push(`${SPEC} names commons/${name}, which has no spec-kit/ (FR-008)`);
  for (const name of libraries) {
    const dir = `${repo}/commons/${name}`;
    const fr = named.get(name);
    if (fr === undefined) found.push(`commons/${name} has a spec kit and no requirement of ${SPEC} names it (FR-007, FR-008)`);
    else {
      const row = enforcement.find((l) => l.startsWith(`${SPEC} ${fr}\t`));
      if (row === undefined || row.split("\t")[1] !== "check" || row.split("\t")[2] !== `.github: cd commons/${name} && bun run verify`) {
        found.push(`${SPEC} ${fr} is not a check row that runs the verify of commons/${name} (FR-007)`);
      }
    }
    for (const part of PARTS)
      if (!existsSync(`${dir}/spec-kit/${part}`)) found.push(`commons/${name}/spec-kit/${part} is missing (FR-001)`);
    for (const file of ["package.json", "about.ts"])
      if (!existsSync(`${dir}/${file}`)) found.push(`commons/${name}/${file} is missing (FR-001)`);
    if (existsSync(`${dir}/package.json`)) {
      const pkg = JSON.parse(read(`${dir}/package.json`)) as { name?: string; scripts?: Record<string, string> };
      if (pkg.name !== `@intellectual-frontiers/${name}`)
        found.push(`commons/${name}/package.json is not named @intellectual-frontiers/${name} (FR-001)`);
      const verify = pkg.scripts?.["verify"];
      if (verify === undefined) found.push(`commons/${name}/package.json has no verify script (FR-001)`);
      else for (const part of VERIFY_PARTS) if (!verify.includes(part)) found.push(`commons/${name}'s verify lacks ${part} (FR-005)`);
      if (verify !== undefined && !verify.includes(TRACE_PART)) found.push(`commons/${name}'s verify lacks ${TRACE_PART} (FR-006)`);
    }
    if (existsSync(`${dir}/spec-kit/registry.tsv`)) {
      const slugs = read(`${dir}/spec-kit/registry.tsv`)
        .split("\n")
        .slice(1)
        .filter((l) => l !== "")
        .map((l) => l.split("\t"));
      for (const [number, slug] of slugs) {
        if (slug !== undefined && parentSlugs.has(slug))
          found.push(`the registry of commons lists ${slug}, a specification of commons/${name} (FR-002)`);
        if (number !== undefined && !/^\d{4}$/.test(number)) found.push(`commons/${name}'s registry has the number ${number} (FR-002)`);
      }
      const first = slugs[0]?.[0];
      if (first !== undefined && first !== "0001") found.push(`commons/${name}'s registry starts at ${first}, not 0001 (FR-002)`);
    }
    for (const file of tsFiles(dir)) {
      for (const m of read(file).matchAll(/(?:from|import)\s*\(?\s*"(\.{1,2}\/[^"]*)"/g)) {
        const target = path.resolve(path.dirname(file), m[1] ?? "");
        if (target !== dir && !target.startsWith(`${dir}/`))
          found.push(`${path.relative(repo, file)} imports ${m[1]}, outside commons/${name} (FR-004)`);
      }
    }
    if (docs.split(`dir: "commons/${name}/spec-kit"`).length !== 2)
      found.push(`commons/docs.config.ts does not name commons/${name}/spec-kit exactly once (FR-009)`);
    if (existsSync(`${dir}/spec-kit/registry.tsv`)) {
      for (const f of check(`${dir}/spec-kit`)) found.push(`commons/${name}/spec-kit: ${f.where}: ${message(f.problem)} (FR-008)`);
    }
  }
  // the libraries are proved by one workflow that plans which a change affects and runs the verify of each (FR-010)
  const ci = `${repo}/.github/workflows/ci.auto.yml`;
  if (!existsSync(ci)) found.push(".github/workflows/ci.auto.yml is missing (FR-010)");
  else {
    const w = read(ci);
    if (!w.includes("commons/libraries/src/plan.ts"))
      found.push(".github/workflows/ci.auto.yml does not plan the libraries a change affects (FR-010)");
    if (!w.includes("run: ${{ matrix.verify }}")) found.push(".github/workflows/ci.auto.yml does not run verify (FR-010)");
    if (!w.includes('- "commons/**"')) found.push(".github/workflows/ci.auto.yml is not triggered by commons/** (FR-010)");
  }
  for (const name of librariesOf(repo)) {
    if (existsSync(`${repo}/.github/workflows/${name}.auto.yml`))
      found.push(`.github/workflows/${name}.auto.yml is a workflow of a library of its own, which ci replaces (FR-010)`);
  }
  return found;
}

/** A copy of what the rule reads, in a temporary folder: commons' spec kit, the libraries, the documentation's configuration and the workflows. */
function copyOf(): { readonly repo: string; readonly [Symbol.dispose]: () => void } {
  const repo = fs.makeTempDirSync({ prefix: "commons-libraries-" });
  const skip = (src: string): boolean => !src.split("/").some((part) => part === "node_modules" || part === "dist");
  cpSync(`${ROOT}/commons/spec-kit`, `${repo}/commons/spec-kit`, { recursive: true });
  for (const name of librariesOf(ROOT)) cpSync(`${ROOT}/commons/${name}`, `${repo}/commons/${name}`, { recursive: true, filter: skip });
  for (const name of readdirSync(`${ROOT}/commons`).filter((n) => isMetapackage(ROOT, n)))
    cpSync(`${ROOT}/commons/${name}`, `${repo}/commons/${name}`, { recursive: true, filter: skip });
  cpSync(`${ROOT}/commons/docs.config.ts`, `${repo}/commons/docs.config.ts`);
  cpSync(`${ROOT}/.github/workflows`, `${repo}/.github/workflows`, { recursive: true });
  return { repo, [Symbol.dispose]: () => fs.removeSync(repo, { recursive: true }) };
}

const edit = (file: string, old: string, now: string): void => {
  const text = read(file);
  assert(text.includes(old), `${file} has no ${old}`);
  writeFileSync(file, text.replace(old, now));
};

proves(
  [`${SPEC} FR-001`, `${SPEC} FR-007`, `${SPEC} FR-008`],
  "this repository's libraries have no finding, and commons/data is one",
  () => {
    assertEquals(libraryFindings(ROOT), []);
    assert(librariesOf(ROOT).includes("data"));
    assertEquals(namedLibraries(read(`${ROOT}/commons/spec-kit/specs/${SPEC}/spec.md`)).get("data"), "FR-101");
  },
);

proves([`${SPEC} FR-008`], "a folder with a spec kit that no requirement names is found, with the parts it lacks", () => {
  using c = copyOf();
  fs.mkdirSync(`${c.repo}/commons/extra/spec-kit`, { recursive: true });
  const text = libraryFindings(c.repo).join("\n");
  assertStringIncludes(text, "commons/extra has a spec kit and no requirement");
  assertStringIncludes(text, "commons/extra/spec-kit/registry.tsv is missing");
});

proves([`${SPEC} FR-008`], "a requirement that names a folder with no spec kit is found", () => {
  using c = copyOf();
  edit(
    `${c.repo}/commons/spec-kit/specs/${SPEC}/spec.md`,
    "\n<!-- libraries:end -->\n",
    "\n- **FR-102**: `commons/nope` MUST be a library.\n\n<!-- libraries:end -->\n",
  );
  const text = libraryFindings(c.repo).join("\n");
  assertStringIncludes(text, "names commons/nope, which has no spec-kit/");
  assertStringIncludes(text, "is not what the manifests make (FR-011)");
});

proves([`${SPEC} FR-001`], "a library without an about.ts, or with another package name, is found", () => {
  using c = copyOf();
  fs.removeSync(`${c.repo}/commons/data/about.ts`);
  edit(`${c.repo}/commons/data/package.json`, '"@intellectual-frontiers/data"', '"data"');
  const text = libraryFindings(c.repo).join("\n");
  assertStringIncludes(text, "commons/data/about.ts is missing");
  assertStringIncludes(text, "is not named @intellectual-frontiers/data");
});

proves(
  [`${SPEC} FR-002`],
  "a specification of a library listed in commons' registry, or a registry that does not start at 0001, is found",
  () => {
    using c = copyOf();
    fs.mkdirSync(`${c.repo}/commons/data/spec-kit/specs/0002-layers`, { recursive: true });
    writeFileSync(`${c.repo}/commons/data/spec-kit/registry.tsv`, "number\tslug\tstate\n0002\tlayers\tin force\n");
    writeFileSync(`${c.repo}/commons/spec-kit/registry.tsv`, `${read(`${c.repo}/commons/spec-kit/registry.tsv`)}0030\tlayers\tin force\n`);
    const text = libraryFindings(c.repo).join("\n");
    assertStringIncludes(text, "the registry of commons lists layers, a specification of commons/data");
    assertStringIncludes(text, "starts at 0002, not 0001");
  },
);

proves([`${SPEC} FR-004`], "a library file that imports by a relative path outside its folder is found, and one inside is not", () => {
  using c = copyOf();
  writeFileSync(`${c.repo}/commons/data/engine/inside.ts`, 'import "./api.ts";\nimport "../governance/api.ts";\n');
  assertEquals(libraryFindings(c.repo), []);
  writeFileSync(`${c.repo}/commons/data/engine/outside.ts`, 'import "../../core/src/mod.ts";\n');
  assertStringIncludes(
    libraryFindings(c.repo).join("\n"),
    "commons/data/engine/outside.ts imports ../../core/src/mod.ts, outside commons/data",
  );
});

proves([`${SPEC} FR-005`], "a verify that leaves out the compiler, a checker or the tests is found", () => {
  for (const part of VERIFY_PARTS) {
    using c = copyOf();
    const pkg = JSON.parse(read(`${c.repo}/commons/data/package.json`)) as { scripts: Record<string, string> };
    pkg.scripts["verify"] = (pkg.scripts["verify"] ?? "")
      .split(" && ")
      .filter((s) => !s.includes(part))
      .join(" && ");
    writeFileSync(`${c.repo}/commons/data/package.json`, JSON.stringify(pkg));
    assertStringIncludes(libraryFindings(c.repo).join("\n"), `verify lacks ${part}`);
  }
});

proves([`${SPEC} FR-006`], "a verify that does not run the trace and layers check is found", () => {
  using c = copyOf();
  const pkg = JSON.parse(read(`${c.repo}/commons/data/package.json`)) as { scripts: Record<string, string> };
  pkg.scripts["verify"] = (pkg.scripts["verify"] ?? "")
    .split(" && ")
    .filter((s) => !s.includes(TRACE_PART))
    .join(" && ");
  writeFileSync(`${c.repo}/commons/data/package.json`, JSON.stringify(pkg));
  assertStringIncludes(libraryFindings(c.repo).join("\n"), `verify lacks ${TRACE_PART}`);
});

proves([`${SPEC} FR-007`], "a requirement for a library whose enforcement is not its verify is found", () => {
  using c = copyOf();
  edit(
    `${c.repo}/commons/spec-kit/enforcement.tsv`,
    `${SPEC} FR-101\tcheck\t.github: cd commons/data && bun run verify`,
    `${SPEC} FR-101\tcheck\t.github: bun test ./tests/`,
  );
  assertStringIncludes(libraryFindings(c.repo).join("\n"), `${SPEC} FR-101 is not a check row that runs the verify of commons/data`);
});

proves(
  [`${SPEC} FR-008`],
  "a finding of the specification checker in a library's spec kit is found, and the real tool says the same",
  async () => {
    using c = copyOf();
    const kit = `${c.repo}/commons/data/spec-kit`;
    const clean = await proc.run([process.execPath, `${ROOT}/commons/tools/mizan-check.ts`, "--root", kit], { cwd: ROOT });
    assertEquals(clean.code, 0);
    writeFileSync(`${kit}/enforcement.tsv`, `${read(`${kit}/enforcement.tsv`)}0001-nothing FR-001\tnone\t-\tno such requirement\n`);
    assertStringIncludes(libraryFindings(c.repo).join("\n"), "commons/data/spec-kit:");
    const broken = await proc.run([process.execPath, `${ROOT}/commons/tools/mizan-check.ts`, "--root", kit], { cwd: ROOT });
    assert(broken.code !== 0, "the real tool fails on it too");
  },
);

proves([`${SPEC} FR-009`], "a library whose spec kit the documentation does not name once is found", () => {
  using c = copyOf();
  edit(`${c.repo}/commons/docs.config.ts`, '    { layout: "commons", dir: "commons/data/spec-kit" },\n', "");
  assertStringIncludes(libraryFindings(c.repo).join("\n"), "docs.config.ts does not name commons/data/spec-kit exactly once");
});

proves(
  [`${SPEC} FR-010`],
  "the libraries are proved by the one workflow ci, which plans and runs verify; a missing one, one that does not plan or run verify, and a library with a workflow of its own are found",
  () => {
    using c = copyOf();
    assertEquals(libraryFindings(c.repo), []);
    edit(`${c.repo}/.github/workflows/ci.auto.yml`, "run: ${{ matrix.verify }}", "run: bun test");
    edit(`${c.repo}/.github/workflows/ci.auto.yml`, "run: ${{ matrix.verify }}", "run: bun test");
    assertStringIncludes(libraryFindings(c.repo).join("\n"), "ci.auto.yml does not run verify");
    edit(`${c.repo}/.github/workflows/ci.auto.yml`, "commons/libraries/src/plan.ts", "commons/libraries/src/other.ts");
    assertStringIncludes(libraryFindings(c.repo).join("\n"), "ci.auto.yml does not plan the libraries");
    writeFileSync(`${c.repo}/.github/workflows/data.auto.yml`, "name: data\n");
    assertStringIncludes(libraryFindings(c.repo).join("\n"), "data.auto.yml is a workflow of a library of its own");
    fs.removeSync(`${c.repo}/.github/workflows/ci.auto.yml`);
    assertStringIncludes(libraryFindings(c.repo).join("\n"), ".github/workflows/ci.auto.yml is missing");
  },
);

proves(
  [`${SPEC} FR-011`],
  "the table of the libraries in the root README is what the manifests make: a library added, removed or reworded without the README regenerated fails here",
  () => {
    const r = readmeSync(ROOT, false);
    assertEquals(r.problems, []);
    assertEquals(r.stale, false);
  },
);

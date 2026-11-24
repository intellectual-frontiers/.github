/**
 * The typed workflows and their generator (commons 0030-generated-workflows FR-001, FR-002, FR-004, FR-005, FR-006, FR-008): the real repository's workflows are what the model makes, and every rule is broken in
 * a temporary folder of real files and named. The validation of the files against the schema of GitHub workflows is `tests/commons-workflows-schema.test.ts` (FR-003), in the folder that has Python.
 *
 * @module
 */
import { ACTIONS, LIBRARY_CI, PIN, workflows } from "../src/workflows/definitions.ts";
import { expr, job, type Permissions, run, use, validateAction, validateWorkflow, type Workflow } from "../src/workflows/model.ts";
import { renderAction, renderWorkflow, scalar } from "../src/workflows/render.ts";
import { existsSync, mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "@intellectual-frontiers/system/fs";
import { fromFileUrl, join, resolve } from "@intellectual-frontiers/system/path";
import { assert, assertEquals, assertStringIncludes, proves, reportFindings } from "@intellectual-frontiers/test";
import { main, outputs, synchronize } from "../src/generate-workflows.ts";

const SPEC = "0030-generated-workflows";
const ROOT = resolve(fromFileUrl(new URL("../../..", import.meta.url)));

const manifest = (o: Readonly<Record<string, unknown>> = {}): string =>
  `export const library = ${JSON.stringify({ name: "alpha", level: "L1", specKit: "spec-kit", verify: "bun run verify", version: "0.2.0", exports: ["./a"], ...o })};\n`;

/** A repository of one library, `alpha`, and an empty folder of workflows. */
function repo(root: string, libraries: readonly string[] = ["alpha"]): void {
  for (const name of libraries) {
    mkdirSync(join(root, "commons", name), { recursive: true });
    writeTextFileSync(join(root, "commons", name, "library.ts"), manifest({ name }));
  }
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
}

const put = (root: string, file: string, text: string): void => {
  mkdirSync(join(root, file, ".."), { recursive: true });
  writeTextFileSync(join(root, file), text);
};

const tiny: Workflow = {
  file: "tiny",
  name: "tiny",
  on: { push: {} },
  jobs: { test: job({ runsOn: "ubuntu-latest", timeoutMinutes: 5, steps: [use("actions/checkout@v4"), run("bun test")] }) },
};

proves(
  [`${SPEC} FR-001`],
  "every file of this repository's workflows is generated and named <name>.auto.yml, and a file written by hand is found and named",
  async () => {
    const real = outputs(ROOT);
    assertEquals(real.problems, []);
    assert(
      [...real.files.keys()].every((p) =>
        p.startsWith(".github/workflows/") ? p.endsWith(".auto.yml") : p.startsWith(".github/actions/"),
      ),
    );
    assert(existsSync(join(ROOT, ".github", "workflows", "tests.auto.yml")));
    await withTempDir((dir) => {
      repo(dir);
      writeTextFileSync(join(dir, ".github", "workflows", "hand.yml"), "name: hand\n");
      const r = outputs(dir);
      assertEquals(r.problems.length, 1);
      assertStringIncludes(r.problems[0] ?? "", ".github/workflows/hand.yml is written by hand");
      return Promise.resolve();
    });
  },
);

proves(
  [`${SPEC} FR-002`, `${SPEC} FR-005`],
  "the model's own findings: a job that needs a job that is not there or itself, a step that runs nothing, a workflow with no trigger, an action with no version or on a branch, a composite step with no shell",
  () => {
    assertEquals(validateWorkflow(tiny), []);
    const bad = (w: Partial<Workflow>): string => validateWorkflow({ ...tiny, ...w }).join("\n");
    assertStringIncludes(bad({ on: {} }), "no trigger");
    assertStringIncludes(
      bad({ jobs: { a: job({ runsOn: "ubuntu-latest", timeoutMinutes: 1, needs: ["b"], steps: [run("x")] }) } }),
      "job a needs b, which is no job",
    );
    assertStringIncludes(
      bad({ jobs: { a: job({ runsOn: "ubuntu-latest", timeoutMinutes: 1, needs: ["a"], steps: [run("x")] }) } }),
      "job a needs itself",
    );
    assertStringIncludes(
      bad({ jobs: { a: job({ runsOn: "ubuntu-latest", timeoutMinutes: 1, steps: [run("  ")] }) } }),
      "the script is empty",
    );
    assertStringIncludes(
      bad({ jobs: { a: job({ runsOn: "ubuntu-latest", timeoutMinutes: 1, steps: [use("actions/checkout")] }) } }),
      "owner/name@version",
    );
    assertStringIncludes(
      bad({ jobs: { a: job({ runsOn: "ubuntu-latest", timeoutMinutes: 1, steps: [use("actions/checkout@main")] }) } }),
      "owner/name@version",
    );
    assertEquals(
      bad({
        jobs: { a: job({ runsOn: "ubuntu-latest", timeoutMinutes: 1, steps: [use("actions/checkout@v4"), use("./.github/actions/bun")] }) },
      }),
      "",
    );
    const action = { folder: "x", name: "x", description: "d", inputs: {}, steps: [run("echo")] } as const;
    assertStringIncludes(validateAction(action).join("\n"), "names no shell");
    assertEquals(validateAction({ ...action, steps: [run("echo", { shell: "bash" })] }), []);
    // @ts-expect-error a permission is read, write or none: this does not compile
    const permission: Permissions = { contents: "admin" };
    // @ts-expect-error a job has at least one step: this does not compile
    const empty = job({ runsOn: "ubuntu-latest", timeoutMinutes: 1, steps: [] });
    assertEquals([permission.contents, empty.steps.length], ["admin", 0]);
    // every action of the model's workflows is of its table, and each version is written once
    const table: readonly string[] = Object.values(PIN);
    const used = [
      ...workflows().flatMap((w) => Object.values(w.jobs).flatMap((j) => j.steps)),
      ...ACTIONS.flatMap((a) => a.steps),
    ].flatMap((s) => (s.kind === "uses" ? [s.uses] : []));
    assert(
      used.length > 0 && used.every((u) => table.includes(u)),
      `an action of the workflows is not in the table of pins: ${used.filter((u) => !table.includes(u)).join(", ")}`,
    );
    assertEquals(new Set(table).size, table.length);
  },
);

proves(
  [`${SPEC} FR-004`],
  "--check writes nothing and exits 1, naming a file that was edited and a generated file that no workflow makes; the same bytes come twice, a CRLF checkout is the file, and the tests workflow runs --check",
  async () => {
    const sync = synchronize(ROOT, false);
    reportFindings(`${SPEC} FR-004`, [...sync.stale.map((s) => `stale: ${s}`), ...sync.problems.map(String)]);
    assertEquals(renderWorkflow(tiny), renderWorkflow(tiny));
    assertEquals(
      [
        scalar("26.13.1"),
        scalar("true"),
        scalar("bun test"),
        scalar("${{ matrix.os }}"),
        scalar("a: b"),
        scalar("x ${{ a }}: y"),
        scalar(15),
        scalar(false),
      ],
      ['"26.13.1"', '"true"', "bun test", "${{ matrix.os }}", '"a: b"', '"x ${{ a }}: y"', "15", "false"],
    );
    await withTempDir((dir) => {
      repo(dir);
      assertEquals(main(["--check", "--repo", dir]), 1);
      assert(!existsSync(join(dir, ".github", "workflows", "ci.auto.yml")), "--check wrote");
      assertEquals(main(["--repo", dir]), 0);
      const file = join(dir, ".github", "workflows", "ci.auto.yml");
      assertEquals(main(["--check", "--repo", dir]), 0);
      const text = readTextFileSync(file);
      writeTextFileSync(file, text.replace(/\n/g, "\r\n"));
      assertEquals(synchronize(dir, false).stale, [], "a CRLF checkout is the file");
      writeTextFileSync(file, text.replace("timeout-minutes: 20", "timeout-minutes: 99"));
      assertEquals(synchronize(dir, false).stale, [".github/workflows/ci.auto.yml"]);
      assertEquals(main(["--check", "--repo", dir]), 1);
      assertEquals(readTextFileSync(file).includes("timeout-minutes: 99"), true, "--check wrote");
      writeTextFileSync(join(dir, ".github", "workflows", "old.auto.yml"), "name: old\n");
      assertStringIncludes(synchronize(dir, false).problems.join("\n"), ".github/workflows/old.auto.yml is no workflow's file");
      return Promise.resolve();
    });
    const check = readTextFileSync(join(ROOT, ".github", "workflows", "tests.auto.yml"));
    assertStringIncludes(check, "bun commons/libraries/src/generate-workflows.ts --check");
    assertStringIncludes(check, "node commons/libraries/src/generate-workflows.ts --check");
  },
);

proves(
  [`${SPEC} FR-006`, `${SPEC} FR-007`],
  "the libraries are proved by one workflow, ci, made from the manifests: a plan, a matrix of the libraries a change affects and one for the systems besides Linux, and one result; a library has no workflow of its own, a manifest that cannot be read stops the generator, and a library with no record of CI has verify on Linux alone",
  async () => {
    await withTempDir((dir) => {
      repo(dir, ["alpha", "beta"]);
      assertEquals(main(["--repo", dir]), 0);
      const ci = readTextFileSync(join(dir, ".github", "workflows", "ci.auto.yml"));
      assertStringIncludes(ci, "bun commons/libraries/src/plan.ts");
      assertStringIncludes(ci, "matrix: ${{ fromJSON(needs.plan.outputs.linux) }}");
      assertStringIncludes(ci, "matrix: ${{ fromJSON(needs.plan.outputs.systems) }}");
      assertStringIncludes(ci, "IFC_STEP_SCRIPT: ${{ matrix.verify }}");
      assertStringIncludes(ci, "working-directory: ${{ matrix.folder }}");
      assertStringIncludes(ci, "needs: [plan, verify, systems]");
      assert(!ci.includes("commons/alpha"), "no library is named in the workflow: the plan says which are affected");
      assert(!existsSync(join(dir, ".github", "workflows", "alpha.auto.yml")) && !existsSync(join(dir, ".github", "workflows", "beta.auto.yml")));
      assertEquals(LIBRARY_CI["alpha"], undefined);
      // a manifest that cannot be read stops the generator before it writes
      writeTextFileSync(join(dir, "commons", "beta", "library.ts"), "export const library = { nope: 1 };\n");
      writeTextFileSync(join(dir, "commons", "alpha", "library.ts"), manifest({ verify: "bun run verify --all" }));
      assertEquals(main(["--repo", dir]), 1);
      assertEquals(readTextFileSync(join(dir, ".github", "workflows", "ci.auto.yml")).includes("--all\n"), false);
      return Promise.resolve();
    });
    // the real repository: no library has a workflow of its own, and the systems besides Linux are asked for by the libraries with code of their own for them only
    const real = outputs(ROOT).files;
    assertEquals([...real.keys()].filter((p) => /\/(?:core|data|system)\.auto\.yml$/.test(p)), []);
    assert(real.has(".github/workflows/ci.auto.yml"));
    const withSystems = Object.entries(LIBRARY_CI).filter(([, c]) => (c.systems ?? []).length > 0).map(([n]) => n);
    assert(withSystems.includes("system") && !withSystems.includes("core"));
    assertEquals(LIBRARY_CI["data"]?.after, "bun tools/generate-dpv.ts --check");
  },
);

proves([`${SPEC} FR-008`], "the composite action is written with the line that says it is generated, and --check compares it", async () => {
  const [bun] = ACTIONS;
  assert(bun !== undefined);
  const text = renderAction(bun);
  assert(text.startsWith("# Generated by bun commons/libraries/src/generate-workflows.ts; do not edit"));
  assertEquals(expr("inputs.node-version"), "${{ inputs.node-version }}");
  assertEquals(
    readTextFileSync(join(ROOT, ".github", "actions", "bun", "action.yml")).replace(/\r\n/g, "\n"),
    text,
    "a Windows checkout of the action is the file, whatever its line ends",
  );
  await withTempDir((dir) => {
    repo(dir, []);
    assertEquals(main(["--repo", dir]), 0);
    const file = join(dir, ".github", "actions", "bun", "action.yml");
    assertEquals(readTextFileSync(file), text);
    writeTextFileSync(file, `${text}# by hand\n`);
    assertEquals(synchronize(dir, false).stale, [".github/actions/bun/action.yml"]);
    return Promise.resolve();
  });
});

proves(
  [`${SPEC} FR-009`],
  "the one release workflow is run by hand from main and publishes in the order of the plan: npm by trusted publishing with provenance, or by INFRO_NPMJS_TOKEN where the repository has it, the GitHub package registry with the runner's token, and the tag made by the runner; no library has a workflow of its own, and a library with npm and no pack.ts is a finding",
  async () => {
    await withTempDir((dir) => {
      repo(dir, ["alpha", "beta"]);
      writeTextFileSync(join(dir, "commons", "beta", "library.ts"), manifest({ name: "beta", distribution: ["github", "npm"] }));
      // npm and no tools/pack.ts: a finding, and nothing is written
      assertEquals(main(["--repo", dir]), 1);
      assertStringIncludes(outputs(dir).problems.join("\n"), "commons/beta is published to npm and has no tools/pack.ts");
      put(dir, "commons/beta/tools/pack.ts", "export {};\n");
      assertEquals(main(["--repo", dir]), 0);
      assert(!existsSync(join(dir, ".github", "workflows", "beta-publish.auto.yml")), "a library has no workflow of its own");
      return Promise.resolve();
    });
    const w = readTextFileSync(join(ROOT, ".github", "workflows", "release.auto.yml")).replace(/\r\n/g, "\n"); // a Windows checkout has CRLF
    // by hand only, from main, asked to publish
    assertStringIncludes(w, "workflow_dispatch:");
    assert(!w.includes("\n  push:") && !w.includes("pull_request"), "a release is never made by a push");
    assertStringIncludes(w, "publish:\n        description:");
    assertStringIncludes(w, "refs/heads/main");
    assertStringIncludes(w, "if: \"always() && inputs.publish && needs.plan.outputs.has-build == 'true' && needs.plan.result == 'success'\"");
    // the order of the plan, the proof and the pack of each library, provenance and the token only where there is one
    assertStringIncludes(w, "bun commons/libraries/src/releasing.ts matrix");
    assertStringIncludes(w, "IFC_STEP_SCRIPT: bun run verify");
    assertStringIncludes(w, "IFC_STEP_SCRIPT: bun tools/pack.ts");
    assertStringIncludes(w, "bun commons/libraries/src/releasing.ts publish --dir package");
    assertStringIncludes(w, "id-token: write");
    assertStringIncludes(w, "environment:\n      name: npm");
    assertStringIncludes(w, "NPM_TOKEN: ${{ secrets.INFRO_NPMJS_TOKEN }}");
    // each release by itself (the command: a version on npm is only tagged, one that cannot be sent is reported and not tagged, the others go on), with the runner's token for the tags
    assertStringIncludes(w, "GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    assertStringIncludes(w, "contents: write");
    // no secret but the one token the owner may add, and the runner's own
    assertEquals(
      [...new Set([...w.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))].sort(),
      ["GITHUB_TOKEN", "INFRO_NPMJS_TOKEN"],
    );
    for (const f of outputs(ROOT).files.keys())
      assert(!/-publish\.auto\.yml$/.test(f), `${f}: a workflow of a library's own publication`);
  },
);

proves([`${SPEC} FR-010`], "no script of a bash step pipes into head: under pipefail a listing longer than the cut fails the step that prints it", () => {
  const found: string[] = [];
  for (const w of workflows())
    for (const [id, j] of Object.entries(w.jobs))
      for (const s of j.steps) if (s.kind === "run" && (s.shell === "bash" || s.shell === undefined) && /\|\s*head\b/.test(s.run)) found.push(`${w.file}/${id}: ${s.name ?? s.run.slice(0, 40)}`);
  assertEquals(found, []);
});

proves([`${SPEC} FR-013`], "the tests of the root run on Linux alone, and the installers of agora alone on macOS", () => {
  const w = workflows().find((x) => x.file === "tests");
  assert(w !== undefined, "the workflow tests exists");
  const runners = Object.entries(w.jobs).map(([name, j]) => [name, typeof j.runsOn === "string" ? j.runsOn : "matrix"] as const);
  assertEquals(
    runners.filter(([, os]) => os === "macos-latest" || os === "windows-latest").map(([n]) => n).filter((n) => n !== "windows"),
    ["installers"],
    "macOS has one job, the installers; Windows has its own job as it had",
  );
  const matrix = w.jobs["tests"]?.strategy?.matrix;
  assert(matrix !== undefined && typeof matrix === "object" && !("expression" in matrix), "the matrix of tests is data");
});

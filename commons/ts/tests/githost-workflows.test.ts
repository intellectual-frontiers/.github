/**
 * The typed workflows and their generator (commons 0030-generated-workflows FR-001, FR-002, FR-004, FR-005, FR-006, FR-008): the real repository's workflows are what the model makes, and every rule is broken in
 * a temporary folder of real files and named. The validation of the files against the schema of GitHub workflows is `tests/commons-workflows-schema.test.ts` (FR-003), in the folder that has Python.
 *
 * @module
 */
import { ACTIONS, LIBRARY_CI, PIN, workflows } from "../githost/workflows/definitions.ts";
import { expr, job, type Permissions, run, use, validateAction, validateWorkflow, type Workflow } from "../githost/workflows/model.ts";
import { renderAction, renderWorkflow, scalar } from "../githost/workflows/render.ts";
import { readLibraries } from "../mizan/libraries.ts";
import { existsSync, mkdirSync, readTextFileSync, withTempDir, writeTextFileSync } from "../runtime/fs.ts";
import { fromFileUrl, join, resolve } from "../runtime/path.ts";
import { assert, assertEquals, assertStringIncludes, proves } from "../runtime/test.ts";
import { main, outputs, synchronize } from "../tools/generate-workflows.ts";

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
      ...workflows(
        readLibraries(ROOT).flatMap((f) => ("library" in f ? [{ name: f.library.name, verify: f.library.verify, paths: [] }] : [])),
      ).flatMap((w) => Object.values(w.jobs).flatMap((j) => j.steps)),
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
    assertEquals(synchronize(ROOT, false), { stale: [], problems: [] });
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
      assert(!existsSync(join(dir, ".github", "workflows", "alpha.auto.yml")), "--check wrote");
      assertEquals(main(["--repo", dir]), 0);
      const file = join(dir, ".github", "workflows", "alpha.auto.yml");
      assertEquals(main(["--check", "--repo", dir]), 0);
      const text = readTextFileSync(file);
      writeTextFileSync(file, text.replace(/\n/g, "\r\n"));
      assertEquals(synchronize(dir, false).stale, [], "a CRLF checkout is the file");
      writeTextFileSync(file, text.replace("timeout-minutes: 15", "timeout-minutes: 99"));
      assertEquals(synchronize(dir, false).stale, [".github/workflows/alpha.auto.yml"]);
      assertEquals(main(["--check", "--repo", dir]), 1);
      assertEquals(readTextFileSync(file).includes("timeout-minutes: 99"), true, "--check wrote");
      writeTextFileSync(join(dir, ".github", "workflows", "old.auto.yml"), "name: old\n");
      assertStringIncludes(synchronize(dir, false).problems.join("\n"), ".github/workflows/old.auto.yml is no workflow's file");
      return Promise.resolve();
    });
    const check = readTextFileSync(join(ROOT, ".github", "workflows", "tests.auto.yml"));
    assertStringIncludes(check, "bun commons/ts/tools/generate-workflows.ts --check");
    assertStringIncludes(check, "node commons/ts/tools/generate-workflows.ts --check");
  },
);

proves(
  [`${SPEC} FR-006`],
  "a folder with a manifest is given a workflow that runs its verify in its folder when it or what it imports changes, a manifest that cannot be read stops the generator, and a library with no record of CI has the job verify alone",
  async () => {
    await withTempDir((dir) => {
      repo(dir, ["alpha", "beta"]);
      assertEquals(main(["--repo", dir]), 0);
      const alpha = readTextFileSync(join(dir, ".github", "workflows", "alpha.auto.yml"));
      assertStringIncludes(alpha, '- "commons/alpha/**"');
      assertStringIncludes(alpha, '- "commons/tools/**"');
      assertStringIncludes(alpha, "- .github/workflows/alpha.auto.yml");
      assertStringIncludes(alpha, "working-directory: commons/alpha");
      assertStringIncludes(alpha, "run: bun run verify");
      assert(!alpha.includes("\n  node:"), "a library with no record of CI has the job verify alone");
      assert(existsSync(join(dir, ".github", "workflows", "beta.auto.yml")));
      assertEquals(LIBRARY_CI["alpha"], undefined);
      // a manifest that cannot be read stops the generator before it writes
      writeTextFileSync(join(dir, "commons", "beta", "library.ts"), "export const library = { nope: 1 };\n");
      writeTextFileSync(join(dir, "commons", "alpha", "library.ts"), manifest({ verify: "bun run verify --all" }));
      assertEquals(main(["--repo", dir]), 1);
      assertEquals(readTextFileSync(join(dir, ".github", "workflows", "alpha.auto.yml")).includes("--all"), false);
      return Promise.resolve();
    });
    // the real library's workflow keeps its extra steps and its job on Node
    const data = readTextFileSync(join(ROOT, ".github", "workflows", "data.auto.yml"));
    assertStringIncludes(data, "run: bun run verify");
    assertStringIncludes(data, "node --test");
  },
);

proves([`${SPEC} FR-008`], "the composite action is written with the line that says it is generated, and --check compares it", async () => {
  const [bun] = ACTIONS;
  assert(bun !== undefined);
  const text = renderAction(bun);
  assert(text.startsWith("# Generated by bun commons/ts/tools/generate-workflows.ts; do not edit"));
  assertEquals(expr("inputs.node-version"), "${{ inputs.node-version }}");
  assertEquals(readTextFileSync(join(ROOT, ".github", "actions", "bun", "action.yml")), text);
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

// Spec: 0013-repoctl-ci FR-001, FR-002
/**
 * `repoctl ci step` on Headless (commons repoctl 0013-repoctl-ci FR-001, FR-002; commons 0038-build-policy FR-013): one step of a pipeline under the build policy. It runs the command given after `--`, keeps what it prints, reads it into findings with the
 * parser of its tool, writes the file of the step and ends 0 whatever the command's own status was, so that what a module says is a finding and never a red step. It is the same program as `commons/libraries/src/ci/step.ts`, which a workflow runs directly
 * (it imports no package, so it runs in a cell before the cell's packages are installed); the verb is for a person who wants to see what the wrapper would make of a command.
 *
 * @example
 * ```ts
 * import { ciStepVerb } from "@intellectual-frontiers/repoctl/physical";
 * typeof ciStepVerb; // "function"
 * ```
 *
 * @module
 */
import { execute, parseRequest } from "@intellectual-frontiers/libraries/ci/step";
import { value } from "@intellectual-frontiers/terminal/args";
import { defineVerb, outcomeOfDone, outcomeOfUsage } from "../define.ts";

/** `repoctl ci step`. */
export const ciStepVerb = defineVerb({
  name: "step",
  id: "ci step",
  needsConfig: false,
  options: {
    id: value<never>({ help: "The step's id: letters, digits, dots, hyphens and underscores.", valueName: "ID", required: true }),
    job: value<never>({ help: "The job the step is in.", valueName: "JOB", default: "local" }),
    module: value<never>({ help: "The module (library) its findings are of.", valueName: "NAME", default: "repository" }),
    tool: value<never>({ help: "The tool whose output is read: tsc, bun-test, lint, format, repoctl-check, mizan-check, kanon-check, generated-files, verify, checks, exit-status, install.", valueName: "TOOL", default: "exit-status" }),
    timeout: value<never>({ help: "The minutes after which the command is stopped.", valueName: "MINUTES", default: "15" }),
    out: value<never>({ help: "The folder the step's findings file is written to.", valueName: "DIR", default: "_findings" }),
  },
  examples: [{ args: ["--id", "tests", "--tool", "bun-test", "--", "bun", "test"], says: "Run the tests and keep the failing ones as findings." }],
  run: async (args) => {
    const o = args.options;
    const parsed = parseRequest(["--id", o.id, "--job", o.job, "--module", o.module, "--tool", o.tool, "--timeout", o.timeout, "--out", o.out, "--", ...args.positionals, ...args.rest]);
    if (parsed.kind === "err") return outcomeOfUsage(`ci step: ${parsed.error} (the red cause wrapper-misused)`, "E-USAGE", "repoctl ci step --help");
    const file = await execute(parsed.request, process.env);
    const step = file.steps[0];
    return outcomeOfDone({
      data: { step: step ?? null, findings: file.findings.length },
      text: `ci step ${parsed.request.id}: ${step?.outcome ?? "?"}, ${file.findings.length} findings (never a red step)`,
      findings: [],
      title: `${file.findings.length} finding${file.findings.length === 1 ? "" : "s"}`,
    });
  },
});

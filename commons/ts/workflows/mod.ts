/**
 * The typed model of GitHub Actions workflows and the writer of their files (commons 0030-generated-workflows): the values a repository writes its workflows as, and the YAML they are made into. A repository
 * that imports this writes its own workflows as TypeScript and makes `.github/workflows/<name>.auto.yml` from them, as this repository does with `commons/ts/tools/generate-workflows.ts`.
 *
 * @module
 */
export {
  type CompositeAction,
  expr,
  type Expr,
  type Filter,
  job,
  type Job,
  type Permissions,
  type Runner,
  run,
  type RunStep,
  type Scalar,
  type Step,
  type Strategy,
  type Triggers,
  use,
  type UseStep,
  validateAction,
  validateWorkflow,
  type Workflow,
} from "./model.ts";
export { GENERATOR, renderAction, renderWorkflow } from "./render.ts";

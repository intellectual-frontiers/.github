/**
 * The generated workflows against the schema of GitHub workflows (commons 0030-generated-workflows FR-003): an independent reader, Python's jsonschema, validates every file that the generator wrote under
 * `.github/workflows/` against the copy of SchemaStore's JSON Schema kept in `commons/ts/githost/workflows/schema/` (fetched from https://json.schemastore.org/github-workflow.json on 2026-11-19), and refuses a workflow
 * with a step that has a key GitHub does not know. Python with jsonschema and PyYAML is not on every computer (the CI installs them): where it is not, the check is skipped.
 *
 * @module
 */
import { path, proc } from "../commons/ts/runtime/mod.ts";
import { assertEquals, proves } from "../commons/ts/runtime/test.ts";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");

const CHECK = `
import glob, json, sys, yaml
from jsonschema import Draft7Validator
root = sys.argv[1]
schema = json.load(open(root + "/commons/ts/githost/workflows/schema/github-workflow.schema.json"))
Draft7Validator.check_schema(schema)
v = Draft7Validator(schema)
def doc(text):
    d = yaml.safe_load(text)
    # YAML 1.1 reads the key on as true
    return {("on" if k is True else k): x for k, x in d.items()}
files = sorted(glob.glob(root + "/.github/workflows/*.yml"))
errors = {f.split("/")[-1]: [e.message for e in v.iter_errors(doc(open(f).read()))] for f in files}
broken = doc("name: x\\non:\\n  push:\\njobs:\\n  a:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - run: x\\n        bogus: 1\\n")
print(json.dumps({"errors": errors, "broken": len(list(v.iter_errors(broken)))}))
`;

proves(
  [`${"0030-generated-workflows"} FR-003`],
  "every generated workflow is valid by the schema of GitHub workflows, read by Python's jsonschema, and a step with a key GitHub does not know is refused by it",
  async (t) => {
    const python = proc.which("python3");
    const have = python === undefined ? undefined : await proc.run([python, "-c", "import jsonschema, yaml"]);
    if (python === undefined || have === undefined || have.code !== 0) {
      t.skip("python3 with jsonschema and PyYAML is not installed");
      return;
    }
    const o = await proc.run([python, "-c", CHECK, ROOT]);
    assertEquals(o.code, 0, o.stderr);
    const r = JSON.parse(o.stdout) as { errors: Record<string, string[]>; broken: number };
    assertEquals(Object.keys(r.errors).length > 0, true);
    for (const [file, errors] of Object.entries(r.errors)) assertEquals(errors, [], file);
    assertEquals(r.broken > 0, true, "the schema refused nothing");
  },
);

# Imports run one way

Rule 4 is the most mechanical rule of Kanon, and the one an agent meets most often: **a unit imports only units of a layer above its own**, and units of its own layer only where its row of the table lists them. This page shows the table, the check, and the exact findings the check prints when a rule is broken.

## The table of a small library

The examples on this page use a small library kept in the repository for this purpose: `commons/kanon/suite/examples/reminders`. It has three actions (list, add, clear), a Logical model, and two surfaces, a command line and a tool server. It is tested by the Kanon library's own suite, so what is quoted here is code that runs. [Adopting Kanon](kanon-adopting.md) builds it step by step.

Its table is a literal object, `kanon.ts`:

*Source: `commons/kanon/suite/examples/reminders/kanon.ts`, lines 8 to 17.*

```ts source=commons/kanon/suite/examples/reminders/kanon.ts#L8-L17
export const kanon = {
  package: "@example/reminders",
  units: [
    { folder: "./", own: true },
    { folder: "src/governance/", layer: "governance" },
    { folder: "src/logical/", layer: "logical" },
    { folder: "src/physical/cli/", layer: "physical", mayImport: ["src/governance/", "src/logical/"] },
    { folder: "src/physical/tool/", layer: "physical", mayImport: ["src/governance/", "src/logical/"] },
  ],
};
```

Five units. The first is the library's own checking, which is in no layer. Governance is a unit. Logical is a unit. Each surface is a unit of the Physical layer, and the two surfaces each list what they may import: Governance and Logical, and nothing else. They do not list each other, so neither may import the other.

The units import each other by the package's name, through its `exports`, and never by a relative path. The package's `package.json` names the public entries:

```json
{
  "exports": {
    "./governance": "./src/governance/mod.ts",
    "./logical": "./src/logical/mod.ts",
    "./cli": "./src/physical/cli/mod.ts",
    "./tool": "./src/physical/tool/mod.ts"
  }
}
```

That is rule 6 working inside the library: a unit reaches another through the `exports`, so the `exports` are the contract.

## What the check finds

The check reads the table, the `exports` and every `.ts` file, finds every import by parsing the TypeScript, and applies the rules. It is pure: given the files it returns findings, and it writes nothing. The codes are a closed list, and each has a sentence.

| Code | What it finds |
| --- | --- |
| `layers/unclassified` | a file that no unit of the table holds |
| `layers/relative` | a file of another unit imported by a relative path |
| `layers/private` | an import of the package by a path its exports do not name |
| `layers/external` | an import of a package that the row of the unit does not allow |
| `layers/above` | an import of a unit that stands below the importer |
| `layers/around` | an import of another unit of the same layer that the row does not list |
| `layers/cycle` | distinct units that form a cycle of permitted imports |
| `layers/syntax` | a file whose TypeScript syntax could not be parsed |

The same check holds the rules for instances, plugins and families (`instances/sibling`, `instances/undeclared`, `plugins/inverted`, `plugins/undeclared`, `plugins/contract`, `family/name`), covered in [the page on families](kanon-families.md), and the rules for models (`kanon/dropped` and eight more), covered in [the previous page](kanon-trace-and-dropped.md). The whole list is one closed type, and a registry with an entry for each code is checked complete by the compiler.

## Four deliberate violations

Each of the four findings below comes from running the check on a **copy** of the example library with one edit. The edit is shown, then the finding the check prints, as the code, the file and line, and the sentence. Each one is also a test in the Kanon suite, so the four outputs cannot drift from the code.

### A surface imports the other surface: `layers/around`

The tool surface, which the table says may import Governance and Logical, also imports the command line.

```text
 // src/physical/tool/tool.ts
 import { type Verb, VERBS } from "@example/reminders/logical";
+import { usageOf } from "@example/reminders/cli";
```

```text output="the import check over a copy of commons/kanon/suite/examples/reminders with the line above added; 2026-11-24"
layers/around | src/physical/tool/tool.ts:8 | src/physical/tool/ (physical) imports @example/reminders/cli, src/physical/cli/ (physical), which it may not reach
```

### A relative import of another unit: `layers/relative`

Logical reaches into Governance by a path.

```text
 // src/logical/verbs.ts
-import { ACTIONS, type Action } from "@example/reminders/governance";
+import { ACTIONS, type Action } from "../governance/reminder.ts";
```

```text output="the import check over a copy of commons/kanon/suite/examples/reminders with the import above changed; 2026-11-24"
layers/relative | src/logical/verbs.ts:7 | it imports ../governance/reminder.ts, a file of src/governance/: import it by @example/reminders
```

### A path the exports do not name: `layers/private`

Logical imports the package by a deep path that is not one of its public entries.

```text
 // src/logical/verbs.ts
-import { ACTIONS, type Action } from "@example/reminders/governance";
+import { ACTIONS, type Action } from "@example/reminders/src/governance/reminder.ts";
```

```text output="the import check over a copy of commons/kanon/suite/examples/reminders with the import above changed; 2026-11-24"
layers/private | src/logical/verbs.ts:7 | it imports @example/reminders/src/governance/reminder.ts, which exports does not name
```

### Governance imports Logical: `layers/above`

A statement of what a thing is starts depending on the model made from it. This is the rule an agent breaks most often when it adds a convenient constant to the wrong file.

```text
 // src/governance/reminder.ts
+import { VERBS } from "@example/reminders/logical";
+export const COUNT = VERBS.length;
```

```text output="the import check over a copy of commons/kanon/suite/examples/reminders with the two lines above added; 2026-11-24"
layers/above | src/governance/reminder.ts:9 | src/governance/ (governance) imports @example/reminders/logical, src/logical/ (logical), which it stands below
```

## The check on a real library

The same check runs on every library of this repository that declares a table, by the library's own `verify` script. On the day this page was written, a run over all 58 manifests that declare a Kanon table took 20 seconds in total, about a third of a second each, and none of them failed or held a baseline. [What consumers gain](kanon-gains.md) says what that measurement does and does not show.

## Baselines: adopt without fixing everything first

A library that adopts the check on an existing codebase may have findings on day one. Run the check with `--write-baseline` once, and it writes `kanon.baseline.txt`: one line, a **key**, for each finding it holds. From then on:

- A finding that is **new** fails the check.
- A line that **does not occur** also fails it, so a fixed finding must be removed from the baseline.
- The baseline may only shrink. The file's own header says: never add a line to make a check pass.

This is the line between adopting a rule and pretending to. [The page on weaknesses](kanon-weaknesses.md) comes back to baselines that are never paid down.

## What the check cannot see

The check reads syntax. It finds the imports and re-exports of a file and dynamic imports whose target is a literal. It does **not** follow an import whose target is computed at run time, such as `import(somePath + ".ts")`. A computed import with no literal target is left unresolved and is skipped, and the library's tests and review have to cover what the check cannot reach. A module that reaches around the table by computing its import is a hole in the guardrail, and [the page on weaknesses](kanon-weaknesses.md) lists it among the limits of the check.

Next: [families, hosts and plugins](kanon-families.md).

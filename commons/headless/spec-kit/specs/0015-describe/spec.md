# Feature Specification: Headless describes a program

**Spec ID:** 0015-describe
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** A documentation generator, a check or a diff has to read what a headless program says without running it. `describe(program)` is a pure builder that gives the program as layered models of Kanon (commons 0033-kanon FR-001): governance (what each action is and may do, the problem codes and the exit statuses), the logical layer (the program, its plugins, verbs, options and operands) and the surfaces as the physical layer (the command line, the tool server and the REST interface), with the trace edges between the layers, the dispositions of every annotation of governance and the problems of the model as findings. The model is the contract `LayeredModel` of `@intellectual-frontiers/kanon`, which the documentation generator's layered lens reads as its own.

## The models

- **FR-001**: `describe(program)` MUST give one `LayeredModel` for each tier of the program's ladder, lowest first, named `<program>-<tier>`, of the library `headless`, made from the `Program` alone: pure, deterministic and with no input or output, so that the same program always gives equal models. Each model MUST have the three layers of Kanon, `governance`, `logical` and `physical`, in that order, with the kinds each holds, and no instances. `describeChecked(program)` MUST give the same models as a `Result`, and an `err` that says why where the program's name cannot make an id; `describe` then gives none.
- **FR-002**: The kind of an element MUST be one of a closed union: `action`, `problem-code`, `outcome` and `program-definition` in governance; `program`, `plugin`, `verb`, `option` and `operand` in the logical layer; `cli-command`, `mcp-tool`, `rest-route` and `openapi-document` in the physical layer. The layer of an element MUST be the layer of its kind (an exhaustive match), and every element MUST have an id, a layer, a kind, a name, a definition, a source and its properties, and a parent where it is a part of another.
- **FR-003**: Every id MUST be an `ElementId` made by a smart constructor that returns a `Result`: a verb `headless:<program>/<verb path>`, a command `cli:<program> <verb path>`, a tool `mcp:<tool name>`, a route `rest:<METHOD> <path>`, an option `<verb id>#--flag` and an operand `<verb id>#<operand>`, and, besides those agreed with the data library, the program `headless:<program>`, an action `action:<program>/<verb path>`, a problem code `problem-code:<program>/<code>`, an exit status `outcome:<program>/<exit name>`, a plugin `plugin:<owner>` and the document `openapi:<program>`. The tool name and the path of a route MUST be those of the tool server (`toolName`) and of the REST surface (`pathOf`).

## The layers

- **FR-004**: Governance MUST hold one `action` for each verb, whose properties are the annotations of the action: its kind, effect, idempotency, audience, tier, preview, check and human-only options, and the channels, read-only fact, need of a terminal, whom it runs as and confirmation of its reach policy (`null` where it has none); one `problem-code` for each code of the program's catalogue, and for each generic code the catalogue does not hold, with its explanation (title and what in the definition, why, fix and guide as properties); and one `outcome` for each exit status of the one table, with its status and its meaning.
- **FR-005**: The logical layer MUST hold the program (its version, prefix, ladder and default command), one `verb` for each command of the tree with its summary as the definition, its examples and the annotations of its action as properties it carries, one `option` for each option of the verb (those it declares and those the model adds by its action's facts: `--json`, `--dry-run`, `--yes`, and the others) and one `operand` for each operand, each with its verb as parent. A verb contributed by a plugin MUST name it as its origin (`Program.origins`) and have the plugin as its parent, and a plugin MUST list the verbs it contributes; a verb of the host has the program as its parent.
- **FR-006**: What is wrong with the model MUST be the findings of the model: each problem of `modelProblems` (a name, an action's facts, a reach policy, a reserved option or short, a built-in word, a human-only option that is not declared) and of `catalogueProblems`, with a rule and the element it is about; a duplicate id, an element with no words to define it, a tool name two verbs would share and an id that cannot be made MUST be findings too, never an exception and never a silent omission.
- **FR-007**: The physical layer of a model MUST hold, for each verb the tier of the model may see (`tierGate`), a `cli-command`; a `mcp-tool` where the tool server draws the verb (the reach policy names the `mcp` channel and the audience is not `human`), with the name, the hints and the inputs of `toolOf`; and a `rest-route` where the REST surface draws it (the `rest` channel, not for a person alone), the method and the path of the OpenAPI document, which is an `openapi-document` that is the parent of its routes. The tools of a model MUST be exactly those that `served` gives for its tier, and the routes exactly the paths of `openApiOf` for its tier.

## The trace and what is not drawn

- **FR-008**: The trace MUST have an edge `projects to` from each action to its verb, and from each verb to each projection it has; every verb the tier sees MUST trace to a `cli-command`, and every edge MUST join two elements of the model. Where present, the program and its plugin listings MUST trace to the program definition, options and operands to their action, and the OpenAPI document to the logical program.
- **FR-009**: A verb the tier may not see MUST have no projection on any surface, and the model MUST say so: the verb's `notProjected` property lists each surface and why, in the sentence of the gate (`tierMessage`), and for a verb that the tier sees but a machine surface does not draw it lists the surface and the reason (no reach policy, the channel, a person alone); the dispositions of its tier and audience are `unexpressed` with that reason.
- **FR-010**: Every annotation of every action, and every annotation of a problem code and an outcome, MUST end in one disposition (commons 0033-kanon FR-005): expressed by the element that enforces it (the command that draws the tier and audience, the tool or route that draws the reach, the option `--dry-run`, `--check` or `--yes` that a preview, a check or a destruction adds), carried as data by the verb, or unexpressed with its reason, so that `droppedFindings` of Kanon finds nothing in any model.
- **FR-011**: Where an element is written MUST be what the caller says: `describe(program, { locate })` asks `locate` for the source of a subject (the program, a plugin, a verb, a code, an exit status), a closed union, and where it has none the source is the name of the program (or of the plugin that contributed the verb) and the line 1.

## Acceptance scenarios

1. **Given** a program with a report, an `operator` action and an `administrator` action, **When** it is described, **Then** there is a model for each tier of its ladder, and the model of `public` has the cli-command of the report and none of the others, per FR-001 and FR-007.
2. **Given** a verb whose reach names `mcp` and `rest`, **When** it is described, **Then** its verb traces to a command, a tool and a route with the ids `cli:<program> <verb path>`, `mcp:<tool name>` and `rest:GET /v1/<path>`, per FR-003, FR-007 and FR-008.
3. **Given** a verb hidden from a tier, **When** the model of that tier is read, **Then** the verb is there, has no projection, says why in `notProjected` and has its tier `unexpressed`, per FR-009.
4. **Given** a program composed of a host and a plugin, **When** it is described, **Then** the plugin is an element and the verbs it contributed have it as parent, per FR-005.
5. **Given** a program with a model problem, **When** it is described, **Then** the problem is a finding of the element it is about, per FR-006.
6. **Given** any model, **When** `droppedFindings` reads it, **Then** it finds nothing, per FR-010.

## Out of scope

- The pages of the documentation: the layered lens of the documentation generator (`commons/docs`) reads these models and writes them.
- The model of a target or of the run log: what a run does is not what a program says.

## Edge cases

- A program with no verb: models with the program, the exit statuses and the generic codes, and no projection, per FR-004 and FR-007.
- A tier that is not on the ladder: the verb needing it is hidden from every tier, per FR-009.
- A tool name that two verbs share (`a b-c` and `a-b c` both `a_b_c`): the first is kept and the second is a finding, per FR-006.

## Assumptions

- The ladder of a program is its own (`Program.tiers`), the default one where it gives none.
- The tool server and the REST skeleton are generated from the same tree and tier, so the physical layer reads their own functions and does not draw their rules a second time.

## Open questions

- None.

## Key entities

- **Model** - the program for a caller of one tier, in three layers.
- **Element** - one thing a layer says: an action, a verb, an option, a command, a tool, a route.
- **Disposition** - how an annotation of an action ends: expressed, carried or unexpressed with its reason.

## Success criteria

- **SC-001**: A documentation generator given `describe(program)` documents every verb of any headless program, the surfaces that draw it for each tier, and what the tiers hide, with no knowledge of the program.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided

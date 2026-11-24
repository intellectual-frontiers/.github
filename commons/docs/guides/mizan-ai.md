# AI-first, AI-native

**AI-first** means we assume an agent will read, write and change this system every day. **AI-native** means the artifacts are designed for that: structured, identifiable, checkable. The central principle is the same in both: *the agent proposes; deterministic checks and a person decide.*

## Why this design suits agents

- **One entry point.** `AGENTS.md` tells an agent what the repository is, which rules bind and what to run. The constitution and the ladder tell it where a change belongs.
- **Stable identifiers.** `FR-nnn`, `// Spec:` lines and `proves([...])` let an agent walk from a requirement to its code and its proof, and back, without guessing.
- **Typed ground truth.** The ontology and its code lists are typed TypeScript. An agent that invents a term or misspells a value gets a compiler error, which is an instruction it can act on.
- **Findings as sentences.** Every check reports a place and one plain sentence. An agent can read, understand and fix a finding without a human translating it.
- **Regular requirement shapes.** EARS and Given, When, Then are patterns models produce reliably and checkers parse. Vague prose is the hardest thing to verify.
- **One language.** TypeScript is known to every agent. Ontology, code, tools and tests in one language mean fewer context switches and fewer places to hallucinate a format.

## The agent's working rules

1. **Read first.** `AGENTS.md`, then the constitution, then the specification you are changing.
2. **Specification before code.** Use the Spec Kit workflow (specify, clarify, plan, tasks, implement) and, in a Mizan harness, climb the ladder lowest rung first.
3. **Look up before you coin.** Before adding a term, search the ontology and the standards in the precedence order. Write the result in *Standards considered*. If nothing fits, mark the term `unaligned`, justify it and record a Decision.
4. **Cite.** Every source file names the requirements it implements; every test names what it proves.
5. **Run the checks and read the findings.** A finding is the specification talking. Baselines only shrink: never add a baseline line to make a check pass.
6. **Never edit generated files.** Change the ontology and run the generator.
7. **A person decides** what only a person may: publishing, accepting an `unaligned` term's Decision, anything outward-facing.

## What agents are not trusted with

**Self-verification.** An agent's statement that its work matches the specification is not evidence. The check is. And no check can tell whether a requirement means what its authors meant: that is what `review` in the proof register is for, with a named person and a reason.

## AI-native, concretely

- **Specifications are data.** A registry, a proof register, parseable requirements and typed scenarios. A model can be asked "which requirements have no proof?" and a program can answer it.
- **The ontology is a context an agent can load.** Typed individuals, code lists and per-area `about.ts` facts are compact and precise, unlike a prose glossary that has drifted.
- **The generated artifacts are for everyone else.** Turtle, SHACL and JSON Schema let non-TypeScript tools and non-agent readers see the same facts without learning our stack.
- **Standards-first helps models.** Agents already know NIST, schema.org and PROV-O. An invented dialect is something no model has seen; a standard's own term is something it has.

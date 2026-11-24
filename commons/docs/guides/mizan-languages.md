# Two languages

We keep specifications, ontology and code in two vertically integrated languages: **natural language** and **TypeScript 7 or later**. Every additional language or format is another place for facts to drift.

- **Natural language: specifications.** Markdown, in Spec Kit's layout. It states what must be true, for people, auditors and agents. Requirements are written with RFC 2119 keywords and EARS patterns ([How a specification is written](mizan-writing-a-spec.md)).
- **TypeScript 7+: everything else.** The ontology, the code, the tools, the tests and the configuration. Bun is the default runtime, Node 26 the backup, so the same code runs on servers, workstations and devices.

## Why TypeScript

- **Modern and strongly typed.** Types are checked at compile time, and algebraic types (discriminated unions, branded types, exhaustive `switch`) let us state facts so that a wrong one does not compile.
- **Interpreted, and compilable.** It runs as it is under Bun or Node, and compiled forms are available where they are wanted.
- **Portable.** Servers, workstations and devices, on Linux, macOS and Windows.
- **Known.** Popular with people, and known to every AI agent.
- **One language for ontology and code.** The words code branches on are the ontology's code lists, imported as a union type, never typed twice.

## What this rules out

A fact, a setting or a schema is not kept as source in YAML, JSON, XML, Turtle or SQL. Those are *generated* from the TypeScript, marked `.auto.`, checked for staleness, and never edited by hand. Third-party files (a lockfile, a vendor's manifest) are theirs, and need no exception.

## The exception that proves the rule: integrations

**Best tool for the job, recorded.** Code that integrates with, extends or plugs into another system is TypeScript 7 *when possible*. Where TypeScript does not support what the job needs natively, and a hand-written minimal parser or client would not be good enough, it is not only allowed but **incumbent** to choose and use the best stack (format, language or tool) for that job. An integration that works matters more than language purity.

Each such choice is a typed `Exception` in the ontology, so it is visible, bounded and tested:

| Field | What it records |
| --- | --- |
| Tool and language or format | What is used, for example an XML reader or a SHACL validator. |
| Why not TypeScript | Why TypeScript or a hand-written parser is not enough. |
| Pinned version | Through the packaging specification, so the supply chain knows it. |
| Isolation | A typed TypeScript wrapper with files in and files out, so nothing else depends on the tool. |
| Platforms | Where it runs. Its tests run only there. |
| Real-tool tests | Tests that run the real tool, never a stand-in. |

**Specified** in `0017-two-languages`.

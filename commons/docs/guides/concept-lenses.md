# Lenses

A lens turns a library's own description of itself into pages. The generator knows no library: a library keeps a pure builder that makes layered models from its values, and a lens in this site's configuration reads them ([commons 0011-documentation](../../spec-kit/specs/0011-documentation/spec.md), FR-029 and FR-030).

- **The layered-model lens** documents the data models: for each model its concepts, attributes, relationships and code lists, the logical tables they become, the SQL for each dialect and the typed tables, with a trace and a JSON file for each model.
- **The program lens** documents the programs built on Headless: for each tier of the audience its verbs, what each may do, and the command, tool and route a surface draws (or why it is not drawn).
- **The guides lens** puts the pages people write, such as this one, into the site and checks their links and citations like every other page.

**Add one.** Give the generator a `Lens` in `commons/docs.config.ts`; `bun main.ts check` in `commons/docs` builds the site and reports every finding.

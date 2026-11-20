# Kanon

Kanon (Greek *kanon*, the measuring rule) is the pattern of a library built in three layers: **Governance** says what a thing is and what it may do, the **Logical** layer is the model a program reasons with, and the **Physical** layer is the tables, commands, tools and routes that carry it out. One rule, projected down, nothing lost ([commons 0033-kanon](../../spec-kit/specs/0033-kanon/spec.md)).

**In practice.** `commons/data` does it for data: governance models of a business domain, a logical schema made from them, and a physical schema for PostgreSQL, SQLite or DuckDB, with typed tables generated for each model. `commons/headless` does it for programs with no window: an action in governance, a command tree in the logical layer, and the command, tool and route a surface draws. `commons/archon` does it for what a machine, device, workstation or cloud account must be.

**How a library says so.** A library declares a table of its layers in the `kanon` field of its manifest, and [the Kanon library](../../kanon/) holds the type of that table and the import check that enforces it: a folder of one layer may import only what the table lets it.

**Where to see it.** The Models and Programs sections are documented layer by layer from the libraries' own values, with a trace from each element to what it is made into.

Governance is the only layer written by hand where the others are generated: change it, regenerate, and everything that follows is made again.

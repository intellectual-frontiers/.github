# Start here

Intellectual Frontiers Commons is a set of independent libraries that share one way of being built and checked. Pick the path that fits you; each ends with one small task that shows you the whole loop.

- [I am new to the repository](new-developer.md): clone the repository where you like, run one library's checks, and read one specification.
- [I want to change something](contributor.md): how a change is made, from the requirement to the test that proves it.
- [I want to set up my workbench](start-workbench.md): the programs, credentials, layout and gates a person, Claude Code or Codex needs before working here, checked by one command that installs only what a task needs.
- [I am an agent](agent.md): where the machine-readable pages are, and how to find the code for a question without reading everything.
- [I need to check the evidence](auditor.md): from a requirement to its enforcement, its test and the record of the run.

Three things to know before you read further:

1. **Everything is a library.** A folder of `commons/` with a manifest (`library.ts`), a `package.json` and its own specifications is a library; see the pages under Libraries. A library imports another by its package name, and each is proved by `bun run verify` in its own folder.
2. **Everything is built in layers.** Governance says what a thing is and may do, the logical layer is the model a program reasons with, the physical layer is what runs. This is [Kanon](concept-kanon.md).
3. **Every requirement is checked.** A specification states requirements, and a test names the requirement it proves. This is [Mizan](concept-mizan.md).

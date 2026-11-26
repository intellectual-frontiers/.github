# Add a dialect with an AI assistant

## When to use it

When Archon or Toolchain should reach one more tool (a package manager, a convergence tool such as Ansible or OpenTofu) and you can say what it guarantees and what it cannot.

## What to give the assistant

- `AGENTS.md`.
- The port a dialect fills: `commons/archon/spec-kit/specs/0004-archon-dialects/spec.md`.
- For a dialect of tools, how Toolchain chooses one: `commons/toolchain/spec-kit/specs/0003-toolchain-logical/spec.md`.
- The nearest existing dialect as the pattern: `commons/archon/dialect-ansible/` for a tool, and for a package manager a row of the table of `commons/package-managers/` (its spec 0005-package-managers-adapter).
- What the tool guarantees, from its own documentation, with the page.

## The prompt

```prompt
Read AGENTS.md. Add a dialect `archon-dialect-<tool>` for <tool>.

Use commons/archon/dialect-ansible/ as the pattern and the specifications named above as the rules. Work spec first.
1. State what the dialect guarantees as data: what it pins, how it checks what it installs, the scopes and platforms it reaches, whether it can build from source, and whether applying twice changes nothing. Claim only what its documentation says, mark anything not run as unproven, and say what it cannot do.
2. Take every command from the packaging ontology's reader. Do not write a command line in the dialect, and do not build a command as a string for a shell: a command is a list of words.
3. Keep the code in the dialect to its data and one call. If it needs logic, put it in the shared library and say so.
4. Declare the dialect as an instance in commons/archon/library.ts.
5. Write tests that run real programs with made-up names, and one test against the real ontology.

A dialect never imports another dialect or a plugin. Stop and ask me before you add anything that installs from source or needs rights it does not declare.
When you finish, run `bun run verify` in the new library and in commons/archon, then `bun run dev:check`, and show me the results.
```

## Check the result

- What the dialect says it guarantees is what the tool's documentation says, and anything it did not run is marked unproven.
- A fleet whose control the dialect cannot meet never gets it chosen: the test for the controls shows it.
- No command is a string a shell reads, and no name or version that begins with a dash reaches a command.
- `bun run verify` passes in the new library and in `commons/archon`, and `bun run dev:check` passes.

## Common mistakes

- **A guarantee that was not checked.** "Idempotent" is claimed only after the real tool was run twice; until then it is unproven.
- **A copied command.** A command written into the dialect drifts from the ontology; the dialect asks the reader of the ontology.
- **Source builds hidden.** A tool that can build from source says so, and is used only where the fleet approved it.
- **A dialect that reaches a sibling.** The layers check finds it; share code through a library that is no member of the family.

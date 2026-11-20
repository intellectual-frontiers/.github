# Work with an AI assistant

Most work here is done with an assistant beside you. These guides say what to give it, what to ask, and how to tell that what it made is right. They are short on purpose: the repository already holds the rules, and a good prompt points the assistant at them instead of repeating them.

## The habit

1. **Give it the rules first.** Attach `AGENTS.md` (the repository's entry point for any agent) and, for a question about the site, `llms.txt` from the site's root. Name the specification the work belongs to by its address, such as `specs/0027-commons-libraries.md#fr-001`.
2. **Ask for one small thing.** One library, one requirement, one failing check. A change an assistant makes in one step is a change you can read in one sitting.
3. **Work spec first.** Ask for the specification change before the code, then the code, then the tests that name each requirement with `proves([...])`.
4. **Make it prove the result.** The assistant is done when `bun run dev:check` passes (and `bun run repoctl check` for anything the checks of the repository hold), never when it says it is.
5. **Read the diff.** You are the reviewer. A file with `.auto.` in its name is generated: it is made by `bun run repoctl sync`, never edited.

## What never goes to an assistant

- A secret of any kind: a key, a token, a passphrase, the contents of an environment file.
- A pin you have not reviewed. A version and a hash are written in the packaging ontology by its owner, and nothing a tool proposed becomes one unreviewed.

## The guides

- [Add a library](ai-add-a-library.md)
- [Fix a failing check](ai-fix-a-failing-check.md)

Each has the same parts: when to use it, what to give the assistant, a prompt to copy, how to check the result, and the mistakes people make. The prompts use `<angle brackets>` for what you fill in.

These guides are held by the build: a path, a command or a specification that a guide names and that does not exist is a finding, so a prompt here cannot go stale without a test saying so.

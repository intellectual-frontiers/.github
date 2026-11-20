# Write a specification and its tests with an AI assistant

## When to use it

When you are about to change what a library must do, or add something it must do, and you want the requirement written down and proved before any code.

## What to give the assistant

- `AGENTS.md`.
- The library, and the specification the change belongs to, by its number.
- A specification of the same kind as the pattern, such as `commons/package-managers/spec-kit/specs/0003-package-managers-logical/spec.md`.
- What you want in plain words, and what you do not want.

## The prompt

```prompt
Read AGENTS.md. In the library `<library>`, change what it must do: <what you want, in plain words>. Do not do: <what you do not want>.

Work spec first, using commons/package-managers/spec-kit/specs/0003-package-managers-logical/spec.md as the pattern.
1. Write or change the specification: each requirement is one sentence with MUST or MUST NOT that a test can judge, numbered in order. Add acceptance scenarios and edge cases that each cite a requirement, assumptions, and open questions marked as open, never decided silently.
2. Add a row for each new requirement to the library's spec-kit/enforcement.tsv, and a row to spec-kit/registry.tsv if the specification is new.
3. Write a test for each requirement with proves(["<spec id> FR-nnn"], "what it shows", ...), using real files and real programs, with made-up names and bytes.
4. Only then write the code, and put `// Spec: <spec id> FR-nnn` on the first line of each source file that carries a requirement.

Do not weaken a requirement to fit the code, and do not add a line to a baseline. Show me the specification and the failing tests before you write the code.
When you finish, run `bun run verify` in the library and `bun run dev:check`, and show me both results.
```

## Check the result

- Read the specification alone, without the code: every requirement is one you would fail a build over, and none is a wish.
- The tests failed before the code and pass after it. Ask the assistant to show the failing run.
- `bun run verify` passes in the library: the specification check, the trace check and the tests all agree.
- An open question stays open and is marked, never answered by a guess.

## Common mistakes

- **The specification describes the code.** A requirement written after the code says what the code does, not what it must do.
- **A requirement no test judges.** "Should be fast" is a wish; "MUST answer within five seconds with the status 1" is a requirement.
- **Edge cases that cite nothing.** Each edge case cites the requirement it bears on.
- **The numbers move.** Requirements are numbered in order and never reused; a new one takes the next number.

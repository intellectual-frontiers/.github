# Turn a ticket into a specification with an AI assistant

## When to use it

When a ticket or a request describes what someone wants, in their words, and you need it as requirements that can be proved, before any code.

## What to give the assistant

- `AGENTS.md`.
- The text of the ticket or request, copied whole, with no secret in it.
- The library or libraries it touches, and the specification nearest to it.
- Where tracking lives: one parent ticket with a checklist, never a ticket for each task (`commons/spec-kit/specs/0034-archon/spec.md`).

## The prompt

```prompt
Read AGENTS.md. Below is a request. Turn it into a specification for the library `<library>`, and do not write any code.

<paste the request>

1. Say in two sentences what is being asked, and what is not. Quote the words of the request you rely on.
2. Write the specification the way commons/archon/spec-kit/specs/0004-archon-dialects/spec.md is written: numbered requirements with MUST or MUST NOT that a test can judge, acceptance scenarios and edge cases that cite requirements, assumptions, and open questions.
3. Where the request is silent or unclear, add an open question marked as open. Do not decide it for me, and do not invent a company fact.
4. List what is out of scope, and the smallest first slice that could be built and proved.
5. Do not open a ticket for each task. Give me the checklist lines to add to the one parent ticket.

Show me the specification and the questions, and wait.
```

## Check the result

- Every requirement is one you could fail a build over, and each traces to words in the request.
- The open questions are the real ones: the places where two reasonable people would build different things.
- The first slice is small enough to finish in one sitting.
- `bun run repoctl check` reports nothing for the new files, once they are in the repository.

## Common mistakes

- **Invented requirements.** A requirement that no word of the request supports is the assistant's, not the requester's; strike it or ask.
- **Questions answered silently.** An assumption that hides a decision is an open question in disguise.
- **A ticket for each task.** Tracking is one parent ticket with a checklist and comments.
- **Code first.** The specification is written, read and agreed before any code.

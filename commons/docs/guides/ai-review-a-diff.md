# Review a diff with an AI assistant

## When to use it

Before you push a change, or when you review someone else's: you want a second reader that checks it against the rules of this repository and the specification it claims to carry out.

## What to give the assistant

- `AGENTS.md`.
- The diff (`git diff origin/main`), and the specification the change cites by number.
- What the change is meant to do, in one sentence.

## The prompt

```prompt
Read AGENTS.md. Review the change below against the specification it cites, as a careful reader who wants to find what is wrong, not to approve it.

What the change is meant to do: <one sentence>.

<paste the diff>

Check each of these and say which you checked, with the file and line:
1. Does every changed behaviour trace to a numbered requirement, and does a test name that requirement with proves([...])?
2. Does a test run the real program or does it stand in for one? Does any test pass without being able to fail?
3. Is any file with .auto. in its name edited by hand, any version raised, any line added to a baseline, or any test skipped or loosened?
4. Does a source import across a layer, import a sibling by a relative path, or run a program or reach the network where its layer may not?
5. Is any secret, key, token or personal detail in the diff?
6. What does it do on an empty input, a name that begins with a dash, a file that is missing, and a second run?

Give me findings ordered by how much they matter, each with the evidence. If you find nothing, say what you checked and what you could not.
```

## Check the result

- Every finding names a file and a line, and you can see it there.
- Ask for the one finding you doubt to be shown again with the evidence; a finding that cannot be shown is dropped.
- Fix what is real, then run `bun run dev:check` and `bun run repoctl check`.
- A review that finds nothing has told you what it checked; read that list as carefully as a list of findings.

## Common mistakes

- **Asking for approval.** "Is this good?" gets a yes. Ask for what is wrong.
- **Reviewing a summary.** Give the assistant the diff and the specification, not your description of them.
- **Taking every finding as true.** A confident finding with no evidence is a guess; make it show the line.
- **Stopping at one pass.** A second review, from a fresh assistant given only the diff, finds what the first one's framing hid.

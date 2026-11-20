# I want to change something

A change is made capability by capability, and each step leaves something a check can find.

1. **Start from a requirement.** Say what must be true in the library's own specification (`commons/<library>/spec-kit/specs/`), as a numbered requirement (`FR-nnn`) in a sentence that can be tested. Mizan's format is checked by `bun commons/tools/mizan-check.ts`; see [Mizan](concept-mizan.md).
2. **Write the test that proves it.** A test names the requirements it proves with `proves(["<spec> FR-nnn"], "what it shows", ...)` from the test library, and the file that holds it starts with a `// Spec:` line. A requirement with no test is a finding.
3. **Write the code.** Layers say where it goes: governance (what a thing is), logical (the model), physical (what runs). A library's `about.ts` lists its folders and what each may import, and the import check holds that table.
4. **Record how it is enforced.** `enforcement.tsv` names who checks each requirement; the generators write what follows from the models.
5. **Check it.** `bun run dev:check` at the root while you work; `bun run verify` in the library before you push. Versions are raised at the release, never by hand on every change; see [the release loop](concept-release-loop.md).

**Your first small task:** pick a library, add a missing `TSDoc` comment to an export that the API reference shows without a description, and run `bun run verify` in that library.

**Prove only what your change can break.** `bun run repoctl prove --why` classifies your change, runs the proofs it needs and says why each skipped proof is safe; see [proof by blast radius](proof-by-blast-radius.md).

# Where does X live?

| What you are looking for | Where it is |
| --- | --- |
| A library | `commons/<name>/`, with a manifest `library.ts`, a `package.json`, an `about.ts` and a `spec-kit/` of its own |
| What a library promises | its `spec-kit/specs/NNNN-slug/spec.md`, numbered from 0001 in each library |
| What belongs to commons as a whole | `commons/spec-kit/` |
| What proves a requirement | the test that names it with `proves([...])`, in the library's `suite/` |
| Who checks a requirement | the row of `enforcement.tsv` in the library's `spec-kit/` |
| A data model | `commons/data/models/<name>/mod.ts` (governance); its typed tables are `commons/data/sql/typed/models/<name>.auto.ts`, generated |
| A command-line program | a library of its own, built on `commons/headless/` (`commons/repoctl/` is the example) |
| The layers of a library and what each may import | `about.ts` (folders) and the `kanon` table of its manifest |
| An ontology or a standard's vocabulary | `commons/ontology/`; its generated forms are in `commons/generated/` |
| The tools that check the repository | `commons/tools/` and `commons/libraries/src/` |
| This site's generator and its configuration | `commons/docs/` and `commons/docs.config.ts` |
| Pages people write for this site | `commons/docs/guides/` |

Files with `.auto.` in their name are generated and are never edited: change what they are made from and generate again.

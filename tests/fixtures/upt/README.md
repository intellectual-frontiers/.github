# upt's tables, as fixtures

`os.tsv` and `tools.tsv` are the two tables of the README of [sigoden/upt](https://github.com/sigoden/upt) (Universal Package-management Tool), copied as data, with the column names and
the `$pkg` placeholder kept. `upt` is dual-licensed under MIT or Apache-2.0, at the user's option; its copyright belongs to its authors. They seed `commons/ontology/supply-chain/packaging/`
(0002-packaging), and a test checks that nothing in them is missing from the ontology. One identifier in `upt`'s README, `oubes` (among the Fedora family), is not an `os-release` ID this
repository recognises and is left out of the ontology; it is kept here as `upt` has it.

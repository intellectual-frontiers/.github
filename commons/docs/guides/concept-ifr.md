# Releases (IFR)

Identity, version, edition, rendition and release are different things, each with its own place in a typed ontology, Intellectual Frontiers Releases (IFR, `ifr:`) ([commons 0026-works-versioning](../../spec-kit/specs/0026-works-versioning/spec.md)).

**One scheme for each kind of work.** Software, libraries, command-line interfaces, ontologies and schemas use Semantic Versioning; published prose uses the commit-date edition; data uses a snapshot date and a digest with a Semantic Version for its schema; a controlled document uses an integer revision and an approval record; a specification has no version.

**Every published version** names its commit and its Git tree hash and is immutable. A release is a signed annotated Git tag, `<work>-v<version>`, and the ledger of releases is derived from the tags. A version is raised by the capability that changes the work, with its declared impact, and the release notes are generated from the capabilities closed since the last tag. Nothing published is silently removed.

See [the release loop](concept-release-loop.md) for the command that does it.

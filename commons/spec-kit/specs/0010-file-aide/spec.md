# Feature Specification: File Aide

**Spec ID:** 0010-file-aide
**Status:** Draft
**Owner:** if
**Domain:** commons
**Part of:** 0005-typescript-runtime

**Input:** One library every Intellectual Frontiers harness uses to say what a store of files holds and to reach it: a store's layout (its paths, their names and the files under them) written once as TypeScript algebraic types, a few drivers behind one small interface (memory, a folder of the computer, and an S3-compatible bucket), checks of what a store holds against its layout, a small SQL-like query language compiled into a function that walks a store as `fd` walks a folder, and a few recipes for writes that need more than one step. It is SQL Aide's peer (0009-sql-aide) and is kept thin: a model of paths, a client of stores and a query compiler, and not a file system with handles, streams, locks or caches. Its name is Intellectual Frontiers Commons File Aide.

## The library

- **FR-001**: The library MUST be kept in `commons/ts/data/file-aide/`, in the package `commons/ts/data/package.json` describes, and MUST be built on IFC TypeScript (0005-typescript-runtime) as SQL Aide is (0009-sql-aide FR-001): its errors as values, exhaustive matching, brands and hashes are the kernel's, its tests register through `runtime/test.ts`, the TypeScript 7 compiler checks it with IFC TypeScript's options, and the pinned Bun and Node 26 or later run it as written, with no build step.
- **FR-002**: The package MUST have no `dependencies`. A file of the library MUST import only files of `commons/ts/data/file-aide/`, the kernel of IFC TypeScript and SQL Aide's public entry point (`commons/ts/data/sql-aide/mod.ts`); only the files under its `runtime/` folder MAY import IFC TypeScript's runtime; none imports a module of a host or of a vendor.
- **FR-003**: The library MUST use only syntax a runtime can erase, MUST NOT use `any` or a non-null `!`, MUST return a failure it expects as a value (the kernel's `Result`) and MUST handle a tagged union with a `switch` that fails to compile where a case is left out (the kernel's `absurd`). It MUST NOT make code from text at run time: no `new Function`, no `eval`, and no import of source it wrote.
- **FR-004**: What a person would configure MUST be a typed TypeScript value: the library MUST NOT read a YAML, XML, TOML or JSON file as its configuration and MUST NOT find a layout by scanning directories. The ignore files of FR-027 and FR-028 are data of the tree being walked, not configuration of the library.
- **FR-005**: Every file of the library MUST begin with a comment that says `@module`, and every declaration it exports MUST carry a TSDoc comment. The comment of a layout's entry MUST be its description (FR-009), read by a tool into a generated documentation map (a file with `.auto.` in its name) that fails where the map is not what the source makes, as 0009-sql-aide FR-005 says for a model.

## The algebra

- **FR-006**: A segment MUST be one case of a tagged union that carries the TypeScript type of its values: a literal; an enumeration of literals; a slug; a ULID; a UUID; an integer, with its width where it is padded; a date or a time in a stated format, alone or as a `name=value` partition; a digest, with its algorithm and length; a fan-out of the first characters of another segment of the same path; a file name, any one element of a path; the rest of a path, one or more elements, which MAY be only the last interpolation of a pattern and MAY name first elements it does not take; and a custom segment, whose parse and format the caller gives and whose type MAY be branded. No segment but the rest of a path holds a `/`.
- **FR-007**: A path pattern MUST be written with the tagged template `path`, whose interpolations are segments and whose text is literal. A segment MAY share an element of a path with literal text and other segments (`${slug}.${extension}`), but two segments side by side with no literal between them MUST NOT both have a variable length. A pattern MUST give `parse`, from text to a key or a failure, and `format`, from a key to text, such that `parse(format(k))` is `k` for every key and `format(parse(t))` is `t` for every text `parse` accepts; the tests MUST state both laws as properties.
- **FR-008**: The type of a pattern's key MUST be computed from its segments, in order, by mapping over the tuple of its interpolations, so that a key that lacks a field, has one more, or holds a value of the wrong type fails to compile. It MUST NOT be computed by parsing a template literal type.
- **FR-009**: An entry MUST be a value with a name, a path pattern, a content codec (bytes, UTF-8 text, the kernel's JSON5, or a decoder and an encoder the caller gives that return a `Result`), a description and an owner. The library MUST NOT carry a codec of any other format.
- **FR-010**: A layout MUST be a union of entries under a root, and MAY mount another layout under a literal prefix. Each segment MUST give witnesses, a few values of its own, and making a layout MUST fail, as a value that names both entries and the path, where a path formatted from one entry's witnesses is matched by another entry's pattern. Matching a path against a layout MUST give exactly one entry and its key, or `unmatched`.
- **FR-011**: A path that a store holds and that no entry matches MUST be given as an `unmatched` value with its path and metadata wherever a store is listed, read or checked, never thrown and never left out without saying so.

## Names

- **FR-012**: A path MUST be a typed value relative to its root: elements separated by `/`, none empty, `.` or `..`, no leading `/`, and its text in Unicode's normalization form C. A path that would leave its root MUST be refused before any store is reached.
- **FR-013**: The values of a layout's segments MUST be checked against the limits of the stores the layout is used with: a key of at most 1,024 bytes of UTF-8 for S3, the element and path lengths of the computer for a folder, and the reserved names and characters of Windows where Windows is a target. Where a store folds case, two paths that differ only in case MUST be reported.

## Stores

- **FR-014**: A store MUST be a value that implements one interface, every operation of which returns a `Result`: `head` (size, time modified, version tag, media type), `get` (the whole file or a range of bytes), `put` (bytes, with a condition, FR-016), `delete`, `copy`, and `list` (one page of the entries under a prefix, with or without a delimiter, after a key, never more than the caller asked, with a continuation).
- **FR-015**: A store MUST state what it can do as a union the compiler knows (conditional write, range read, rename, versions, server-side copy, listing by delimiter, time modified, presigned address). Asking for something a store lacks MUST fail to compile where the store's type is known, and MUST otherwise be refused with a value that names what is lacking.
- **FR-016**: `put` MUST take one condition of three: none, only where nothing is there, or only where the file is at a version given. A store MUST NOT claim conditional writes unless it makes the condition and the write one atomic step. A writer that loses a race MUST be answered `conflict`, and nothing is written.
- **FR-017**: The library MUST provide three drivers: `memory`; `posix`, a folder of the computer reached through IFC TypeScript's runtime, which writes a file to a temporary file in the same folder and renames it so that no reader sees part of a file, makes "only where nothing is there" an exclusive create, and removes the folders a delete leaves empty, up to its root; and `s3` (FR-029). No driver writes an object or a file to stand for a folder: a folder is only the prefix of the files under it.
- **FR-018**: A failure MUST be one case of a union (not found, conflict, refused, unavailable, invalid) that names the store and the path. It MUST NOT hold a credential, a signature, a presigned address or the value of an `Authorization` header.

## Queries

- **FR-019**: A query MUST be a value of a tagged union with these parts and no others: `select` (fields, or all); `from` (an entry of a layout, or a root with no layout); `where` (`and`, `or`, `not`, `=`, `<>`, `<`, `<=`, `>`, `>=`, `in`, `between`, `glob`, `regex` and `within` a duration); `order by key`; `limit`; `with` (the options of FR-024, FR-025, FR-027 and FR-028); and `scan`, which permits reading everything under `from` (FR-023). There MUST NOT be joins, aggregates, subqueries or statements that write.
- **FR-020**: A typed builder MUST make the query value. Its fields MUST be the key fields of the entry and the metadata of a file (`path`, `name`, `extension`, `size`, `modified`, `version`, `depth` and `hidden`; and `type`, file or folder, where `from` is a root with no layout); a field the entry lacks, or a value not of its field's type, MUST fail to compile; and the type of a row MUST be computed from `select`.
- **FR-021**: The text of a query MUST parse into the same value, given the layout or the root it is for, as a `Result` whose failure names the line and the column, including for a name the layout lacks. Its literals MUST be strings, numbers, sizes (`B`, `KiB`, `MiB`, `GiB`) and durations (`s`, `m`, `h`, `d`). A text query and the builder's query that is the same value MUST give the same rows.
- **FR-022**: A query MUST be planned before it runs, and its plan MUST be a value that divides its `where` into three: the prefixes the store lists (leading key segments bound by `=`, several prefixes for `in`, and a start and a stop key for a range on a segment whose text sorts as its values do); the folders left unlisted because the value of their segment cannot satisfy the `where`, listed by delimiter where the store can; and the tests run on each entry listed. `explain` MUST return the plan as data, saying whether it reads everything under its root.
- **FR-023**: A query whose plan reads everything under its root MUST be refused unless it carries `scan`.
- **FR-024**: A plan MUST be compiled once into a function, made only of composed closures, from a store to an `AsyncIterable` of typed rows. The function MUST list folders in parallel up to a number the caller MAY set with `with` and whose default the library states; MUST stop listing once `limit` is reached or the caller stops reading; and, with `order by key`, MUST give rows in the byte order of their normalized paths in every store. Without `order by key`, no order is promised.
- **FR-025**: `glob` MUST be matched by the library's own matcher (`*`, `**`, `?`, `[...]` and `{a,b}`), in time linear in the length of the path. `regex` MUST be ECMAScript's, MUST be allowed only where the query's `with` allows it, and MUST refuse a pattern longer than a length the library states. Times MUST be compared in UTC and sizes in bytes.
- **FR-026**: A query MUST NOT read the contents of a file: its fields are a path's key and a file's metadata.

## Ignore files

- **FR-027**: A query MUST by default leave out what the `.gitignore` files of the tree being walked leave out, and `.git/info/exclude` where its root is in a Git working tree, with Git's rules for patterns, negation, anchoring, patterns that match only folders, and a deeper file taking precedence over a shallower one; and MUST leave out `.git/` itself. Entries whose name begins with `.` MUST be left out by default. The caller MUST be able to turn each of the two off with `with`, in the builder and in the text.
- **FR-028**: A `.faignore` file MUST be read as a `.gitignore` is, with the same syntax and precedence, in every store, for a tree that is not in Git; where both are in one folder, both apply. It MUST be on by default and turned off by the same option as FR-027. The ignore files read MUST be those of the folders from the root to each prefix the plan lists (FR-022), read from the store being walked and nowhere else.

## S3

- **FR-029**: The `s3` driver MUST speak the S3 protocol through `fetch`, with no client of a vendor: Signature Version 4 made with the kernel's SHA-256 and the platform's `crypto.subtle` HMAC; path-style and virtual-hosted addressing; `ListObjectsV2` read with the kernel's XML reader; `If-None-Match: *` and `If-Match` for conditional writes; `Range` for range reads; and `x-amz-copy-source` for copies. It MUST be made at run time from a connection (endpoint, region, bucket, prefix, addressing style) and credentials the caller gives, and MUST NOT read the environment itself.
- **FR-030**: The `s3` driver MUST retry an answer the protocol marks as one to retry (500, 503, `SlowDown`, a broken connection) with a backoff, up to a number of tries the caller MAY set; MUST correct for a clock that is out by the server's `Date` once, on `RequestTimeTooSkewed`; and MUST NOT retry a conditional write whose outcome is not known without first reading the object's version to learn whether it was written.
- **FR-031**: The library MUST provide, under `runtime/`, a server of the part of S3 that FR-029 uses, over a folder, listening on `127.0.0.1`, which the conformance suite (FR-035) runs the `s3` driver against.

## Checks

- **FR-032**: `check(layout, store, rules)` MUST list a store under its root and report as data the unmatched paths (FR-011), the names that break FR-013, the files whose contents fail their entry's codec where the caller asks for contents to be read, and the findings of rules across entries that a layout gives as typed values (every edition has one manifest; every file a manifest names is present with its digest). Its findings MUST be reportable as TAP version 14 through SQL Aide's TAP emitter (0009-sql-aide FR-031).

## Recipes

- **FR-033**: A recipe MUST make a plan of steps (put where nothing is there, put where at a version, copy, delete) as a value, which by default is written out for a person to read and applied only when asked. Applied, its steps MUST run in order and stop at the first failure, which says which steps ran. A query's rows MAY be what a recipe acts on.
- **FR-034**: The library MUST provide four recipes, each with a case for every driver that fails to compile where one is left out: write once; a file with a manifest beside it (the bytes, then a manifest holding their digest and size, each written only where nothing is there); an edition published whole (every file, then one pointer written last, only where it is still at the version read); and an erasure (the bytes deleted and a tombstone written in their place).

## Tests

- **FR-035**: One conformance suite MUST pass on every driver: each operation, each condition and two writers racing, the edges of a page, ranges, names in many scripts, and the same queries giving the same rows on `memory`, on `posix` and on the server of FR-031. A store that fails on purpose (a write cut short, a page that fails, a listing that is stale) MUST show that no part of a file is ever read and that every failure is a value.
- **FR-036**: A test against a real S3-compatible provider MUST run only where the caller has set its credentials, under a prefix made for the run and removed after it, and MUST otherwise say it was skipped. Where `fd` is installed, a query on a root with no layout MUST give the same paths as `fd` with the same filters, on a tree made for the test.

## With SQL Aide

- **FR-037**: The library MUST give SQL Aide a column domain for a reference to a file of an entry (its path, version tag and digest), typed by the entry, and MUST make a query's rows a source of SQL Aide's source-adapter hook (0009-sql-aide FR-034), so that a listing lands in a relation and SQL does what this query language does not.

## The layout that accepts it

- **FR-038**: The IF Renditions File System (IFRFS), the layout of the folder erga's `publication sync` fills (erga's 250-ergactl-publication), MUST be modelled in `commons/ts/data/ifrfs/` with File Aide's public entry point (`commons/ts/data/file-aide/mod.ts`) alone, and MUST accept the library: `README.md` at its root, whose first line is the marker the sync writes; each work's files at `<kind>/<slug>/<rest>`, the kind one of an enumeration, the slug lowercase words joined by hyphens, and the rest any path of names below the work's folder but `issues.d/`; and each work's issues at `<kind>/<slug>/issues.d/<id>.json5`, the id a ULID. Its tests MUST run on a synthetic tree committed beside them and on broken copies of it, on every driver built, under Bun and Node, and a phase of the library is done only where IFRFS passes what that phase adds. IFRFS MUST NOT import anything of erga, and erga is not needed to test it.

## Out of scope

- Git as a store, and a networked file system as a driver of its own: a mounted one is a folder (FR-017).
- Joins, aggregates and statements that write in the query language (FR-019); SQL Aide does them (FR-037).
- Reading the contents of a file in a query (FR-026).
- Moving a store from one layout to another, lifecycle rules, bucket policies, a command line and diagrams.
- Handles, streams, watching, locks and caches.
- Multipart uploads (OQ-1).

## Edge cases

- Two entries, `${slug}.pdf` and `${name}.${extension}`, can match `a.pdf`: the layout is not made, per FR-010.
- A bucket holds a file its layout does not know: it is listed and checked as unmatched, per FR-011 and FR-032.
- A key's value holds `..` or a `/`: the path is refused before any store is reached, per FR-012.
- A work's file is at `site/index.html` below its folder: it is matched by the rest of the path, and `issues.d/<id>.json5` is matched as an issue and not as a file, per FR-006 and FR-038.
- A folder's `README.md` lacks the sync's marker line: IFRFS's check reports it, per FR-032 and FR-038.
- Two slugs differ only in case and one store folds case: the check reports both, per FR-013.
- Two writers put the same new file at once: one writes and the other is answered conflict, per FR-016.
- A process dies while writing to a folder: no reader sees part of the file, per FR-017 and FR-035.
- A provider's error message holds the signed address: the failure does not, per FR-018.
- A query tests only `size`: it is refused unless it carries `scan`, per FR-023.
- A query with `limit 10` runs over a million objects: listing stops once ten rows are given, per FR-024.
- `regex '(a+)+$'` is in a query whose `with` does not allow it: refused, per FR-025.
- A deeper `.gitignore` says `!keep.log` where a shallower one ignores `*.log`: `keep.log` is listed, per FR-027.
- A bucket has a `.faignore` at its root: what it names is left out of every query, per FR-028.
- The computer's clock is out by an hour: the request is signed again once with the server's time, per FR-030.
- A conditional write's connection breaks: the driver reads the version before it writes again, per FR-030.
- No credentials for a real provider are set: those tests say they were skipped and the rest run, per FR-036.
- The same `order by key` query runs on a folder and on a bucket: the rows come in the same order, per FR-024.

## Assumptions

- A harness that uses the library runs Bun or Node, as for SQL Aide; IFC TypeScript and SQL Aide are in the same checkout and are imported by a relative path.
- The library is released as SQL Aide is, and with it (0009-sql-aide OQ-2).
- The S3-compatible providers it is used with honour `If-None-Match: *` and `If-Match` on a write; a provider that does not is not given the conditional-write capability (FR-015, FR-016).
- Git's ignore rules are those of the `gitignore` manual page; `fd`'s behaviour is that of the version the tests name.
- A single `PUT` carries a file of up to 5 GiB, which covers the files IFRFS holds.
- IFRFS's layout is not confidential, by the owner's decision of 2026-11-15; it is stated here so that erga can use the model when it moves to File Aide, and File Aide is decoupled from erga until then.

## Open questions

- **OQ-1**: Whether multipart uploads are added, and from what size.
- **OQ-2**: Whether presigned addresses and the versions of a file are given before a harness asks for them.
- **OQ-3**: Whether a query may later read the fields of a manifest, which would make it read contents.
- **OQ-4**: How many segments and entries a layout can have before the compiler's work on its key types is too slow.

## Key entities

- **Segment** - one typed part of a path, and the TypeScript type of its values.
- **Path pattern** - literal text and segments, with `parse`, `format` and a computed key type.
- **Entry** - a path pattern with a content codec, a description and an owner.
- **Layout** - a union of entries under a root.
- **Store** - a value that implements the interface, with what it can do as a type.
- **Driver** - `memory`, `posix` or `s3`.
- **Query** - a value of `select`, `from`, `where`, `order by key`, `limit`, `with` and `scan`.
- **Plan** - the prefixes, the folders left unlisted and the tests of a query.
- **Ignore file** - a `.gitignore` or a `.faignore` of the tree being walked.
- **Check** - a layout's rules run against a store, with findings as data.
- **Recipe** - a plan of steps for a write that needs more than one.
- **IFRFS** - the IF Renditions File System, the layout that accepts the library.

## Success criteria

- **SC-001**: In `commons/ts/data`, `bun run verify` and `bun run test:node` pass with the library's tests among them, on a computer with Bun and Node.
- **SC-002**: IFRFS's tree gives the same rows for the same queries on `memory`, `posix` and the local S3 server.
- **SC-003**: A query with its leading keys bound has a plan that does not read everything under its root, and its `explain` says so.
- **SC-004**: A query on a root with no layout gives the same paths as `fd` with the same filters, and takes no more than a few times as long.
- **SC-005**: The library stays near 3,000 lines without its tests, its query language near 700 of them; this is guidance to keep it thin, not a limit.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No confidential company fact is asserted here: IFRFS's layout is public by the owner's decision
- [x] Every open item is marked, not silently decided

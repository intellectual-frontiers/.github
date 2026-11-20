# Feature Specification: Formats

**Spec ID:** 0001-formats
**Status:** Draft
**Owner:** if
**Domain:** commons

**Input:** The file and wire formats that every library of commons and every harness needs, in a package of its own that depends on `core` alone: JSON5, YAML, TOML, XML, CSV, base64 and hexadecimal, ASN.1 DER, CBOR, archives, PNG and ICO, TypeScript literals, glob patterns, semantic versions, media types and HTTP headers, read and written in pure code with no outside package. It is the second library lifted out of `commons/ts` (commons 0032-libraries-by-concern), the one the cryptography, the telemetry and the compliance libraries read their data with.

## Text formats

- **FR-001**: Formats MUST read JSON5 1.0 (comments, trailing commas, unquoted ECMAScript keys, single-quoted and continued strings, hexadecimal, `Infinity`, `NaN`, a leading `+`, a leading or trailing decimal point) into a typed `Json` value, or say the line and column where the text stops being JSON5; MUST read every JSON text as `JSON.parse` does; MUST define a key named `__proto__` as a member, never as the prototype; and MUST write a value as a person edits it (a `//` comment at its head, bare keys where they can be, two spaces of indent, a comma after every member, a short list of plain values on one line) that it reads back as the same value, `-0`, `NaN` and the infinities included.
- **FR-002**: Formats MUST read YAML 1.2 as data: block mappings and sequences (a sequence at its key's indentation, a mapping begun on a dash), flow collections over lines, plain scalars folded over lines, single- and double-quoted scalars with every YAML 1.2 escape, literal and folded block scalars with their indicators, comments and one document; resolve plain scalars by the core schema or, asked, the failsafe one; refuse, with the line, column and reason, anchors and aliases, tags, complex keys, directives, a second document, a key given twice and a tab for indentation; and write a value as block YAML it reads back as the same value.
- **FR-003**: Formats MUST read TOML 1.0.0 whole (bare, quoted and dotted keys; tables, arrays of tables and inline tables; the four kinds of string; decimal, hexadecimal, octal and binary integers; floats with `inf` and `nan`; the four kinds of date and time, kept as their text with their kind) and hold to its rules (no key or table defined twice, no inline table or static array extended, no table made by dotted keys reopened by a header), refusing an integer JavaScript cannot hold exactly rather than rounding it and saying the line and column of what is wrong; and MUST write a table as TOML it reads back as the same table.
- **FR-004**: Formats MUST write XML from a typed tree with every value escaped and the characters XML 1.0 forbids removed, and MUST read XML (elements, attributes in either quote, the five named entities and character references, CDATA, comments, processing instructions, the declaration) into the same tree, checking that each element is closed by its own name and each attribute is given once, saying the line and column of what is wrong, and refusing a document type with an internal subset so that no entity is ever expanded.
- **FR-005**: Formats MUST read and write CSV by RFC 4180 (any one-character separator, quoted fields with doubled quotes and line breaks, CRLF or LF), refuse a quote in an unquoted field and a quoted field left open with the line and column, give records by a header's names (refusing a record of another length), and read back what it writes.
- **FR-006**: Formats MUST write data as TypeScript object literals and read back exactly that subset without running it, as a `Result`.
- **FR-007**: `tsLiteral` MUST take any value whose type is shaped as JSON, checked by the compiler at every depth: an interface or a type with no index signature, optional properties (left out where `undefined`), readonly arrays and tuples; and MUST NOT compile for a value holding a function, a `Date`, a `Map`, a `bigint`, a symbol, `unknown`, or `undefined` anywhere but as an optional property's value.

## Binary formats

- **FR-008**: Formats MUST encode and decode base64 and base64url by RFC 4648 (base64url written without padding and read with or without it), refuse rather than skip what is not of the alphabet asked for, and read back what it writes.
- **FR-009**: Formats MUST encode ASN.1 DER (X.690) in its one form (minimal lengths and two's complement integers, negative ones too; OIDs; SEQUENCE; a SET OF sorted; strings, booleans, NULL, explicit and implicit tags) and read it as a `Result` that says the byte where the input stops being DER (an indefinite or non-minimal length, a high tag number, content past the end, a non-minimal integer or OID arc), reading back integers, OIDs and nested structures as written.
- **FR-010**: Formats MUST write archives byte for byte from the files alone (a ustar tar, a gzip of stored blocks, a zip of stored entries, in the byte order of their paths, with fixed times and modes); where asked, a zip of deflated entries (method 8, through the web standard `CompressionStream("deflate-raw")`, an entry stored where deflate would not shrink it), the same bytes for the same files on one runtime and the same files unzipped on every runtime (the deflaters of Node and Bun may choose different bytes, and do); and read them (tar with pax and GNU long names, gzip and zip entries stored or deflated through `DecompressionStream`), checking each header checksum, CRC-32 and size, and refusing every path that is absolute, has a `..`, `.` or empty segment, a backslash, a drive letter or a NUL.
- **FR-011**: Formats MUST read a tar archive as a stream (`untarStream`), as `@std/tar`'s `UntarStream` does: a `TransformStream` from the archive's bytes, gzipped or not, to its entries, each with its header and its bytes as a stream, with the checks of FR-010 on every header and path, so an archive larger than memory can be read.
- **FR-012**: Formats MUST read PNG of every colour type and bit depth PNG defines (palette with `tRNS`, greyscale and RGB with `tRNS`, 16-bit samples), with every filter type, into 8-bit RGBA; check every chunk's CRC; refuse, by a typed error, a wrong signature, truncation, malformed headers, an out-of-range palette index, an unknown critical chunk and interlacing; refuse a picture of more than 2^24 pixels before allocating or inflating anything, and stop inflating at the size the header declares; write 8-bit RGB and RGBA PNG that it reads back as the same pixels; and give ICO files of PNG frames, resizing (Lanczos, on premultiplied alpha), compositing, thumbnail sizes, colour parsing and WCAG luminance.

- **FR-013**: Formats MUST write bytes as lower-case hexadecimal, two digits each (`toHex`), and read hexadecimal text as bytes (`fromHex`), refusing an odd length or a character that is not a digit, so that the digests of `crypto` are written through it.
- **FR-014**: Formats MUST read CBOR (RFC 8949: the definite-length forms of every major type, tags, the simple values and half, single and double floats) into a `Result` whose error says what and at which byte (an indefinite length, a reserved value, text that is not UTF-8, a map key that is neither an integer nor a text string, a key given twice, nesting deeper than 64 levels, bytes left over), and write it in the core deterministic encoding (RFC 8949 §4.2.1: the shortest heads, definite lengths, map keys sorted by their encoded bytes), so that the same value is the same bytes every time (cbor, taken with COSE and WebAuthn from 0014-webauthn FR-001).

## Names and patterns

- **FR-015**: Formats MUST parse, print, order and bump semantic versions by semver.org 2.0.0 (§11 precedence, the build ignored, a leading `v` accepted) and compare the dotted versions programs print, part by part (`compareDotted`, `atLeast`, `versionIn`).
- **FR-016**: Formats MUST read npm's version ranges (`node-semver`'s grammar): comparators (`<`, `<=`, `>`, `>=`, `=`), sets of them joined by spaces, sets joined by `||`, hyphen ranges, x-ranges (`*`, `x`, `X`, a missing part), tilde (`~`, `~>`) and caret (`^`) ranges, each made into comparators exactly as `node-semver` documents them (`^1.2.3` as `>=1.2.3 <2.0.0-0`, `~0.2` as `>=0.2.0 <0.3.0-0`, `1.2.3 - 2.3` as `>=1.2.3 <2.4.0-0`); a range that is not of the grammar MUST be an error as a `Result`. `satisfies(version, range)` MUST hold where the version satisfies every comparator of one set, and a pre-release version MUST satisfy a set only where one of its comparators names a pre-release of the same major, minor and patch, unless pre-releases are asked for.
- **FR-017**: Formats MUST turn a path glob into a regular expression and match paths with it as `@std/path`'s `globToRegExp` does (`*`, `**`, `?`, character classes, `{a,b}` alternatives, a leading `!` refused where it cannot mean anything), on `/` paths (as a `Result`, a leading `!` refused; `?` and `[!…]` never matching `/`, where `@std/path`'s can), and `fs.expandGlob` MUST give the files of a folder that a glob matches, in byte order.
- **FR-018**: Formats MUST give the media type of a path or an extension from one table of the types the harnesses serve and publish, `charset=UTF-8` with every textual type, and `application/octet-stream` where the extension is not known.
- **FR-019**: Formats MUST read the `Link` header (RFC 8288) into its links and find a `rel`, read `Retry-After` as seconds or an HTTP date, and say which methods are safe (RFC 9110 §9.2.1).

## The package

- **FR-020**: Formats MUST depend on `core` alone, MUST import nothing outside its own files, MUST name no host global, and MUST be published as compiled modules with their declarations as `@intellectual-frontiers/formats`, with an entry for the package (`.`) and one for each of its modules (`./yaml`, `./der`, ...), each with its `types` (commons 0032-libraries-by-concern FR-005, FR-013), so that it runs on Bun, on Node 26 and in a browser with no build step.

## Acceptance scenarios

1. **Given** a YAML front matter, **When** it is read and written as JSON5, **Then** the same value comes back, per FR-001 and FR-002.
2. **Given** a DER structure of integers, OIDs and sets, **When** it is encoded and decoded, **Then** the same structure comes back and a malformed input is named at its byte, per FR-009.
3. **Given** the packed package installed under `node_modules`, **When** Node 26 and Bun import `@intellectual-frontiers/formats` and `@intellectual-frontiers/formats/yaml`, **Then** both give the same parse, per FR-020.
4. **Given** a consumer that imports every entry of the package, **When** it is type-checked against the installed tarball, **Then** it compiles, per FR-020.

## Out of scope

- Digests, signatures and encryption, which use these formats: `crypto` (commons 0032-libraries-by-concern FR-002).
- The reading of files from a disk: `system`.

## Edge cases

- A YAML or TOML document with a refused construct: refused with its line and column, per FR-002 and FR-003.
- Hexadecimal of odd length: refused, per FR-018.

## Assumptions

- ECMAScript 2024 and the web standards are all that the code needs (`CompressionStream` and `DecompressionStream` for gzip and deflate).

## Open questions

- None.

## Key entities

- **Format** - a text or binary form, read into a typed value or an error with its place, and written back deterministically.

## Success criteria

- **SC-001**: A harness reads and writes its files with these and with no outside package.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided

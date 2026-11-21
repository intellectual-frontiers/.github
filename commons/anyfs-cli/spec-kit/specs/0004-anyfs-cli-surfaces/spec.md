# Feature Specification: AnyfsCli surfaces

**Spec ID:** 0004-anyfs-cli-surfaces
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** The program: its openers, its verbs on Headless, its command line, tool server and REST description. The `anyfs` program: POSIX-style access to any AnyFS store (ls, cat, cp, rm, find, grep, diff) and the bridge verbs (sync, bisync, mirror, check) from the command line, a tool server and a REST description, with every operation saying how it was carried out and every destruction a plan first.

## Requirements

- **FR-001**: The program MUST open a store in memory (one for each name for a run), a store of a folder, and a store on a host reached by SSH, and MUST give a place of any other kind the ending `E-PLACE-UNAVAILABLE` where no opener for it is in the configuration.
- **FR-002**: The openers of the configuration MUST take the place of the program's own for their kind and add the kinds it lacks, so that `anyfs-git`, `anyfs-sql` and a bucket plug in through the configuration alone; and the store on a host MUST speak only through the safe executor of Headless, whose first contact with a host is the verb `trust-host`.
- **FR-003**: The world of the process MUST open each place once for a run, resolve a plain path to the root of its store and the path inside it, read standard input and write standard output as bytes, and keep the state of the program in its own folder.
- **FR-004**: The configuration MUST be found by `--config FILE`, else the first `anyfs.config.ts` from the working folder up to the root of the checkout, else the user's; its absence MUST NOT be a problem, and its failure to load or its invalidity MUST be a typed problem with its code.
- **FR-005**: A word MUST be bound to the store it points into by parsing it as a location, opening the store of its place, attenuating the store of a read-only mount so that nothing can change it, and making the POSIX view of the store with the path inside it resolved; a word that is no place MUST end the verb with a usage error and a store that cannot be opened with an environment error.
- **FR-006**: Every verb MUST be declared once, with its words, options, operands and examples, and its action traits MUST come from the table `VERBS`; two options of a verb MUST NOT share a short letter, and the model of the program MUST pass the conformance rules of Headless.
- **FR-007**: Every verb that works through the POSIX view MUST take `--explain`, which says how each operation it uses would be carried out on each store it names (native, emulated with a risk, or refused) and does nothing else, and `--strict`, which ends the verb with `E-STRICT` where an operation was emulated by a means that can lose or change what was meant.
- **FR-008**: `ls`, `cat`, `stat`, `head`, `tail`, `find`, `du`, `tree`, `grep`, `diff` and `sha256sum` MUST only read; `cat`, `head` and `tail` MUST write the bytes of a file as they are, to the port of standard output, and write none where the output is the one JSON document; a name that is not there MUST end a verb with `E-FILESYSTEM` and the exit `findings`.
- **FR-009**: The tool server MUST serve the verbs the held tier sees, `ANYFS_TIER=reader` MUST show only the verbs that read, and a destructive verb from the tool server MUST be a preview and never an apply, since the channel gives no confirmation.
- **FR-010**: A transfer MUST take its rails from the command line and the configuration (include and exclude globs, a maximum of files and bytes, a maximum object size, a refusal of a lossy plan), MUST plan a directory transfer through the bridge, MUST apply only the plan whose hash `--plan-hash` names, and MUST end with `E-PLAN-STALE` where the plan made now has another hash.
- **FR-011**: `put`, `mkdir`, `touch`, `cp`, `mv` and `rm` MUST change a store through the view and MUST change nothing under `--dry-run`; a file copy MUST be one read and one write checked against the digest of the bytes read, a directory copy or a cross-store move MUST be a plan of the bridge, and `rm -r` MUST list the names it would remove with the hash of that list, which `--plan-hash` pins.
- **FR-012**: `sync` MUST plan first and print the plan with its hash, MUST allow deletes only up to `--max-deletes`, MUST apply only with `--yes` (which Headless asks of a destruction) and the plan hash where given, and `check` MUST change nothing and end with `E-DIFFERENT` where the two sides differ.
- **FR-013**: `bisync` MUST need a recorded base, or `--seed` for the first run, MUST record the base it ends with in the state folder, and MUST leave a conflict for the person unless a rule settles it; `mirror status`, `mirror sync` and `mirror promote` MUST keep the ledger in the state folder, MUST never touch what the replica changed itself, and MUST refuse to promote a replica that is behind or diverged unless the loss or divergence is accepted.
- **FR-014**: `places` MUST list the mounts with their places and what each kind of place is (built in, from the configuration, or no store yet), `doctor` MUST say what is wrong with the setup and the command for each, and both MUST run where there is no configuration.
- **FR-015**: The program MUST be one Headless tree made in one place from a host, MUST carry the version, the codes it explains and the tiers, and MUST be the same for the command line, the tool server and the description of the REST surface.
- **FR-016**: `main` MUST run the program with the words after its name and give its exit status; `--json` MUST give the one envelope of Headless and nothing else on standard output; a variable ANYFS_TIER that is no tier MUST end with the usage status.

## Acceptance scenarios

1. **Given** a place of the kind s3 and no opener, **When** it is opened, **Then** the ending is E-PLACE-UNAVAILABLE, per FR-001.
2. **Given** an opener for the kind git in the configuration, **When** a git place is opened, **Then** the opener's store is the result, per FR-002.
3. **Given** the same place opened twice, **When** the stores are compared, **Then** they are the same store, per FR-003.
4. **Given** a folder with no configuration and one with a broken one, **When** the program runs in each, **Then** the first works on plain paths and the second ends with E-CONFIG-LOAD, per FR-004.
5. **Given** a read-only mount, **When** a verb tries to remove a file in it, **Then** the ending is EROFS, per FR-005.
6. **Given** the program, **When** its model is described, **Then** the conformance finds nothing, per FR-006.
7. **Given** a mkdir in a store of objects, **When** --strict is given, **Then** the ending is E-STRICT, and with --explain nothing is made, per FR-007.
8. **Given** a file of every byte value, **When** it is cat, **Then** the bytes written are the bytes of the file, per FR-008.
9. **Given** the tier reader, **When** the tools are described, **Then** only the verbs that read are there, per FR-009.
10. **Given** a plan hash that is not the plan's, **When** the transfer is applied, **Then** nothing is written and the ending is E-PLAN-STALE, per FR-010.
11. **Given** a directory, **When** it is removed with its hash after the names changed, **Then** nothing is removed and the ending is E-PLAN-STALE, per FR-011.
12. **Given** two directories that differ, **When** they are synced with --dry-run and then with --yes and the hash, **Then** the second makes them equal, per FR-012.
13. **Given** a replica that changed on its own, **When** the mirror is synced, **Then** the changed path is left and the ending is E-REPLICA-DIVERGED, per FR-013.
14. **Given** no configuration, **When** places runs, **Then** it says there are no mounts and lists the kinds, per FR-014.
15. **Given** the program, **When** its model is described, **Then** it has the verbs and the three surfaces agree, per FR-015.
16. **Given** --json, **When** ls runs, **Then** standard output is one JSON document, per FR-016.

## Out of scope

- The backends that plug in through the configuration: their own libraries.
- A mount of the stores as a file system (a WebDAV or NFS server, or FUSE): their own libraries.

## Edge cases

- A destruction asked through the tool server: it is a preview and never an apply, per FR-009.
- A store that changed between the plan and the apply: the ending is E-PLAN-STALE and nothing is written, per FR-010.
- A host key not yet trusted: the store does not open and `trust-host` is the way, per FR-002.
- A configuration file that does not load: the verbs that need no mount still run, per FR-004.

## Assumptions

- The libraries `anyfs`, `anyfs-bridge`, `anyfs-posix`, `anyfs-ssh` and Headless are on the branch that holds this library.

## Open questions

- None.

## Key entities

- **AnyfsCli** - the library.

## Success criteria

- **SC-001**: `bun run verify` in this folder passes.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided

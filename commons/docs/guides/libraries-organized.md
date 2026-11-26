# How the libraries are organized

Every library of commons is a folder with a manifest, `library.ts`, and the package of the same name: `@intellectual-frontiers/<name>`. The one package the registry holds, `@intellectual-frontiers/commons`, has each library as a subpath (`@intellectual-frontiers/commons/<name>`), whatever the folder of the library is.

## Hosts and their extensions

A host is a library whose Kanon table declares plugins or dialects; its extensions are libraries of their own. An extension is in the folder of its host: the plugin `anyfs-s3` of the host `anyfs` is at `commons/anyfs/s3/`, and the dialect `desired-os-state-ansible` of `desired-os-state` at `commons/desired-os-state/ansible/`. The name of the library is still `anyfs-s3`, so no import changes when a folder moves (0027-commons-libraries FR-026, 0036-distribution FR-036).

- The host keeps its own sources in its own folders (`src/`, `suite/`, `spec-kit/`); the folders of its extensions are not part of it, so a change to an extension does not reach the host.
- Where a program needs the folder of a library, it asks the one resolver of `commons/libraries` (`libraryDir`), which reads it from where the manifest is.
- A host's `verify` runs `bun test ./suite/`, so that it does not run the suites of its extensions.

## Groups

A group is a presentation only. A manifest may name a `group`; the documentation lists the libraries of a group together on the page "Libraries by family", and no folder moves and no name changes for a group. The groups are `catalogs`, `linux`, `lab`, `estate`, `integrations` and `planning`.

Estate, Integrations and Planning are groups and not families with folders because their extensions are not Kanon plugins of their hosts: the tables of those hosts declare no plugin. A library moves into the folder of its host when the host's table declares it as a plugin or a dialect, and not before.

## Adding a library

`repoctl new library <name>` makes a library at `commons/<name>/`. To make an extension of a host, add it to the host's Kanon table (`plugins` or `instances`), give the manifest `family: { host, role }`, and move its folder to `commons/<host>/<extension>/`; `repoctl check` names a library that is not where its manifest puts it.

# Feature Specification: agora, the public root's command line

**Spec ID:** 0042-agora
**Status:** Draft

**Input:** `agora` is the public root's command line, built to
0041-command-line. One launcher and one body of code replace every script
this repository keeps outside its design systems: the spec and register
check, the brand tools, the assurance runner. It is named for the public
square, it reads, fetches and depends on nothing outside this repository,
and every CI job calls it and nothing else. It needs only `python3` and `uv`
on the host: its Python packages come from hashed locks and every other
program from its toolchain lock (0025-tooling-environment), so that no tool
is installed by hand and no workspace is required. Its surfaces are the
command line, which is the core; the IF Console VS Code extension
(0043-if-console); and its MCP server. A person learns it from one place,
`help`, whose topics are code; the guide, a book in four editions published to
GitHub Pages, explains how the pieces fit and generates its reference from the
same code; and the README is only the short way in. This spec states its name,
its public-only rule, its command set (also declared in the ontology), its
check sections and suites, its generators, its toolchain, its help and its
guide, how it relates to the design systems' own harnesses, and what CI runs.

## Identity and name

- **FR-001**: The public root's orchestrator MUST be `agora`: the launcher
  `agora` at the repository root and its code in `tools/agora/`, where the
  name, the audience `public`, the command groups, the check sections, the
  generators and the suites are declared in code, each group a module of
  `tools/agora/groups/`, and found by presence (0041-command-line FR-007). The
  packages a group needs are declared in the repository's `pyproject.toml` and
  locked in its `uv.lock` (0041-command-line FR-002, FR-003). It MUST follow
  0041-command-line in every respect this spec does not state otherwise.
- **FR-002**: The orchestrator's name MUST be `agora`, after the public
  square where people met in the open. It is chosen because it says what the
  tool is, an orchestrator for what is public; because it differs from any
  other command line's name at a glance and by any single typo, so one
  cannot be mistaken for another; and because it reads well in a prompt (run
  `agora check`). The name MUST NOT be shortened, aliased or changed except by
  amending this spec.
- **FR-003**: `agora` MUST be public only. Its code, its specs, its
  documentation and its messages MUST NOT read, fetch or depend on any other
  repository, and MUST NOT name any other repository or its tools as a
  literal: a repository's name comes to it as data from the ontology or a
  register, never from its own code (0041-command-line FR-045). Every output
  MUST carry the audience `public`, except when `--root` points it at another
  repository, when it MUST say `unstated` (0041-command-line FR-040).

## The command set

- **FR-004**: The command set MUST be declared in the ontology
  (`ontology/ifcore.ttl`) as an `ifcore:Orchestrator` individual for `agora`, a
  scheme of command categories, a scheme of command verbs, a scheme of
  resource kinds (the nouns), and one `ifcore:Command` individual for every
  command, naming its noun, its verb and its category
  (0001-eidolon-architecture FR-037, 0019-controlled-vocabulary FR-001). The
  check section `commands` MUST fail when the registry has a command the
  ontology does not declare, the ontology has one the registry does not, or
  their noun, verb or category differ.
- **FR-005**: `agora` MUST provide these repository-wide commands, which take
  no noun (0041-command-line FR-010): `check [SECTION...] [--scope ID]
  [--suite SUITE] [--changed]`, `fresh [GENERATOR...]`, `test`, `doctor`,
  `lock [GROUP]`, `context RESOURCE` and `help [TOPIC]` (FR-033); and these
  under the nouns `command` (`list`, `show`) and `mcp` (`serve`). Their
  categories are: `check`, `fresh`, `test` and `doctor` check; `context`,
  `help`, `command list` and `command show` read; `lock` and `mcp serve` setup.
- **FR-006**: `agora` MUST provide these commands under the nouns of the
  public root's own resources, each in the category shown:
  - `spec`: `list`, `show` (read); `new` (generate); `set --status`
    (decision).
  - `requirement`: `list [--spec] [--mechanism]`, `show` (read); `set
    --mechanism --by --note` and `add --control` (record).
  - `term`: `list [--scheme]`, `show` (read).
  - `design-system`: `list`, `show` (read); `new --kind` (generate).
  - `brand`: `list`, `show` (read); `generate` (generate): a brand's theme
    files and its specimen.
  - `imagery`: `list BRAND`, `show PIECE` (read, including measurement);
    `build BRAND` (generate): the WebP files, share card, app icons and
    favicon; `add BRAND --master` (record).
  - `decoration`: `show` (read); `generate [--only trace|set]` (generate).
  - `ink`: `list`, `show [--palette GPL...]` (read); `record --spot --thread
    --by --on` (decision).
  - `openedx`: `generate` (generate); `build --paragon` (build).
  - `layout`: `list`, `show [--def]` (read); `build -o` (build).
  - `figure`, `deck`, `email`, `media`, `sign`: `build PATH --brand ...`
    (build). `figure` also has `generate` (generate): the organization
    profile's figure (FR-015). `course`: `show` (read), `build --target`
    (build).
  - `toolchain`: `list`, `show ENTRY` (read); `add [ENTRY...]` (setup): the
    toolchain lock (FR-030; 0041-command-line FR-067).
  - `system`: `list` (read); `add` (setup, `sudo`): the browser's system
    libraries (FR-030; 0041-command-line FR-069).
  - `extension`: `show` (read); `build` (build): the IF Console extension's
    package (FR-032; 0043-if-console).
  - `proposal`: `list [--status]`, `show` (read); `new RESOURCE --reason
    --run COMMAND --field NAME=VALUE...` (record); `advance` (decision): FR-029.
  - `skill`: `generate` (generate): the agent skill (FR-028).
  - `docs`: `generate` (generate): the guide's generated chapters; `build
    [--output DIR]` (build): the guide's four editions (FR-034).
- **FR-007**: A `decision` command MUST be one of these three: `spec set
  --status`, `ink record` and `proposal advance` (0041-command-line FR-014).
  None MAY be callable over MCP (0041-command-line FR-023). `spec set
  --status` MUST move a spec between `Draft`, `Adopted` and `Superseded`
  only as 0020-spec-format FR-010 allows, and only at a person's direction.
- **FR-008**: `agora` MUST take these typed arguments (0041-command-line
  FR-013): SPEC (`NNNN-slug`, `NNNN`, or a design system's slug), REQUIREMENT
  (`<spec>/FR-NNN`), DESIGN_SYSTEM, BRAND, PIECE (`<brand>/<piece>`), INK
  (`<brand>/<role>`), LAYOUT (a print layout's name or alias, as
  `layouts.json` gives them), SECTION, GENERATOR and ENTRY (a toolchain entry,
  FR-030).
- **FR-009**: `design-system new SLUG --kind KIND` MUST refuse unless the
  design system's spec (`design-systems/<slug>/spec.md`) and its entry in the
  ontology already exist, and the entry's kind is KIND, a kind code of the
  ontology's kind scheme that ends the slug, so that the spec comes first,
  then the ontology, then the work (0001-eidolon-architecture FR-037;
  0014-design-systems FR-003, FR-010, FR-022). When it does not refuse it MUST
  create only the files 0014-design-systems FR-006 names that the directory
  lacks, a `README.md` and an `assurance/` harness that reports it has no
  tests and fails, so that a harness cannot pass before it is written, and it
  MUST NOT overwrite a file or put a stub beside a harness the directory
  already has. It MUST take `--dry-run`.
- **FR-010**: `requirement set` and `requirement add` MUST edit only the
  enforcement register and the control map, and `spec new` MUST create only a
  spec in the form 0020-spec-format FR-005 states, with the next unused
  number. None of them MAY write a requirement's text.
- **FR-011**: Retired. `agora` holds no pin of a reference environment and
  has no `environment` noun; its toolchain is declared in its code (FR-030).
- **FR-012**: A person's name MUST be written to a tracked file only by `ink
  record --by`, which records who verified a spot color and a thread match
  (0041-command-line FR-042).

## Checks, suites and generators

- **FR-013**: `agora check` MUST have these sections, each with the paths it
  watches declared in its manifest (0041-command-line FR-031, FR-032):
  `specs` (0020-spec-format FR-005 through FR-009 and FR-018, and 0001
  FR-034), `register` (0020-spec-format FR-011 through FR-014, with FR-013's
  rule that a command a row names exists in the registry), `controls`
  (0028-compliance-controls FR-005, FR-006), `ontology` (the ontology's
  prefixes and the design systems' registration, classification and
  derivation), `toolchain` (0041-command-line FR-068 and
  0025-tooling-environment FR-016, FR-020, FR-022: every toolchain entry's
  fields, that `uv.lock` and `package-lock.json` carry hashes, that no
  workflow installs a program with a package manager or runs in an image, and
  that no code, message or document names a workspace or a host program as a
  requirement, 0025-tooling-environment FR-025), `commands`
  (FR-004; and the registry's grammar, the workflows, the scripts, the boundary
  of FR-003, that every section and generator declares watched paths that match
  files (0041-command-line FR-032), the proposals of FR-029, and that the README
  links to the guide, FR-036), `help` (FR-033: every topic is well formed and
  names only commands, topics and paths that exist),
  `extension [--runner node|vscode]` (the IF Console extension's lint and its
  tests, 0043-if-console FR-028: `node` runs the unit tests under Node's test
  runner against a stand-in for the VS Code API, `vscode` runs the tests inside
  a real VS Code under a display server, 0043-if-console FR-032, and with no
  runner both run, a runner that cannot start being skipped, never passed),
  `design-systems [--scope SLUG] [--brand B] [--runner browser|python]` (each
  design system's harness under every brand, 0014-design-systems FR-015,
  FR-039), `imagery` (each brand's imagery pool and share card), `openedx`
  (a brand's Open edX package), and the item checks `figures`, `voice`,
  `slides`, `email`, `course`, `media`, `signage` and `merchandise`, each of
  which takes `--scope PATH`, more than once if need be, to the work it checks
  (a file, or a directory of such files), and calls the design system's own
  script on it (FR-017). With no `--scope` an item check MUST check the
  passing fixtures of the design system whose script it runs, which that
  script is meant to accept, and MUST say so; it MUST NOT report a scope that
  holds nothing as a pass, and MUST report a design system with no passing
  fixture as skipped. `voice` also takes `--mode prose|procedure`, `--draft`
  and `--spoken`, and the other item checks take `--brand`, themed by
  `frontiers-brand` when none is named, as their scripts are.
- **FR-014**: `agora` MUST declare these suites (0041-command-line FR-031):
  `spec` (`specs`, `register`, `controls`, `ontology`, `toolchain`, `commands`
  and `help`, which need no package and no toolchain entry beyond Python),
  `browser` (`design-systems --runner browser` and `openedx`), `python`
  (`design-systems --runner python`), `images` (`imagery`), `extension`
  (`extension`, both runners) and `vscode` (`extension --runner vscode`). A section MUST
  appear in no suite it does not belong to, and the `spec` suite MUST run on
  a stock host with only Python and uv. The item checks of FR-013 belong to no
  suite: they run when named, and in a plain `check`.
- **FR-015**: `agora` MUST declare these generators (0041-command-line
  FR-035), each proven by `agora fresh`: `brand-theme` (a brand's `brand.css`
  and `brand.tex` from its `tokens.json`), `brand-specimen` (its specimen),
  `openedx-sources` (a brand's Open edX package sources), `print-layout-docs`
  (the print design system's layout documentation from its layouts),
  `profile-figure` (the organization profile's figures), `brand-imagery` (a
  brand's WebP files, share card, app icons and favicon from its masters and
  tokens), `brand-decoration` (its traced lockup and icon, its set wordmark and
  unit marks, and their measured finest detail in `tokens.json`),
  `agent-skill` (the file that tells an AI agent how to use `agora`, FR-028)
  and `reference-docs` (the guide's reference chapters, FR-034).
  Each names the command that rewrites its files (0041-command-line FR-035):
  `brand generate` for `brand-theme` and `brand-specimen`, `imagery build` for
  `brand-imagery`, `decoration generate` for `brand-decoration`, `openedx
  generate` for `openedx-sources`, `figure generate` for `profile-figure`,
  `skill generate` for `agent-skill`, `docs generate` for `reference-docs`; the files of
  `print-layout-docs` are rewritten by the print design system's own
  `latex/layout.py sync`, which `fresh` calls and which stays in the design
  system (FR-017). `fresh` MUST say that a generator needs a toolchain entry the cache lacks
  (offline, or no build for the platform), and exit 3, rather than report its
  files stale, and MUST NOT report a generator current that ran with a host
  override (0025-tooling-environment FR-019); and it MUST run a
  generator whose group pins packages under that group's locked environment
  (0041-command-line FR-002, FR-028).

## Replacing every script

- **FR-016**: `agora` MUST replace every script this repository keeps outside
  a design system's own directory and the IF Console's own directory
  (0043-if-console FR-002). `tools/spec_check.py`,
  `tools/run_assurance.sh`, `tools/brand_decoration.py`,
  `tools/brand_imagery.py`, `tools/brand_openedx.py`,
  `tools/brand_specimen.py`, `tools/brand_theme.py` and the profile's
  figure script MUST be deleted when `agora` provides their function, with no
  wrapper and no legacy path; every reference to one, in documentation,
  design system READMEs and specs, workflows, the enforcement register and
  comments, MUST be rewritten to the `agora` command that replaces it. A
  repository that imported a deleted script MUST run `agora` instead
  (0020-spec-format FR-016).
- **FR-017**: A design system's own scripts and harnesses MUST stay inside
  `design-systems/<slug>/`, self-contained (0014-design-systems FR-005,
  FR-015), and `agora` MUST call them: in the same process through `importlib`
  where the script exposes functions, otherwise as a subprocess of its
  documented command line. A harness MUST still run on its own, by the means
  its README documents, without `agora`.

## Dependencies

- **FR-018**: A group MUST pin only the packages its own commands need, each
  to one exact version, as a dependency group of `pyproject.toml`, locked with
  hashes in the committed `uv.lock` (0025-tooling-environment FR-013). The
  groups the `spec` suite uses MUST pin none. A program outside Python MUST be
  a Python package or a toolchain entry (FR-030), never a host program;
  `agora doctor` MUST report `python3`, `uv`, the cache state of each
  toolchain entry for the host's platform, and every opt-in override that is
  set, with hints that name only a package or an entry
  (0041-command-line FR-029, 0025-tooling-environment FR-012, FR-019).
- **FR-030**: `agora`'s toolchain MUST be declared in its code
  (0041-command-line FR-066) and MUST be what its commands need beyond the
  Python standard library and the locked packages, and no more. The programs
  its commands needed from the host before this rule MUST be replaced as
  follows, and each choice is confirmed against fidelity and licence by the
  change that makes it, with the generated files that change regenerated and
  proven by `fresh` in the same change (0025-tooling-environment FR-009):
  - Python packages from PyPI through uv: `Pillow` in place of ImageMagick's
    `convert` and `identify`; `pypdfium2` and `pypdf` in place of poppler's
    `pdfinfo`, `pdftotext`, `pdffonts`, `pdfimages` and `pdftoppm`; `resvg-py`
    in place of `rsvg-convert` for a PNG, and `reportlab` in place of it for the
    signage design system's PDF (`cairosvg` is not used: it loads the host's
    libcairo); `potracer` in place of `potrace`; `nodejs-wheel-binaries` in place of a host Node (it supplies
    `node`, `npm` and `npx`); and `dulwich` in place of `git` where a command
    only reads Git's state.
  - Toolchain entries: `jre` (a Temurin 21 runtime), `asciidoctor`
    (AsciidoctorJ 3.0.1, which carries Asciidoctor 2.0.26 and the EPUB 3
    converter) and `asciidoctor-pdf` (asciidoctorj-pdf, as its own entry so that
    `asciidoctor` stays exactly the version and checksum the other
    repositories' toolchains pin, which lets one cache serve them), for the
    guide (FR-034); `vscode` (the stable VS Code tarball for Linux, and the zip
    for macOS, at the address and SHA-256 the vendor publishes for the
    version), for the extension's tests (0043-if-console FR-032);
    `tinytex` and `tex-packages` (a TinyTeX release and the
    TeX Live packages the harnesses need that it lacks, each package's container pinned
    by its own checksum from TeX Live's frozen 2025 repository, supplying XeLaTeX and
    LuaLaTeX; there is no `latexmk`, a Perl program, so the print harness runs the
    engine again until the cross-references settle), `chromium` (Playwright's pinned
    Chromium build, from the address Playwright publishes it at, for the Playwright
    version the npm lock holds), and the npm lock (`package.json` and
    `package-lock.json`) holding `playwright` for Node and `@openedx/paragon`. The
    browser's and VS Code's Linux system libraries,
    and the display server `Xvfb` that VS Code is started under, are installed
    once by the `system` noun's `add` (0041-command-line FR-069), whose package
    list for Debian and Ubuntu is pinned in `agora`'s code, and which the
    README and `help start` document. `agora` starts the display server itself,
    on a free display, for the one run, and stops it.
  The list is confirmed by the change that implements it (OQ-2).
## Help and the guide

- **FR-033**: `agora` MUST provide `help [TOPIC]` (read), the one place its
  daily work is documented (0041-command-line FR-065). A topic MUST be a Python
  module of `tools/agora/help/`, found by presence, standard library only, with
  a name, a one-sentence summary in plain language, a plain first paragraph,
  sections of plain language and steps. Every step MUST be an action
  (0041-command-line FR-017): a command of the registry with its fields, shown
  as one pasteable line in the terminal and as a button in the editor; a thing
  the person must do themselves, such as installing `python3`, MUST be said in
  words and not given as a step. `help` with no topic MUST list the topics.
  The topics MUST include `start` (the first day: `python3` and `uv` from the
  host, `system add`, `toolchain add`), `check` (what to run before pushing),
  `specs` (writing a spec and its register rows), `design-systems`, `brands`,
  `toolchain`, `editor` (IF Console), `ai` (agents, MCP and proposals),
  `extend` (adding a command or a group with an AI) and `recover` (what to do
  when something fails). The section `help` MUST fail a topic that is missing
  its summary or its sections, a step whose command is not in the registry or
  whose fields the command does not take, a line of a topic that names an
  `agora` command or `help` topic that does not exist, and a repository path it
  names that does not exist. A topic MUST NOT be a file a person edits, and
  MUST work offline.
- **FR-034**: `agora` MUST keep a guide: a book in AsciiDoc under `docs-src/`,
  whose manuscript includes hand-written chapters (an overview, the start, and
  a FAQ) and generated reference chapters. `docs generate` (generate) MUST write
  the reference chapters from the registry, the help topics, the toolchain
  entries, the check sections, suites and generators, and the design systems,
  each file carrying a header that names the generator `reference-docs` and the
  command that rewrites it, and `fresh` MUST prove them current. A reference
  chapter MUST NOT repeat a step a topic gives; it names the topic. `docs build
  [--output DIR]` (build; default `build/docs`) MUST write into DIR the
  multi-page HTML site (`guide/`, one page per chapter with navigation), the
  single page (`guide.html`), the PDF (`guide.pdf`) and the EPUB (`guide.epub`),
  and `index.html` with the pictures it uses, and MUST report each edition as
  built, failed or skipped, never built when it was not. The converters MUST be
  the toolchain entries `asciidoctor` and `asciidoctor-pdf` on `jre` (FR-030),
  never a program of the host. The site's links MUST all resolve: `docs build`
  MUST fail naming each relative link or fragment in the multi-page site that
  points at nothing. The guide MUST be written in the voice the repository's
  writing rules set.
- **FR-035**: `docs/index.html` MUST be the one hand-written page of the guide's
  site: a landing page that links to each edition and uses the brand's own logo
  and imagery from `design-systems/frontiers-brand/`, which `docs build` copies
  beside it, and no art of its own. The workflow `pages.yml` MUST build the
  guide with `./agora docs build` and publish it to GitHub Pages on a push to
  `main`. The repository's owner MUST set Settings, Pages, Source to GitHub
  Actions once; until then the deploy job fails and says so. The guide is
  served at `https://intellectual-frontiers.github.io/.github/`.
- **FR-036**: The `README.md` MUST be short: what the repository is, the flow in
  a few numbered steps (install `python3` and `uv`, run `./agora help start`,
  `./agora system add` once, `./agora toolchain add`, `./agora check`), the
  link to the guide, and a paragraph for contributors; and everything else it
  once held MUST be in the guide. The section `commands` MUST fail when the
  README lacks the link to the guide, the one-time `system add` and the
  `help` command, or is longer than 120 lines.

## Surfaces

- **FR-031**: `agora` MUST expose its commands on three surfaces: the command
  line, which is the core and the only surface every command has; the IF
  Console VS Code extension (0043-if-console), which lists `agora`'s commands
  and views by running `agora command list --json`; and `agora mcp serve`
  (FR-020). `agora` MUST run no server and MUST NOT have a web interface
  (0041-command-line FR-011).
- **FR-032**: The repository root MUST hold `.if-console.env`, whose
  `IF_CONSOLE_LAUNCHER` line names `agora`, so that the extension finds the
  launcher by this repository's own declaration and not by a list of names it
  carries (0043-if-console FR-004). `agora extension build` MUST build the
  extension's package from `tools/if-console/` into `build/`, with Node from
  the locked `nodejs-wheel-binaries` and the extension's own `package-lock.json`
  (0043-if-console FR-027), and MUST take `--dry-run`. `agora extension test --suite DIR
  [--workspace [NAME=]DIR]...` MUST run another repository's tests of the
  extension in a real VS Code as 0043-if-console FR-034 states, and `agora
  extension test --screenshots DIR` MUST capture the extension's screens as
  0043-if-console FR-045 states. `agora` MUST declare in its manifests, for the
  editor, a view for the groups of its nouns, an icon for each noun, the fields
  of each list's rows, and a palette title for every command the editor
  surface exposes, as 0041-command-line FR-064 states, and `agora check
  commands` MUST fail one that FR-072 of that spec refuses.
- **FR-019**: `agora` MUST declare two editor views in code, `console` and
  `assurance`, and MUST run no server (0041-command-line FR-011). A view is a
  `read` command's resource and its HTML rendering that the IF Console
  extension lists for `agora` (0041-command-line FR-050, 0043-if-console
  FR-011). `console` MUST be a registry
  browser: the nouns, the commands under each, and a page for each command;
  its markup and style MUST come from `frontiers-console-web`. `assurance`
  MUST list each design system's assurance page, once for every brand that
  themes it and once for a brand itself, and open it from the clone's own files
  under `design-systems/`; it MUST name nothing outside that directory.

- **FR-020**: `agora mcp serve` MUST expose the commands that declare MCP and
  are not `decision` commands (FR-007; 0041-command-line FR-027). The default
  exposure by category is 0041-command-line FR-022's. It MUST be written with
  the standard library only, speak newline-delimited JSON-RPC 2.0 on standard
  input and output, and support the MCP revisions its `VERSIONS` list in
  `tools/agora/core/mcp.py` names, newest first, answering `initialize` with the
  client's when it is one of them and with the newest otherwise. A tool is named
  for its command with spaces made underscores (`spec_show`, `check`); a
  call runs the command through the registry's library call with the surface
  `mcp`; a write's `dry_run` defaults to true; and a call to a `decision`
  command, which the tool list never names, is answered with an error resource
  of code `decision-refused` whose next action is `proposal new`. Its resources
  are readable by URI: `agora://spec/ID`, `agora://requirement/SPEC/FR-NNN`,
  `agora://design-system/SLUG`, `agora://brand/SLUG`, `agora://term/ID`,
  `agora://command/WORDS` (spaces as `+`), and `agora://proposal/ID`, each the JSON resource of the `show`
  command of its noun, and `agora://context/KIND:ID`, the resource `context`
  returns.
- **FR-021**: `agora` MUST write what is not worth a commit as NDJSON lines
  under `.agora/logs/`, which `.gitignore` MUST list, each line noting the
  surface (`cli`, `editor` or `mcp`) and the action (0041-command-line
  FR-042). Only what changes or runs something is logged, as
  0041-command-line FR-042 states: no `read` command, editor view or MCP
  resource read is. Proposals
  MUST be tracked files under `.agora/proposals/` (0041-command-line FR-039,
  FR-029).

## Continuous integration

- **FR-022**: Every workflow in `.github/workflows/` MUST call `agora` and no
  other tool of this repository's own, on a stock runner given only
  `actions/checkout`, `actions/setup-python` and `astral-sh/setup-uv`, and MAY
  restore and save the caches `agora` fills (0025-tooling-environment FR-011,
  FR-023). No workflow MAY install a program with a package manager, set up
  Node or a browser itself, pull an image, or run in a container.
  `spec-check.yml` MUST run `./agora check --suite spec`. `design-systems.yml`
  MUST run `./agora check --suite browser`, `--suite python`, `--suite images`
  and `--suite extension` in separate jobs, each that needs a browser's or
  VS Code's libraries or a display server after `./agora system add --yes`.
  `pages.yml` MUST build the guide with `./agora docs build` and MAY use
  GitHub's own `actions/configure-pages`, `actions/upload-pages-artifact` and
  `actions/deploy-pages`, which publish and install nothing (FR-035). A workflow that runs `agora` in a
  reference environment MUST NOT exist (0025-tooling-environment FR-022,
  FR-025), and neither MUST `tools/reference-environment`. Every job MUST fail
  on any non-zero exit status, except that a job MAY show exit status 3 from
  `./agora doctor` as a warning naming what is missing
  (0041-command-line FR-021).

## The agent skill and proposals

- **FR-028**: The `agent-skill` generator MUST write one file,
  `.claude/skills/agora/SKILL.md`, the skill that tells an AI agent how to use
  `agora` (0041-command-line FR-037), from the registry alone: the nouns, every
  command with its category, surfaces, typed arguments, options and an
  example, the categories, the check sections with their suites, the
  generators with the commands that rewrite them, the typed arguments, how
  to ask for `context`, and how MCP works. It MUST say that a `decision`
  command is for a person and that an agent drafts one with `proposal new`. It
  MUST carry a header naming the generator and the command that rewrites it,
  MUST hold nothing that depends on the repository's specs or designs, so
  that it changes only when the registry does, and `agora skill generate`
  MUST write it, with `--dry-run`.
- **FR-029**: A proposal MUST be the JSON file `<id>.json` in
  `.agora/proposals/`, its id `NNNN-slug` with the next unused number and a slug
  from its command and resource. It MUST hold `id`, `status` (`open` or
  `accepted`), `resource` (`KIND:ID`, a kind `context` serves), `reason` and
  `action`, a command's words and its fields by name, exactly as a link or an
  action names them (0041-command-line FR-017). `proposal new` MUST validate
  the action as the command would, refuse a command that is not `record`,
  `generate` or `decision`, and refuse a `proposal` command. `proposal
  advance ID` MUST refuse an accepted proposal, run the action's dry run and
  refuse if it fails, show that dry run in its resource, and, unless it is run
  with `--dry-run`, replay the action, mark the proposal accepted in its file
  and say what to commit. A proposal is refused by deleting its file in a
  commit.

## Out of scope

- The implementation of any one command beyond the rules here and in
  0041-command-line.
- An orchestrator for any other repository.
- The design systems' own rules and harnesses (0014-design-systems).

## Edge cases

- A tool or workflow here that names another repository's orchestrator: not
  allowed, per FR-003; the name belongs as data only where a register already
  holds it.
- Another repository's specs checked with this repository's rules: `agora
  check specs register --root DIR`, and the output says its audience is
  unstated, per FR-003 and 0041-command-line FR-040.
- A new command added to the registry with no ontology individual: `agora
  check commands` fails, per FR-004.
- A design system's harness that cannot import anything from `agora`: it keeps
  working on its own, per FR-017.
- A `check` run offline with a cold toolchain cache: the sections that need a
  toolchain entry are skipped and the status is non-zero, unless a suite that
  excludes them was named, per FR-014 and 0041-command-line FR-033.
- A `check` run on a host that has TeX or ImageMagick installed: the host's
  copy is not used, the locked one is, per FR-030 and 0025-tooling-environment
  FR-019.
- A Linux host without a library Chromium links against: the browser sections
  fail with exit status 3 naming each library and the setup command, and
  `agora` installs nothing itself, per FR-030 and 0025-tooling-environment FR-021.
- A workflow that runs `apt-get`, sets up Node, or runs in a container image:
  `agora check toolchain` fails, per FR-013 and FR-022.
- An agent asked to set a spec's status: the command is a `decision` command
  and is not offered over MCP, per FR-007; the agent records a proposal
  instead, per FR-021.
- A script that still exists after its function is in `agora`: it is deleted
  with its references, per FR-016.
- `design-system new` for a slug with a spec and no ontology entry: refused,
  and nothing is written, per FR-009.
- A generated file hand-edited, such as a brand's `brand.css`: `agora fresh`
  fails and names `brand-theme`, per FR-015.
- An agent calls `spec_set` over MCP: the tool is not listed, and the call is
  answered with the error resource `decision-refused` whose next action is
  `proposal new`, per FR-020 and FR-007.
- An agent calls a write tool without `dry_run`: it is a dry run, per FR-020.
- A client asks for a protocol revision the server does not know: the server
  answers with its latest, per FR-020.
- A person advances a proposal whose dry run fails: nothing is written and the
  proposal stays open, per FR-029.
- The `SKILL.md` is edited by hand, or a command is added without it being
  regenerated: `agora fresh` fails and names `agent-skill`, per FR-015 and
  FR-028.
- `./agora doctor` exits 3 in a CI job: the job shows a warning naming what
  is missing and does not fail, per FR-022.
- The extension finds `agora` without a list of names: the repository's own
  `.if-console.env` names it, per FR-032.
- A view or a `read` command is run: nothing is logged, per FR-021.
- A view that needs a page outside `design-systems/`: not offered, per FR-019.
- A new editor view: declared in code by presence and named by no other file,
  per FR-019 and 0041-command-line FR-007.
- A topic that tells a person to run a command that was renamed: `agora check
  help` fails naming the topic and the command, per FR-033.
- A generated chapter edited by hand, or a command added without `docs
  generate`: `agora fresh` fails and names `reference-docs`, per FR-034.
- `docs build` where the PDF converter cannot start: the PDF is reported
  skipped or failed with the reason and the other editions are still built,
  per FR-034.
- A VS Code test run on a host without a display server or VS Code's libraries:
  the section is skipped naming `agora system add` and the status is 3, never
  passed, per FR-013 and FR-030.
- Pages not enabled for the repository: the deploy job fails and says the
  owner must set the Pages source to GitHub Actions, per FR-035.

## Assumptions

- The public root's workflows run on GitHub-hosted runners that can set up
  Python and uv, per 0025-tooling-environment FR-011.
- Every program outside Python that the checks need is available as a wheel or
  as a toolchain entry whose upstream publishes a Linux x86_64 build, per
  FR-030 and 0025-tooling-environment FR-020.

## Open questions

- **OQ-1**: Whether `check` sections that need Node and Playwright can run
  their harnesses through `agora`'s own worker, or must always run the
  harness's documented command.
- **OQ-2**: Answered for TinyTeX: TinyTeX 2026.03 (TeX Live 2025) with eight
  pinned packages passes the print design system's harness, 79 checks under each
  brand, with no host TeX; one package, `microtype`, is taken from the frozen
  repository at a newer revision than TinyTeX holds, because the bundled one stops a
  document that loads `titletoc` after it. Chromium 133 (Playwright 1.50.0's build)
  passes every browser harness, and Paragon 23.23.0 from the npm lock rebuilds the Open
  edX package to the committed `dist/`. The package replacements FR-030 names are
  confirmed, each with the generated files it changed regenerated and proven by
  `fresh`: `pypdfium2` (text layer) and `pypdf` (page size, fonts, images) for
  poppler's readers, with PyMuPDF excluded for its AGPL licence; `resvg-py`
  (MIT binding of the MPL-2.0 resvg) for PNG, with the design systems' fonts alone
  and no font of the machine's; `reportlab` (BSD-3-Clause) for the sign's PDF, its
  CFF faces converted to TrueType by `fontTools` because reportlab embeds only
  TrueType outlines; `potracer` (GPL-2.0-or-later, used as a tool and never
  shipped) for `potrace`, which reproduces the committed traces to within 0.03% of
  their pixels and the same measured finest detail; `Pillow` (MIT-CMU) for
  ImageMagick, whose WebP and PNG bytes differ once and are regenerated; and
  `dulwich` (Apache-2.0 or GPL-2.0-or-later) for `git`. The `nodejs-wheel-binaries`
  wheel's `bin/npm` and `bin/npx` are links that uv unpacks as copies that cannot
  find their library, so npm is started as `node npm-cli.js`.
- **OQ-3**: `agora` still declares its registry in manifests, its UI-less
  views are not yet declared, its register check still reads
  the repository names from a workspace file instead of the ontology, and its
  packages are locked per group rather than in one `uv.lock`; moving to code
  (FR-001), declaring the editor views (FR-019) and removing what FR-011
  retires is pending, and until it is done the requirements that depend on it
  are enforced by nothing.
- **OQ-4**: Whether a stock GitHub runner holds the system libraries
  Chromium links against, or the browser job needs them provided
  (0025-tooling-environment OQ-1).

## Key entities

- **agora** — the public root's orchestrator, the one thing CI calls.
- **The command set** — the commands declared in the ontology and the
  registry, which must agree.
- **A suite** — `spec`, `browser`, `python`, `images`, `extension` or `vscode`:
  the sections one CI job runs.
- **The toolchain** — the packages and toolchain entries that replace the
  host programs `agora`'s commands once needed (FR-030).
- **A help topic** — one piece of the daily work in code, in plain language,
  whose steps are actions (FR-033).
- **The guide** — the AsciiDoc book in `docs-src/`, built to HTML, one page,
  PDF and EPUB, and published to GitHub Pages (FR-034, FR-035).
- **An editor view** — `console`, the registry browser, or `assurance`, the
  list of the design systems' in-browser harness pages; each is a resource the
  IF Console extension shows, and `agora` runs no server for either.
- **A proposal** — a tracked, replayable change an agent drafts for a person to
  accept (FR-029).
- **A generator** — brand-theme, brand-specimen, openedx-sources,
  print-layout-docs, profile-figure, agent-skill or reference-docs.

## Success criteria

- **SC-001**: `./agora check --suite spec` passes on a stock runner with only
  Python and uv.
- **SC-002**: The registry and the ontology list the same commands, with the
  same noun, verb and category.
- **SC-003**: No script remains in this repository outside a design system's
  directory, `tools/agora/` and the IF Console's own directory.
- **SC-004**: No file of `agora` names or reads another repository.
- **SC-005**: Every workflow's run steps call `agora`, on a runner given only
  Python and uv.
- **SC-007**: `./agora check` passes on a stock host that has only `python3`
  and `uv`, with a network and a cold cache.
- **SC-006**: `agora` runs no server: it has no `ui` command, and both views
  render from `read` commands' resources.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact

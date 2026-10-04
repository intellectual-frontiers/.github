# Feature Specification: agora, the public root's command line

**Spec ID:** 0042-agora
**Status:** Draft

**Input:** `agora` is the public root's command line, built to
0041-command-line. One launcher and one body of code replace every script
this repository keeps outside its design systems: the spec and register
check, the brand tools, the assurance runner. It is named for the public
square, it reads, fetches and depends on nothing outside this repository,
and every CI job calls it and nothing else. This spec states its name, its
public-only rule, its command set (also declared in the ontology), its check
sections and suites, its generators, how it relates to the design systems'
own harnesses, and what CI runs.

## Identity and name

- **FR-001**: The public root's command line MUST be `agora`: the launcher
  `agora` at the repository root, its code in `tools/agora/`, its root
  manifest `tools/agora/agora.toml` declaring the name, the audience
  `public`, the command groups and the suites, and each group's manifest
  `tools/agora/groups/<group>/agora.toml` with its lock `agora.lock` only
  where the group pins packages (0041-command-line FR-007). It MUST follow
  0041-command-line in every respect this spec does not state otherwise.
- **FR-002**: The command line's name MUST be `agora`, after the public
  square where people met in the open. It is chosen because it says what the
  tool is, a command line for what is public; because it differs from any
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
  (`ontology/ifcore.ttl`) as an `ifcore:CommandLine` individual for `agora`, a
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
  `lock [GROUP]` and `context RESOURCE`; and these under the nouns
  `command` (`list`, `show`), `ui` (`serve`, `open`, `stop`, `link`) and
  `mcp` (`serve`). Their categories are: `check`, `fresh`, `test` and
  `doctor` check; `context`, `command list`, `command show` and `ui link`
  read; `lock`, `ui serve`, `ui open`, `ui stop` and `mcp serve` setup.
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
    `build BRAND` (build); `add BRAND --master` (record).
  - `decoration`: `show` (read); `generate [--only trace|set]` (generate).
  - `ink`: `list`, `show [--palette GPL...]` (read); `record --spot --thread
    --by --on` (decision).
  - `openedx`: `generate` (generate); `build --paragon` (build).
  - `layout`: `list`, `show [--def]` (read); `build -o` (build).
  - `figure`, `deck`, `email`, `media`, `sign`: `build PATH --brand ...`
    (build). `course`: `show` (read), `build --target` (build).
  - `environment`: `show` (read); `set COMMIT` (setup).
  - `proposal`: `list`, `show` (read); `new` (record); `advance` (decision).
- **FR-007**: A `decision` command MUST be one of these three: `spec set
  --status`, `ink record` and `proposal advance` (0041-command-line FR-014).
  None MAY be callable over MCP (0041-command-line FR-023). `spec set
  --status` MUST move a spec between `Draft`, `Adopted` and `Superseded`
  only as 0020-spec-format FR-010 allows, and only at a person's direction.
- **FR-008**: `agora` MUST take these typed arguments (0041-command-line
  FR-013): SPEC (`NNNN-slug`, `NNNN`, or a design system's slug), REQUIREMENT
  (`<spec>/FR-NNN`), DESIGN_SYSTEM, BRAND, PIECE (`<brand>/<piece>`), INK
  (`<brand>/<role>`), LAYOUT, UI, SECTION, GENERATOR and COMMIT (40 hex
  digits).
- **FR-009**: `design-system new` MUST refuse unless the design system's
  spec and its entry in the ontology already exist, so that the spec comes
  first, then the ontology, then the work (0001-eidolon-architecture FR-037;
  0014-design-systems FR-010, FR-022).
- **FR-010**: `requirement set` and `requirement add` MUST edit only the
  enforcement register and the control map, and `spec new` MUST create only a
  spec in the form 0020-spec-format FR-005 states, with the next unused
  number. None of them MAY write a requirement's text.
- **FR-011**: `environment set COMMIT` MUST change the pin in
  `tools/reference-environment` and the image tag in the devcontainer
  together, and MUST NOT change one without the other
  (0025-tooling-environment FR-008, FR-009).
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
  derivation), `environment` (0025-tooling-environment FR-008), `commands`
  (FR-004), `ui` (0041-command-line FR-025 and FR-026 for each UI declared),
  `design-systems [--scope SLUG] [--brand B] [--runner browser|python]` (each
  design system's harness under every brand, 0014-design-systems FR-015,
  FR-039), `imagery` (each brand's imagery pool and share card), `openedx`
  (a brand's Open edX package), and the item checks `figures`, `voice`,
  `slides`, `email`, `course`, `media`, `signage` and `merchandise`, each of
  which takes `--scope PATH` to the work it checks and runs only with it.
- **FR-014**: `agora` MUST declare these suites (0041-command-line FR-031):
  `spec` (`specs`, `register`, `controls`, `ontology`, `environment`,
  `commands` and `ui`, which need no package and no program beyond Python),
  `browser` (`design-systems --runner browser` and `openedx`), `python`
  (`design-systems --runner python`) and `images` (`imagery`). A section MUST
  appear in no suite it does not belong to, and the `spec` suite MUST run on
  a stock host with only Python and uv.
- **FR-015**: `agora` MUST declare these generators (0041-command-line
  FR-035), each proven by `agora fresh`: `brand-theme` (a brand's `brand.css`
  and `brand.tex` from its `tokens.json`), `brand-specimen` (its specimen),
  `openedx-sources` (a brand's Open edX package sources), `print-layout-docs`
  (the print design system's layout documentation from its layouts),
  `profile-figure` (the organization profile's figures) and `agent-skill` (the
  files that tell an AI agent how to use `agora`, 0041-command-line FR-037).

## Replacing every script

- **FR-016**: `agora` MUST replace every script this repository keeps outside
  a design system's own directory. `tools/spec_check.py`,
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
  to one exact version, with a committed hashed lock
  (0025-tooling-environment FR-013). The groups the `spec` suite uses MUST pin
  none. Programs outside Python (TeX, Chromium, ImageMagick, potrace,
  rsvg-convert, Node, Paragon) MUST come from the host; `agora doctor` MUST
  report each with a hint naming the workspaces-host-v3 persona or the program
  that supplies it, and never the reference environment by name
  (0025-tooling-environment FR-007, FR-012).

## Surfaces

- **FR-019**: `agora` MUST serve two web UIs, `console` and `assurance`,
  inside its own process (0041-command-line FR-025). Their markup and style
  MUST come from `frontiers-console-web`, which stays free of Datastar
  (`frontiers-console-web` FR-004); the interactivity is `agora`'s own
  application layer, a copy of `design-systems/frontiers-nature-web/js/datastar.js`
  vendored in `tools/agora/` (0041-command-line FR-026). `agora check ui`
  MUST prove each UI serves and renders offline.
- **FR-020**: `agora mcp serve` MUST expose the commands that declare MCP and
  are not `decision` commands (FR-007; 0041-command-line FR-027). The default
  exposure by category is 0041-command-line FR-022's.
- **FR-021**: `agora` MUST write what is not worth a commit as NDJSON lines
  under `.agora/logs/`, which `.gitignore` MUST list, each line noting the
  surface (`cli`, `ui` or `mcp`) and the action (0041-command-line FR-042).
  Proposals MUST be tracked files under `.agora/proposals/`
  (0041-command-line FR-039).

## Continuous integration

- **FR-022**: Every workflow in `.github/workflows/` MUST call `agora` and no
  other tool of this repository's own. `spec-check.yml` MUST run on a stock
  runner with Python and uv set up, `./agora check --suite spec`.
  `design-systems.yml` MUST run `./agora check --suite browser`, `--suite
  python` and `--suite images` in separate jobs, each job installing only the
  programs outside Python it needs (0025-tooling-environment FR-011).
  `reference-environment.yml` MUST run, inside the pinned image, `./agora
  doctor && ./agora check && ./agora fresh && ./agora test`
  (0025-tooling-environment FR-010).

## Out of scope

- The implementation of any one command beyond the rules here and in
  0041-command-line.
- A command line for any other repository.
- The design systems' own rules and harnesses (0014-design-systems).

## Edge cases

- A tool or workflow here that names another repository's command line: not
  allowed, per FR-003; the name belongs as data only where a register already
  holds it.
- Another repository's specs checked with this repository's rules: `agora
  check specs register --root DIR`, and the output says its audience is
  unstated, per FR-003 and 0041-command-line FR-040.
- A new command added to the registry with no ontology individual: `agora
  check commands` fails, per FR-004.
- A design system's harness that cannot import anything from `agora`: it keeps
  working on its own, per FR-017.
- A `check` run on a host without a TeX or browser program: the sections that
  need them are skipped and the status is non-zero, unless a suite that
  excludes them was named, per FR-014 and 0041-command-line FR-033.
- An agent asked to set a spec's status: the command is a `decision` command
  and is not offered over MCP, per FR-007; the agent records a proposal
  instead, per FR-021.
- A script that still exists after its function is in `agora`: it is deleted
  with its references, per FR-016.
- A UI that wants a CDN script: not allowed; Datastar is vendored, per FR-019
  and 0041-command-line FR-026.
- A generated file hand-edited, such as a brand's `brand.css`: `agora fresh`
  fails and names `brand-theme`, per FR-015.

## Assumptions

- The public root's workflows run on GitHub-hosted runners that can set up
  Python and uv, per 0025-tooling-environment FR-011.
- Every program outside Python that the checks need is on the host's `PATH`
  or found by an environment override first, then the runtime's own lookup,
  per 0025-tooling-environment FR-002.

## Open questions

- **OQ-1**: Whether `check` sections that need Node and Playwright can run
  their harnesses through `agora`'s own worker, or must always run the
  harness's documented command.

## Key entities

- **agora** — the public root's command line, the one thing CI calls.
- **The command set** — the commands declared in the ontology and the
  registry, which must agree.
- **A suite** — `spec`, `browser`, `python` or `images`: the sections one CI
  job runs.
- **A generator** — brand-theme, brand-specimen, openedx-sources,
  print-layout-docs, profile-figure or agent-skill.

## Success criteria

- **SC-001**: `./agora check --suite spec` passes on a stock runner with only
  Python and uv.
- **SC-002**: The registry and the ontology list the same commands, with the
  same noun, verb and category.
- **SC-003**: No script remains in this repository outside a design system's
  directory and `tools/agora/`.
- **SC-004**: No file of `agora` names or reads another repository.
- **SC-005**: Every workflow's run steps call `agora`.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design-systems/frontiers-brand/logos/if-logo-dark-672x189-2026-Sept.png">
    <img alt="Intellectual Frontiers" src="design-systems/frontiers-brand/logos/if-logo-672x189-2026-Sept.png" width="336">
  </picture>
</p>

# Intellectual Frontiers — `.github`

This is the public root of Intellectual Frontiers' Eidolon: the company's own account of what it is and how it works, written as
testable specs and typed against an ontology, so that a person or an AI can check it instead of guessing. The organization's public
landing page is [`profile/README.md`](profile/README.md).

One command line, `agora`, runs every check, build and record here. It needs only [`uv`](https://docs.astral.sh/uv/) on your machine, which
supplies the newest Python (3.14) and the locked packages; the programs outside Python (a typesetter, a browser, a Java runtime) come from
[`ws-host`](https://github.com/intellectual-frontiers/workspaces-host), pinned and checked by fingerprint, when you have it. It never uses a program it
finds on your machine unless you name it. A person, a CI job and an AI agent run the same commands; `./agora doctor` says which commands this machine can run.

## The flow

1. Clone this repository and run `./agora help start`. That needs only `uv`. For the commands that name a toolchain entry, install
   [`ws-host`](https://github.com/intellectual-frontiers/workspaces-host) (its README has the one line) and enable the clone once with
   `ws-host provider add .`; a machine with no person at it runs the bootstrap in [`AGENTS.md`](AGENTS.md).
2. The daily work is documented in one place, the program, and in VS Code every step is a button ([IF Console](tools/if-console/), Learn).
3. Once per machine that has `ws-host`, run `ws-host system ensure --dry-run` to see, then `ws-host system ensure`, which installs the few system libraries and
   the display server that a browser and VS Code need. It asks before it uses `sudo`, and it is the only command that does.
4. Work spec first: the spec, then the ontology, then everything else. `./agora help specs` has the steps.
5. Before you push, run `./agora check --suite spec` (with `--available` where `ws-host` is not installed), `./agora test` and `./agora fresh`. `./agora help check` says what else.

## The guide

Everything else lives in the guide, a book in four editions (a website, one page, a PDF and an EPUB), published at
**<https://intellectual-frontiers.github.io/.github/>**. It explains what an Eidolon is, how the repositories and the working order fit,
what `agora` is, and lists every command, check, help topic, toolchain entry, design system and spec, taken from the code. Build it
yourself with `./agora docs build`; the result is in `build/docs/`.

## Contributors

Every change is a commit to a spec, then the ontology, then code or content, and `./agora check --suite spec` must pass before you push;
CI runs it too. Add a command with an AI, spec first: `./agora help extend`. The source of the guide is [`docs-src/`](docs-src/); its
reference chapters are generated, so edit the code they come from and run `./agora docs generate`. Nothing is written to a README that a
topic or the guide already says.

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

One command line, `agora`, runs every check, build and record here. It needs only [`uv`](https://docs.astral.sh/uv/) on your machine: `uv` fetches
[`archon`](https://github.com/intellectual-frontiers/workspaces-host), the command runner, and `archon` supplies the newest Python (3.14), the locked
packages and any program outside Python (a typesetter, a browser, a Java runtime) that a command names, from one already on your machine when it is
new enough, else from your package manager, else its own download checked by fingerprint. A person, a CI job and an AI agent run the same commands;
`./agora doctor` says what this machine has.

## The flow

1. Clone this repository, install `uv` ([how](https://docs.astral.sh/uv/getting-started/installation/)) and run `./agora help start`. Nothing else is
   installed by hand: the first run fetches what the command needs and says what it is doing, with progress at a terminal. A machine with no person
   at it works the same way ([`AGENTS.md`](AGENTS.md)). [`ws-host`](https://github.com/intellectual-frontiers/workspaces-host) is the friendlier
   environment for a person, and is optional.
2. The daily work is documented in one place, the program, and in VS Code every step is a button ([IF Console](tools/if-console/), Learn).
3. Work spec first: the spec, then the ontology, then everything else. `./agora help specs` has the steps.
4. Before you push, run `./agora check --suite spec` (with `--available` where a program cannot be had), `./agora test` and `./agora fresh`. `./agora help check` says what else.

## Set up a new computer

One line in a Debian terminal gives a new computer everything this organization's work needs, and copies the harness to it. The harness is the
Intellectual Frontiers AI Workforce® Harness; `archon` is its command line (the Console is the web interface built into the website).

```sh
curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/bootstrap-archon.sh | sh
```

**What it needs.** A Debian 12 or 13 terminal, `amd64` or `arm64`: either a Debian window under **WSL** (Windows Subsystem for Linux, the
Linux that runs inside Windows 11; install Debian from the Microsoft Store) or a Debian virtual machine. Also an internet connection, a
Linux account that may use `sudo`, and your GitHub login with access to the harness repository (`archon` is private).

**What it does,** each step showing one line with a spinner, and nothing you did not ask for:

1. Says why it needs administrator rights, asks for your Linux password once, and installs what Debian lacks: `git`, `gh` (GitHub's command
   line), `curl`, `jq`, `ripgrep`, `python3`, `nodejs`, a browser for tests and the rest of the everyday tools.
2. Installs `uv` (the Python package runner every repository's launcher needs) and Python 3.14, through the pinned `mise`, and the modern
   command line tools (`eza`, `bat`, `zoxide`, `fzf`, `delta`, `btop` and others), each checked against its publisher's checksum.
3. Installs **fish** (a friendlier shell, version 4 or later), **Oh My Posh** (the program that draws your prompt, with the `ws-host-pretty`
   theme) and **chezmoi** (the program that edits your startup files, `~/.bashrc` and fish's `config.fish`, only between marked lines,
   after keeping a copy).
4. Signs you in to GitHub with a one-time code and your browser (no password, token or SSH key), and puts your GitHub name and private
   address on your git commits where git has none.
5. Creates your **workspace**, the folder `~/workspaces` where repositories live as `github.com/<organization>/<repository>`, and copies
   `archon` to `~/workspaces/github.com/intellectual-frontiers/archon` (an existing copy is only moved forward, never over your work).
6. Offers to make fish your **login shell**, the program that starts in each new terminal window. Say no and bash stays; no question is
   asked when nobody is at the terminal.
7. In the copy, runs `./archon doctor` (what this computer has), `./archon toolchain ensure` (the programs archon's commands need) and
   `./archon check`, and says what to do next: `archon orch status`, then `archon orch dev`.

**The prompt needs a Nerd Font,** a font that carries icon characters, installed once on Windows and chosen in Windows Terminal (the
script prints the steps). Without one, run the line again with `BOOTSTRAP_PROMPT=plain`.

It is safe to run again: what is in place changes nothing. To see the steps without taking them, add `-s -- --dry-run` after `sh`. The
switches that turn a step off (`BOOTSTRAP_NO_APT`, `BOOTSTRAP_NO_CHSH`, `BOOTSTRAP_NO_CLONE` and the others) are listed at the top of
[`bin/bootstrap-archon.sh`](bin/bootstrap-archon.sh); the rules are [`0053-machine-bootstrap`](spec-kit/specs/0053-machine-bootstrap/spec.md).

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

# `.github` — agent entry point

This repository is small on purpose: the organization's public profile (`profile/`), the two machine setup scripts (`bin/`) and its tests
(`tests/`). The script's specification is `0136-machine-bootstrap` in `archon`, like every other specification (archon's 0006-eidolon-architecture FR-042). Everything else (the harness, specs, ontology, design systems, content) is in the private `archon` repository; do not add any of it here.

- Work spec first: change `0136-machine-bootstrap` in `archon`, then the script, then the tests. Every requirement has a test or says why it has none.
- Run `python3 -m unittest discover -s tests` before you push (`.github/workflows/tests.yml` runs it on every push and pull request). It needs only the standard library, and a `Slim` test fails if a new top-level entry appears.
- `bin/archon-bootstrap.sh` (the one that may use administrator rights) and `bin/archon-setup.sh` (which never does, and writes only inside one account's home folder) are POSIX `sh`, run from a pipe (`curl ... | sh`), and must stay readable by a newcomer. Each is one file with no data beside it; the bootstrap loads the setup's functions and runs the same file as the account. The setup writes no startup file: `archon shell` does (archon's 0138-shell), and the settings file it keeps must stay what `archon secrets` writes.
- Never put a secret, a token or a person's data in this repository: it is public.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the author of that commit in its message; an agent's part is a
`Co-Authored-By` trailer.

# `.github` — agent entry point

This repository is small on purpose: the organization's public profile (`profile/`), the machine setup script and its helpers (`bin/`), the script's specification (`spec/`) and its tests
(`tests/`). Everything else (the harness, specs, ontology, design systems, content) is in the private `archon` repository; do not add any of it here.

- Work spec first: change `spec/0053-machine-bootstrap.md`, then the script, then the tests. Every requirement has a test or says why it has none.
- Run `python3 -m unittest discover -s tests` before you push. It needs only the standard library, and a `Slim` test fails if a new top-level entry appears.
- `bin/bootstrap-archon.sh` is POSIX `sh`, runs from a pipe (`curl ... | sh`), and must stay readable by a newcomer. The settings blocks it writes (`secrets_block`, `secrets_fish`) must stay byte for byte what
  `archon secrets` writes in the `archon` repository.
- Never put a secret, a token or a person's data in this repository: it is public.

Every commit's author and committer is Shahid Shah <shahid@shah.org> unless a person expressly authorizes an agent to be the author of that commit in its message; an agent's part is a
`Co-Authored-By` trailer.

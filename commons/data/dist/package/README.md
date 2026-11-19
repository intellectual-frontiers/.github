# arcactl

Check, set up and maintain the arca data models in PostgreSQL, from a terminal or a pipeline.

```sh
bunx @intellectual-frontiers/arcactl doctor --models identityAgent     # with Bun
npx @intellectual-frontiers/arcactl doctor --models identityAgent      # with Node 22 or later
eval "$(arcactl shell)"                                               # bash, zsh; fish, PowerShell and nushell too
```

- `arcactl doctor` is read-only: it checks a database against the models and says what has drifted or been weakened, with an exit code a pipeline can use.
- `arcactl shell` prints the script a shell sources: the `ARCA_*`, `PGSERVICE` and `PGOPTIONS` setup, a few functions and completions. It holds no password and connects to nothing.
- The connection comes from `ARCA_DATABASE_URL` (or `ARCA_DATABASE_URL_FILE`), or from libpq's own environment and files, as `psql` does. A password is never an option and is never printed.
- On Bun it uses Bun's own PostgreSQL client. On Node it uses `pg`, which is installed with it where optional dependencies are.

The sources and the specifications are in https://github.com/intellectual-frontiers/.github/tree/main/commons/data

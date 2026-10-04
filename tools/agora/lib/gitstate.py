"""Reading Git's state, with dulwich (0042-agora FR-030; 0041-command-line FR-041: a command may read Git's state).

`agora` runs no `git` program: this module reads the repository itself with the pinned `dulwich` package, so what
`check --changed` and `fresh --changed` see is the same on every host. It runs as `python -m agora.lib.gitstate ROOT
[SINCE]` under the vcs group's locked environment (core/checks.py starts it) and prints the changed paths as JSON; the
package is imported where it is used, so that a process that holds no lock can still import this module.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def commit_of(repo, spec: str):
    """The commit a revision names: a branch, tag or (abbreviated) id, followed by `~N` and `^N` steps, as `git rev-parse` reads them."""
    import re
    from dulwich.objectspec import parse_commit

    base, steps = re.fullmatch(r"(.*?)((?:[~^]\d*)*)", spec).groups()
    commit = parse_commit(repo, base)
    for kind, count in re.findall(r"([~^])(\d*)", steps):
        if kind == "~":
            for _ in range(int(count or 1)):
                commit = repo[commit.parents[0]]
        elif count != "0":
            commit = repo[commit.parents[int(count or 1) - 1]]
    return commit


def changed(root: Path, since: str | None = None) -> list[str]:
    """Paths Git reports as changed in the working tree, staged, or untracked, or that differ from `since`."""
    from dulwich import porcelain
    from dulwich.diff_tree import tree_changes
    from dulwich.repo import Repo

    out: set[str] = set()
    with Repo(str(root)) as repo:
        status = porcelain.status(repo, untracked_files="all")
        for names in status.staged.values():
            out.update(n.decode("utf-8", "replace") for n in names)
        out.update(n.decode("utf-8", "replace") for n in status.unstaged)
        out.update(n.decode("utf-8", "replace") if isinstance(n, bytes) else n for n in status.untracked)
        if since:
            old = commit_of(repo, since).tree
            new = repo[repo.head()].tree
            for c in tree_changes(repo.object_store, old, new):
                for side in (c.old, c.new):
                    if side is not None and side.path:
                        out.add(side.path.decode("utf-8", "replace"))
    return sorted(out)


def main(argv: list[str]) -> int:
    try:
        print(json.dumps(changed(Path(argv[1]), argv[2] if len(argv) > 2 and argv[2] else None)))
    except Exception as e:  # reported as the one line the caller turns into an error resource
        print(f"{type(e).__name__}: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

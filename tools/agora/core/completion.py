"""Shell completion derived from the registry (0041-command-line FR-012, FR-013).

Not a command: the launcher passes `--complete WORD...` (the words typed so far, the last possibly partial) and
`--completion-script bash|zsh` straight here.
"""
from __future__ import annotations

from .ctx import Ctx
from .registry import Command, WRITES

GLOBAL_FLAGS = ["--json", "--html", "--root", "--offline", "--debug", "--no-log", "--help"]


def complete(ctx: Ctx, words: list[str]) -> list[str]:
    reg = ctx.registry
    cur, prior = (words[-1], words[:-1]) if words else ("", [])
    cmd, rest = reg.lookup(prior)
    if cmd is None:
        if not [w for w in prior if not w.startswith("-")]:
            cands = [w for w in reg.first_words() if any(c.status == "implemented" and c.words[0] == w
                                                         for c in reg.commands.values())]
            cands += GLOBAL_FLAGS if cur.startswith("-") else []
        else:
            noun = [w for w in prior if not w.startswith("-")][0]
            cands = [c.words[1] for c in reg.commands_under(noun) if c.status == "implemented"]
        return sorted(c for c in set(cands) if c.startswith(cur))
    if cmd.status != "implemented":
        return []
    opts = {o.flag: o for o in cmd.options}
    if rest and rest[-1] in opts and opts[rest[-1]].type:
        return _values(ctx, opts[rest[-1]].type, cur)
    if cur.startswith("-"):
        flags = [o.flag for o in cmd.options] + GLOBAL_FLAGS + (["--dry-run"] if cmd.category in WRITES else [])
        return sorted(f for f in set(flags) if f.startswith(cur))
    n, i = 0, 0
    while i < len(rest):
        t = rest[i]
        if t in opts:
            i += 2 if opts[t].type else 1
        elif t.startswith("-"):
            i += 2 if t == "--root" else 1
        else:
            n += 1
            i += 1
    if n < len(cmd.args):
        return _values(ctx, cmd.args[n].type, cur)
    return []


def _values(ctx: Ctx, type_name: str, cur: str) -> list[str]:
    t = ctx.registry.types.get(type_name)
    if t is None:
        return []
    try:
        return sorted(t.complete(ctx, cur))
    except Exception:
        return []


def script(shell: str, name: str) -> str:
    """A completion script that asks the launcher for candidates, so it can never fall out of date."""
    if shell == "bash":
        return (f"_{name}_complete() {{\n  local IFS=$'\\n'\n"
                f"  COMPREPLY=($(\"${{COMP_WORDS[0]}}\" --complete \"${{COMP_WORDS[@]:1:COMP_CWORD}}\" 2>/dev/null))\n}}\n"
                f"complete -o default -F _{name}_complete {name}\n")
    if shell == "zsh":
        return (f"#compdef {name}\n_{name}() {{\n  local -a c\n"
                f"  c=(\"${{(@f)$(\"${{words[1]}}\" --complete \"${{(@)words[2,CURRENT]}}\" 2>/dev/null)}}\")\n"
                f"  compadd -a c\n}}\ncompdef _{name} {name}\n")
    raise ValueError(f"no completion script for {shell}; bash and zsh are supported")

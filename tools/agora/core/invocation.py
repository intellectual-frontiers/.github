"""Whether a command line, as a register row writes it, names a command of this registry (0020-spec-format FR-013)."""
from __future__ import annotations

import shlex
from dataclasses import replace

from . import cli, runner
from .ctx import Ctx
from .resource import AgoraError


def problem(ctx: Ctx, text: str) -> str | None:
    """Why `text` ("agora check specs") is not a valid invocation of this command line, or None."""
    reg = ctx.registry
    try:
        tokens = shlex.split(text)
    except ValueError as e:
        return f"{text!r} is not a command line ({e})"
    if not tokens or tokens[0] != reg.name:
        return f"a row of this repository's register names a {reg.name} command; {text!r} does not start with {reg.name}"
    cmd, rest = reg.lookup(tokens[1:])
    if cmd is None:
        return f"{' '.join(tokens[1:3])!r} is not a command in the {reg.name} registry"
    if cmd.status == "planned":
        return None  # declared in the registry's manifest; its arguments are not known yet
    home_ctx = replace(ctx, root=ctx.home)  # the commands run in this repository
    try:
        values = cli.parse_values(home_ctx, cmd, rest)
        if cmd.id == "check":
            runner.validate_selection(home_ctx, values["sections"], values["suite"], values["scope"], values["runner"],
                                      values["brand"], values["paragon"], mode=values["mode"], draft=values["draft"],
                                      spoken=values["spoken"])
    except AgoraError as e:
        return f"{text!r}: {e.message}"
    return None

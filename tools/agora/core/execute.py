"""Running a command for a surface that has no command line, an editor or MCP (0041-command-line FR-024): the same library call as
the terminal, and the same record.

`cli.invoke` is the seam. A command of a group that pins packages runs in its own worker under that group's locked plan
(0041 FR-028), the only process the surface starts for a command; everything else runs in this process.
"""
from __future__ import annotations

import traceback
from typing import Any, Callable, Iterator

from agora.core import cli, logs, plan, worker
from agora.core.ctx import Ctx
from agora.core.registry import Command
from agora.core.resource import FAILED, OK, AgoraError, Resource


def new_ctx(registry: Any, home: Any, env: dict[str, str], *, surface: str = "cli", dry_run: bool = False, no_log: bool = False,
            on_section: Callable[[str, str, Any], None] | None = None) -> Ctx:
    ctx = Ctx(registry, home, home, surface=surface, env=dict(env))
    ctx.offline = env.get(f"{registry.name.upper()}_OFFLINE") == "1"
    ctx.dry_run, ctx.no_log = dry_run, no_log
    ctx.on_section = on_section
    return ctx


def execute(ctx: Ctx, cmd: Command, values: dict[str, Any]) -> Iterator[Resource]:
    """Each resource the command returns, in order; a failure is an error resource, never an exception (0041 FR-020)."""
    reg = ctx.registry
    code, trace = OK, None
    ctx.values = values
    try:
        cli.check_programs(ctx, cmd)
        p = plan.plan_for(reg, cmd.group)
        if not p.stdlib and ctx.env.get("AGORA_PLAN_GROUP") != cmd.group:
            result: Any = worker.run_command(ctx, cmd, values)
        else:
            result = cli.invoke(ctx, cmd, values)
        for r in [result] if isinstance(result, Resource) else result:
            code = max(code, r.exit)
            yield r
    except AgoraError as e:
        code = e.exit
        yield e.resource()
    except Exception as e:
        trace = traceback.format_exc()
        code = FAILED
        yield cli.internal_error(ctx, e, trace, cmd)
    finally:
        if not ctx.no_log and (logs.worth_logging(cmd.category) or trace):
            logs.write(ctx.home / reg.root_manifest.get("logs", ".agora/logs"), surface=ctx.surface, command=cmd.id,
                       args=cli.loggable(cmd, values), exit=code, dry_run=ctx.dry_run, trace=trace)

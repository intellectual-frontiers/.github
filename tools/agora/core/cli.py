"""The parser and dispatcher: `agora <noun> <verb> [ID] [--options]` (0041-command-line FR-008 to FR-024).

Parsing, rendering, logging, plan selection and error handling live here, so a command is thin (FR-024). Surfaces
other than the terminal call `invoke()`, which is everything below the parser.
"""
from __future__ import annotations

import argparse
import difflib
import io
import os
import shutil
import sys
import traceback
from pathlib import Path
from typing import Any, Iterator

from . import completion, logs, plan, render
from .checks import find_program
from .ctx import Ctx
from .registry import WRITES, Command, Opt, Registry
from .resource import FAILED, MISSING, OK, USAGE, Action, AgoraError, Call, Link, Resource, next_command

HOME = Path(__file__).resolve().parents[3]


class _Parser(argparse.ArgumentParser):
    def error(self, message: str):  # argparse would print and exit
        raise AgoraError("usage", message, exit=USAGE, actions=[next_command("see how it is used", "command show",
                                                                             command=self.prog.split(" ", 1)[-1].split())])


def split_globals(argv: list[str]) -> tuple[list[str], dict[str, Any]]:
    """Take the options every command shares out of the line, wherever they stand."""
    g: dict[str, Any] = {"json": False, "html": False, "debug": False, "offline": False, "no_log": False,
                         "root": None, "dry_run": False, "help": False}
    rest: list[str] = []
    i = 0
    while i < len(argv):
        t = argv[i]
        if t == "--":
            rest += argv[i:]
            break
        if t in ("--json", "--html", "--debug", "--offline", "--dry-run"):
            g[t[2:].replace("-", "_")] = True
        elif t == "--no-log":
            g["no_log"] = True
        elif t in ("-h", "--help"):
            g["help"] = True
        elif t == "--root":
            if i + 1 >= len(argv):
                raise AgoraError("usage", "--root needs a directory", exit=USAGE)
            g["root"] = argv[i + 1]
            i += 1
        elif t.startswith("--root="):
            g["root"] = t[len("--root="):]
        else:
            rest.append(t)
        i += 1
    return rest, g


def main(argv: list[str] | None = None, *, home: Path | None = None, stdout: Any = None, stderr: Any = None,
         env: dict[str, str] | None = None, surface: str = "cli", registry: Registry | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    out, err = stdout or sys.stdout, stderr or sys.stderr
    env = dict(os.environ if env is None else env)
    home = (home or HOME).resolve()
    try:
        reg = registry or Registry.load(home)
    except Exception as e:  # a broken registry cannot render its own errors through itself
        print(f"error: the registry did not load: {type(e).__name__}: {e}", file=err)
        return FAILED
    ctx = Ctx(reg, home, home, surface=surface, env=env)
    if argv[:1] == ["--complete"]:
        print("\n".join(completion.complete(ctx, argv[1:])), file=out)
        return OK
    if argv[:1] == ["--completion-script"]:
        try:
            print(completion.script(argv[1] if len(argv) > 1 else "", reg.name), end="", file=out)
            return OK
        except ValueError as e:
            print(f"error: {e}", file=err)
            return USAGE
    fmt = "json" if "--json" in argv else "html" if "--html" in argv else "text"
    debug = "--debug" in argv
    try:
        tokens, g = split_globals(argv)
        fmt = "json" if g["json"] else "html" if g["html"] else "text"
        if g["json"] and g["html"]:
            raise AgoraError("usage", "--json and --html are two renderings; choose one", exit=USAGE)
        ctx.offline = g["offline"] or env.get(f"{reg.name.upper()}_OFFLINE") == "1"
        ctx.debug, ctx.dry_run = g["debug"], g["dry_run"]
        if g["root"]:
            root = Path(g["root"]).expanduser()
            if not root.is_dir():
                raise AgoraError("invalid-argument", f"--root {g['root']!r} is not a directory", exit=USAGE)
            ctx.root = root.resolve()
        return _run(ctx, tokens, g, fmt, out, err)
    except AgoraError as e:
        _emit(ctx, e.resource(), fmt, out, err)
        return e.exit
    except Exception as e:  # 0041 FR-020: never a stack trace as the error
        _emit(ctx, internal_error(ctx, e, traceback.format_exc(), None), fmt, out, err)
        return FAILED


def internal_error(ctx: Ctx, e: Exception, trace: str, cmd: Command | None) -> Resource:
    data = {"code": "internal", "message": f"{type(e).__name__}: {e}"}
    if ctx.debug:
        data["trace"] = trace
    return Resource("error", "internal", data, exit=FAILED,
                    actions=[next_command("run it again with --debug to see the trace", "doctor")])


def _run(ctx: Ctx, tokens: list[str], g: dict[str, Any], fmt: str, out: Any, err: Any) -> int:
    reg = ctx.registry
    cmd, rest = reg.lookup(tokens)
    if cmd is None:
        res = _help_for(ctx, tokens)
        _emit(ctx, res, fmt, out, err)
        return OK if g["help"] else res.exit
    if g["help"]:
        _emit(ctx, _command_help(ctx, cmd), fmt, out, err)
        return OK
    if g["dry_run"] and cmd.category not in WRITES:
        raise AgoraError("usage", f"{cmd.id} writes nothing, so it takes no --dry-run (0041 FR-015)", exit=USAGE)
    if ctx.relocated and (cmd.category in WRITES or not cmd.relocatable):
        why = "a command that writes refuses --root" if cmd.category in WRITES else f"{cmd.id} is not relocatable"
        raise AgoraError("usage", f"--root: {why} (0041 FR-040)", exit=USAGE)
    try:
        values = parse_values(ctx, cmd, rest)
    except AgoraError as e:  # a refused invocation is still a command run (0041 FR-042); its words are not logged
        if not g["no_log"] and logs.worth_logging(cmd.category):
            logs.write(ctx.home / reg.root_manifest.get("logs", ".agora/logs"), surface=ctx.surface, command=cmd.id,
                       args={}, exit=e.exit, dry_run=ctx.dry_run)
        raise
    ctx.values = values
    code, trace = OK, None
    try:
        check_programs(ctx, cmd)
        _ensure_plan(ctx, cmd, tokens)
        result = cmd.fn(ctx, **values)
        code = _emit_result(ctx, result, fmt, out, err)
    except AgoraError as e:
        code = e.exit
        _emit(ctx, e.resource(), fmt, out, err)
    except Exception as e:  # 0041 FR-020: never a stack trace as the error
        trace = traceback.format_exc()
        code = FAILED
        _emit(ctx, internal_error(ctx, e, trace, cmd), fmt, out, err)
    if not g["no_log"] and (logs.worth_logging(cmd.category) or trace):
        logs.write(ctx.home / reg.root_manifest.get("logs", ".agora/logs"), surface=ctx.surface, command=cmd.id,
                   args=loggable(cmd, values), exit=code, dry_run=ctx.dry_run, trace=trace)
    return code


def invoke(ctx: Ctx, cmd: Command, values: dict[str, Any]) -> Any:
    """What every surface calls: the command's library call, giving its resource (0041 FR-024)."""
    return cmd.fn(ctx, **values)


def loggable(cmd: Command, values: dict[str, Any]) -> dict[str, Any]:
    quiet = {o.dest for o in cmd.options if not o.log}
    return {k: v for k, v in values.items() if v not in (None, False, []) and k not in quiet}


def check_programs(ctx: Ctx, cmd: Command) -> None:
    for prog in cmd.programs:
        if find_program(ctx.registry, prog, ctx.env) is None:
            hint = ctx.registry.program(prog).get("hint", f"install {prog} on the host")
            raise AgoraError("missing-program", f"{cmd.id} needs {prog}, which is not on PATH", exit=MISSING,
                             detail={"program": prog, "hint": hint}, actions=[next_command("see what is missing", "doctor")])


def _ensure_plan(ctx: Ctx, cmd: Command, tokens: list[str]) -> None:
    """0041 FR-002: a command in a group that pins packages runs under that group's locked environment."""
    p = plan.plan_for(ctx.registry, cmd.group)
    if p.stdlib or ctx.env.get("AGORA_PLAN_GROUP") == cmd.group:
        return
    py = plan.prepare(ctx.registry, cmd.group, offline=ctx.offline, command=cmd.id)
    os.execve(str(py), plan.reexec_argv(py, sys.argv[1:]), {**ctx.env, "AGORA_PLAN_GROUP": cmd.group,
                                                           "PYTHONPATH": str(ctx.home / "tools")})


# parsing and typed arguments -----------------------------------------------------------------------------------
def build_parser(cmd: Command) -> argparse.ArgumentParser:
    p = _Parser(prog=cmd.id, add_help=False)
    for a in cmd.args:
        p.add_argument(a.name, nargs="*" if a.many else "+" if a.words else (None if a.required else "?"), metavar=a.type)
    for o in cmd.options:
        kw: dict[str, Any] = {"dest": o.dest, "default": o.default, "required": o.required}
        if o.type is None:
            kw["action"] = "store_true"
            kw["default"] = False
            kw.pop("required")
        elif o.multiple:
            kw["action"] = "append"
            kw["default"] = o.default or []
        if o.type is not None:
            kw["metavar"] = o.type
        p.add_argument(o.flag, *([o.alias] if o.alias else []), **kw)
    return p


def parse_values(ctx: Ctx, cmd: Command, rest: list[str]) -> dict[str, Any]:
    ns = vars(build_parser(cmd).parse_args(rest))
    values: dict[str, Any] = {}
    for a in cmd.args:
        v = ns[a.name]
        if a.many:
            values[a.name] = [convert(ctx, a.type, a.name, x) for x in v]
            continue
        if v is not None and a.words:
            v = " ".join(v)
        values[a.name] = convert(ctx, a.type, a.name, v) if v is not None else None
    for o in cmd.options:
        v = ns[o.dest]
        if o.type and v not in (None, []):
            v = [convert(ctx, o.type, o.flag, x) for x in v] if o.multiple else convert(ctx, o.type, o.flag, v)
        values[o.dest] = v
    return values


def _as_list(v: Any) -> list[str]:
    items = v if isinstance(v, (list, tuple)) else str(v or "").splitlines()
    return [x.strip() for x in items if str(x).strip()]


def values_from_raw(ctx: Ctx, cmd: Command, raw: dict[str, Any]) -> dict[str, Any]:
    """What a surface that has no command line (a web form) gives a command: strings, lists and flags by name, validated by
    the same types as the terminal's words (0041 FR-013, FR-024)."""
    values: dict[str, Any] = {}
    for a in cmd.args:
        v = raw.get(a.name)
        if a.many:
            values[a.name] = [convert(ctx, a.type, a.name, x) for x in _as_list(v)]
            continue
        v = None if v is None or (isinstance(v, (list, tuple)) and not v) else (v[0] if isinstance(v, (list, tuple)) else v)
        v = str(v).strip() if v is not None else None
        if not v:
            if a.required:
                raise AgoraError("usage", f"{a.name} is required: a {a.type}", exit=USAGE,
                                 actions=[next_command("see how it is used", "command show", command=cmd.id)])
            values[a.name] = None
            continue
        values[a.name] = convert(ctx, a.type, a.name, v)
    for o in cmd.options:
        v = raw.get(o.dest)
        if o.type is None:
            values[o.dest] = (v[0] if isinstance(v, (list, tuple)) and v else v) in (True, "true", "on", "yes", "1")
        elif o.multiple:
            values[o.dest] = [convert(ctx, o.type, o.flag, x) for x in _as_list(v)] or (o.default or [])
        else:
            v = str(v[0] if isinstance(v, (list, tuple)) and v else v or "").strip()
            if not v:
                if o.required:
                    raise AgoraError("usage", f"{o.flag} is required: a {o.type}", exit=USAGE,
                                     actions=[next_command("see how it is used", "command show", command=cmd.id)])
                values[o.dest] = o.default
            else:
                values[o.dest] = convert(ctx, o.type, o.flag, v)
    return values


def convert(ctx: Ctx, type_name: str, what: str, value: str) -> Any:
    """Validate a value against its type; a failure names the type and examples of valid values (0041 FR-013)."""
    t = ctx.registry.types.get(type_name)
    if t is None:
        return value
    try:
        return t.validate(ctx, value)
    except ValueError as e:
        try:
            ex = t.examples(ctx)[:5]
        except Exception:
            ex = []
        raise AgoraError("invalid-argument", f"{what}: {e}. A {t.name} is {t.doc}"
                         + (f"; for example {', '.join(ex)}" if ex else ""), exit=USAGE,
                         detail={"type": t.name, "value": value, "examples": ex},
                         actions=[next_command("list the commands", "command list")]) from None


# help ----------------------------------------------------------------------------------------------------------
def _help_for(ctx: Ctx, tokens: list[str]) -> Resource:
    reg = ctx.registry
    words = [t for t in tokens if not t.startswith("-")]
    if not words:
        rows = [{"command": c.id, "category": c.category, "help": c.help} for c in sorted(
            reg.commands.values(), key=lambda c: c.id)]
        res = Resource("help", reg.name, {
            "usage": f"{reg.name} <noun> <verb> [ID] [--options]  |  {reg.name} {{{'|'.join(sorted(w for w in reg.first_words() if w in ('check','fresh','test','doctor','lock','context')))}}} ...",
            "global options": ["--json", "--html", "--root DIR", "--offline", "--dry-run (writes)", "--debug", "--no-log", "--help"],
            "launcher": [f"--complete WORD...  candidates for the words typed so far",
                         "--completion-script bash|zsh  a shell completion script"],
            "commands": rows}, exit=USAGE if not tokens else USAGE)
        res.columns["commands"] = ["command", "category", "help"]
        res.actions = [next_command("list the commands", "command list")]
        return res
    noun = words[0]
    under = reg.commands_under(noun)
    if under and len(words) == 1:
        res = Resource("help", noun, {"usage": f"{reg.name} {noun} <verb> [ID] [--options]",
                                      "commands": [{"command": c.id, "category": c.category, "help": c.help}
                                                   for c in under]}, exit=USAGE)
        res.columns["commands"] = ["command", "category", "help"]
        return res
    guess = difflib.get_close_matches(" ".join(words[:2]), list(reg.commands), n=3)
    guess = guess or difflib.get_close_matches(noun, reg.first_words(), n=3)
    raise AgoraError("unknown-command", f"{' '.join(words[:2])!r} is not a command"
                     + (f"; did you mean {', '.join(repr(x) for x in guess)}?" if guess else ""), exit=USAGE,
                     actions=[next_command("list the commands", "command list")])


def _command_help(ctx: Ctx, c: Command) -> Resource:
    from .describe import command_data
    d = command_data(ctx.registry, c)
    res = Resource("help", c.id, {"usage": d["usage"], "help": c.help, "arguments": d["arguments"], "options": d["options"]})
    res.actions = [next_command("see it in full", "command show", command=c.id)]
    return res


# output --------------------------------------------------------------------------------------------------------
def _emit(ctx: Ctx, res: Resource, fmt: str, out: Any, err: Any) -> None:
    if fmt == "json":
        print(render.to_json(res, ctx), file=out)
    elif fmt == "html":
        print(render.to_html_page(res, ctx), file=out)
    else:
        print(render.to_text(res, ctx), file=err if res.kind == "error" else out)


def _emit_result(ctx: Ctx, result: Any, fmt: str, out: Any, err: Any) -> int:
    if isinstance(result, Resource):
        _emit(ctx, result, fmt, out, err)
        return result.exit
    code = OK  # a stream of resources: NDJSON, one complete document per line (0041 FR-019)
    for res in result:
        if fmt == "json":
            print(render.to_ndjson_line(res, ctx), file=out, flush=True)
        else:
            _emit(ctx, res, fmt, out, err)
        code = max(code, res.exit)
    return code

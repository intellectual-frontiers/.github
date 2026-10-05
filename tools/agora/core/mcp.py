"""The MCP server (0041-command-line FR-027; 0042-agora FR-020): newline-delimited JSON-RPC 2.0 on standard input and output.

Standard library only. Its tools are the registry's commands that declare MCP and are not `decision` commands; a call runs
the command through the registry's library call (core/execute.py) with the surface `mcp`, and returns the command's JSON
resource. Its resources are readable by URI. Nothing but protocol messages is ever written to standard output.
"""
from __future__ import annotations

import contextlib
import json
import sys
from typing import Any, Iterable

from . import cli, execute, render
from .ctx import Ctx
from .describe import tool_schema
from .registry import WRITES, Command, Registry
from .resource import AgoraError, Resource, next_command

VERSIONS = ("2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05")  # newest first (0042 FR-020)

PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS, INTERNAL_ERROR = -32700, -32600, -32601, -32602, -32603
NOT_FOUND = -32002  # a resource that does not exist (MCP)

# MCP resource kinds: the noun in the URI, the command whose resource it is, and the argument that takes the id.
KINDS: dict[str, tuple[str, str | None]] = {
    "spec": ("spec show", "spec"),
    "requirement": ("requirement show", "requirement"),
    "design-system": ("design-system show", "design_system"),
    "brand": ("brand show", "brand"),
    "ontology": ("ontology show", "term"),
    "command": ("command show", "command"),
    "proposal": ("proposal show", "proposal"),
}
LISTED = ("spec", "design-system", "brand", "command", "proposal")  # requirement and ontology are too many: templates only


def tool_name(c: Command) -> str:
    return c.id.replace(" ", "_")


class RpcError(Exception):
    def __init__(self, code: int, message: str, data: Any = None):
        super().__init__(message)
        self.code, self.message, self.data = code, message, data


class Server:
    def __init__(self, registry: Registry, home: Any, env: dict[str, str] | None = None):
        self.reg, self.home, self.env = registry, home, dict(env or {})
        self.initialized = False
        self.version = VERSIONS[0]

    # tools -------------------------------------------------------------------------------------------------------
    def exposed(self) -> dict[str, Command]:
        """The tools: every command that declares MCP and is not a decision command (0041 FR-022, FR-023)."""
        return {tool_name(c): c for c in sorted(self.reg.commands.values(), key=lambda c: c.id)
                if "mcp" in self.reg.surfaces_of(c) and c.category != "decision"}

    def ctx(self, **kw: Any) -> Ctx:
        return execute.new_ctx(self.reg, self.home, self.env, surface="mcp", **kw)

    def tool_list(self) -> list[dict[str, Any]]:
        ctx = self.ctx()
        out = []
        for name, c in self.exposed().items():
            schema = tool_schema(self.reg, ctx, c)
            schema["additionalProperties"] = False
            writes = c.category in WRITES
            out.append({"name": name, "title": c.id, "description": f"{c.help} (category: {c.category}"
                        + ("; a dry run unless dry_run is false)" if writes else ")"),
                        "inputSchema": schema,
                        "annotations": {"readOnlyHint": not writes, "openWorldHint": False}})
        return out

    def refusal(self, c: Command) -> Resource:
        res = Resource("error", "decision-refused", {
            "code": "decision-refused",
            "message": f"{c.id} is a decision command: only a person decides it, in the terminal or the editor, and it is never callable "
                       "over MCP (0041-command-line FR-023). Draft the decision as a proposal for a person to accept."},
            actions=[next_command("draft it as a proposal for a person to decide", "proposal new")], exit=1)
        return res

    def tool_call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        cmd = next((c for c in self.reg.commands.values() if tool_name(c) == name), None)
        if cmd is None:
            raise RpcError(INVALID_PARAMS, f"unknown tool: {name}")
        if cmd.category == "decision":  # not listed, and refused if named (0041 FR-023); no declaration changes this
            self.log_refusal(cmd, arguments)
            return self.result([self.refusal(cmd)], True)
        if name not in self.exposed():
            raise RpcError(INVALID_PARAMS, f"unknown tool: {name}")
        if not isinstance(arguments, dict):
            raise RpcError(INVALID_PARAMS, "arguments must be an object")
        writes = cmd.category in WRITES
        args = dict(arguments)
        dry = args.pop("dry_run", True) if writes else True  # a write is a dry run unless told otherwise (0041 FR-027)
        if not writes and "dry_run" in args:
            args.pop("dry_run")
        ctx = self.ctx(dry_run=bool(dry) if writes else False)
        try:
            known = {a.name for a in cmd.args} | {o.dest for o in cmd.options}
            extra = sorted(set(args) - known)
            if extra:
                raise AgoraError("usage", f"{cmd.id} takes no argument {', '.join(extra)}; it takes {', '.join(sorted(known)) or 'none'}",
                                 exit=2, actions=[next_command("see how it is used", "command show", command=cmd.id)])
            values = cli.values_from_raw(ctx, cmd, args)
            with contextlib.redirect_stdout(sys.stderr):  # a command's own printing is never a protocol message
                resources = list(execute.execute(ctx, cmd, values))
        except AgoraError as e:
            self.log_refusal(cmd, arguments, e.exit)
            resources = [e.resource()]
        return self.result(resources, any(r.kind == "error" for r in resources))

    def log_refusal(self, cmd: Command, arguments: Any, exit: int = 1) -> None:
        from . import logs
        if logs.worth_logging(cmd.category):
            logs.write(self.home / self.reg.root_manifest.get("logs", ".agora/logs"), surface="mcp", command=cmd.id, args={}, exit=exit)

    def result(self, resources: Iterable[Resource], is_error: bool) -> dict[str, Any]:
        docs = [r.to_dict(self.reg, self.reg.audience, self.reg.name) for r in resources]
        out: dict[str, Any] = {"content": [{"type": "text", "text": json.dumps(d, ensure_ascii=False)} for d in docs],
                               "isError": is_error}
        if len(docs) == 1:
            out["structuredContent"] = docs[0]
        return out

    # resources ---------------------------------------------------------------------------------------------------
    def uri(self, kind: str, ident: str | None = None) -> str:
        return f"{self.reg.name}://{kind}" + (f"/{ident.replace(' ', '+')}" if ident else "")

    def readable(self, kind: str) -> Command | None:
        cmd = self.reg.find(KINDS[kind][0])
        return cmd if cmd is not None and "mcp" in self.reg.surfaces_of(cmd) and cmd.category != "decision" else None

    def resource_list(self) -> list[dict[str, Any]]:
        ctx, out = self.ctx(), []
        for kind in LISTED:
            cmd = self.readable(kind)
            if cmd is None or not cmd.args:
                continue
            t = self.reg.types.get(cmd.args[0].type)
            for ident in sorted(t.choices(ctx)) if t else []:
                out.append({"uri": self.uri(kind, ident), "name": f"{kind} {ident}", "mimeType": "application/json",
                            "description": f"The {kind} {ident}, as {cmd.id} returns it"})
        return out

    def template_list(self) -> list[dict[str, Any]]:
        n = self.reg.name
        rows = [("requirement", f"{n}://requirement/{{spec}}/{{id}}", "A requirement, as requirement show returns it: SPEC/FR-NNN"),
                ("ontology", f"{n}://ontology/{{id}}", "A term of the ontology by CURIE or IRI"),
                ("spec", f"{n}://spec/{{id}}", "A spec by NNNN, NNNN-slug or a design system's slug"),
                ("design-system", f"{n}://design-system/{{slug}}", "A design system"),
                ("brand", f"{n}://brand/{{slug}}", "A brand"),
                ("command", f"{n}://command/{{words}}", "A command, its words joined by +"),
                ("proposal", f"{n}://proposal/{{id}}", "A proposal"),
                ("context", f"{n}://context/{{resource}}", "What an agent needs to work on a resource, as context returns it: KIND:ID")]
        return [{"uriTemplate": t, "name": k, "description": d, "mimeType": "application/json"} for k, t, d in rows
                if k == "context" and self.reg.find("context") or (k in KINDS and self.readable(k))]

    def resource_read(self, uri: str) -> dict[str, Any]:
        prefix = f"{self.reg.name}://"
        if not isinstance(uri, str) or not uri.startswith(prefix):
            raise self.not_found(uri, f"{uri!r} is not a {self.reg.name}:// URI")
        kind, _, ident = uri[len(prefix):].partition("/")
        ident = ident.replace("+", " ")
        ctx = self.ctx()
        if kind == "context":
            cmd, values = self.reg.find("context"), {"resource": ident}
            if cmd is None or "mcp" not in self.reg.surfaces_of(cmd):
                raise self.not_found(uri, "context is not exposed")
        elif kind in KINDS and self.readable(kind):
            cmd = self.readable(kind)
            values = {KINDS[kind][1]: ident} if KINDS[kind][1] else {}
            if KINDS[kind][1] is None and ident not in ("", "reference"):
                raise self.not_found(uri, f"{uri} names no {kind}")
        else:
            raise self.not_found(uri, f"{kind!r} is not a kind of resource this server reads: "
                                 + ", ".join([*KINDS, "context"]))
        try:
            if kind == "context":
                values = cli.values_from_raw(ctx, cmd, values)
            elif values:
                values = cli.values_from_raw(ctx, cmd, values)
            res = next(iter(execute.execute(ctx, cmd, values)))
        except AgoraError as e:
            res = e.resource()
        if res.kind == "error":
            raise self.not_found(uri, res.data["message"], res)
        doc = json.dumps(res.to_dict(self.reg, self.reg.audience, self.reg.name), ensure_ascii=False)
        return {"contents": [{"uri": uri, "mimeType": "application/json", "text": doc}]}

    def not_found(self, uri: Any, message: str, res: Resource | None = None) -> RpcError:
        res = res or Resource("error", "not-found", {"code": "not-found", "message": message},
                              actions=[next_command("list the commands", "command list")], exit=1)
        return RpcError(NOT_FOUND, message, {"uri": uri, "resource": res.to_dict(self.reg, self.reg.audience, self.reg.name)})

    # protocol ----------------------------------------------------------------------------------------------------
    def instructions(self) -> str:
        return (f"{self.reg.name}: this repository's command line. Tools are its commands (spaces become underscores); a tool that writes "
                "is a dry run unless dry_run is false. A decision command is for a person and is not offered: draft it with proposal_new. "
                f"Resources are readable at {self.reg.name}://spec/ID, requirement/SPEC/FR-NNN, design-system/SLUG, brand/SLUG, "
                "context/KIND:ID and more; errors come back as resources with next actions.")

    def handle(self, method: str, params: dict[str, Any]) -> Any:
        if method == "initialize":
            asked = params.get("protocolVersion")
            self.version = asked if asked in VERSIONS else VERSIONS[0]
            self.initialized = True
            return {"protocolVersion": self.version,
                    "capabilities": {"tools": {"listChanged": False}, "resources": {"subscribe": False, "listChanged": False}},
                    "serverInfo": {"name": self.reg.name, "title": self.reg.name, "version": "1"},
                    "instructions": self.instructions()}
        if method == "ping":
            return {}
        if not self.initialized:
            raise RpcError(INVALID_REQUEST, "send initialize first")
        if method == "tools/list":
            return {"tools": self.tool_list()}
        if method == "tools/call":
            if not isinstance(params.get("name"), str):
                raise RpcError(INVALID_PARAMS, "tools/call needs a tool name")
            return self.tool_call(params["name"], params.get("arguments") or {})
        if method == "resources/list":
            return {"resources": self.resource_list()}
        if method == "resources/templates/list":
            return {"resourceTemplates": self.template_list()}
        if method == "resources/read":
            return self.resource_read(params.get("uri"))
        raise RpcError(METHOD_NOT_FOUND, f"method not found: {method}")

    def message(self, msg: Any) -> dict[str, Any] | None:
        """The reply to one JSON-RPC message, or None for a notification (which is never answered)."""
        if not isinstance(msg, dict) or msg.get("jsonrpc") != "2.0" or not isinstance(msg.get("method"), str):
            if isinstance(msg, dict) and ("result" in msg or "error" in msg):
                return None  # a reply to a request this server never sends
            return {"jsonrpc": "2.0", "id": msg.get("id") if isinstance(msg, dict) else None,
                    "error": {"code": INVALID_REQUEST, "message": "not a JSON-RPC 2.0 request"}}
        method, params = msg["method"], msg.get("params") or {}
        if "id" not in msg:  # a notification: notifications/initialized, notifications/cancelled and the rest need no work
            return None
        try:
            if not isinstance(params, dict):
                raise RpcError(INVALID_PARAMS, "params must be an object")
            return {"jsonrpc": "2.0", "id": msg["id"], "result": self.handle(method, params)}
        except RpcError as e:
            err: dict[str, Any] = {"code": e.code, "message": e.message}
            if e.data is not None:
                err["data"] = e.data
            return {"jsonrpc": "2.0", "id": msg["id"], "error": err}
        except Exception as e:  # never a stack trace on the wire (0041 FR-020)
            return {"jsonrpc": "2.0", "id": msg["id"], "error": {"code": INTERNAL_ERROR, "message": f"{type(e).__name__}: {e}",
                                                                 "data": {"resource": cli.internal_error(self.ctx(), e, "", None)
                                                                          .to_dict(self.reg, self.reg.audience, self.reg.name)}}}

    def line(self, raw: str) -> str | None:
        try:
            msg = json.loads(raw)
        except ValueError:
            return json.dumps({"jsonrpc": "2.0", "id": None, "error": {"code": PARSE_ERROR, "message": "parse error"}})
        if isinstance(msg, list):  # a batch (older revisions): answered as one array
            replies = [r for r in (self.message(m) for m in msg) if r is not None]
            return json.dumps(replies, ensure_ascii=False) if replies else None
        reply = self.message(msg)
        return json.dumps(reply, ensure_ascii=False) if reply is not None else None

    def serve(self, stdin: Any, stdout: Any) -> None:
        for raw in stdin:
            raw = raw.strip()
            if not raw:
                continue
            out = self.line(raw)
            if out is not None:
                stdout.write(out + "\n")
                stdout.flush()

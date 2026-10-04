"""The HTTP side of a UI: loopback only, standard library only (0041-command-line FR-025; 0042-agora FR-026).

An `App` answers a `Request` with a `Reply` (a whole body) or an `Sse` (server-sent events that Datastar patches into the
page, 0041 FR-026). This module holds what every UI shares: the host, origin and header rules for a request that changes
something, the content security policy, static files and the event stream's framing.
"""
from __future__ import annotations

import json
import mimetypes
import threading
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, unquote, urlsplit

from .state import HOST

MAX_BODY = 1 << 20
TYPES = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8",
         ".md": "text/markdown; charset=utf-8", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png",
         ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".map": "application/json",
         ".gpl": "text/plain; charset=utf-8", ".tsv": "text/plain; charset=utf-8", ".xml": "application/xml", ".xsd": "application/xml"}

# The page may load and request nothing from outside the UI itself (0042 FR-026). Datastar compiles its expressions with
# the Function constructor, so the scripts of a UI page need 'unsafe-eval'; they come from this origin only.
PAGE_CSP = ("default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self'; font-src 'self'; img-src 'self' data:; "
            "connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
# A design system's harness page is served as it is, inline scripts and styles included, and may frame its fixtures.
HARNESS_CSP = ("default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; "
               "connect-src 'self'; base-uri 'self'; frame-ancestors 'self'; form-action 'none'")


@dataclass
class Request:
    method: str
    path: str
    query: dict[str, list[str]] = field(default_factory=dict)
    form: dict[str, list[str]] = field(default_factory=dict)
    headers: Any = None

    def one(self, name: str, default: str = "") -> str:
        v = self.form.get(name) or self.query.get(name) or [default]
        return v[0]

    @property
    def raw(self) -> dict[str, list[str]]:
        return {**self.query, **self.form}


@dataclass
class Reply:
    status: int = 200
    body: bytes = b""
    ctype: str = "text/html; charset=utf-8"
    headers: dict[str, str] = field(default_factory=dict)
    csp: str | None = PAGE_CSP

    @classmethod
    def html(cls, text: str, status: int = 200) -> "Reply":
        return cls(status, text.encode("utf-8"))

    @classmethod
    def text(cls, text: str, status: int = 200) -> "Reply":
        return cls(status, text.encode("utf-8"), "text/plain; charset=utf-8")


class Sse:
    """A response of server-sent events: `produce(emit)` calls `emit(event, data_lines)` as results arrive."""

    def __init__(self, produce: Callable[[Callable[[str, list[str]], None]], None]):
        self.produce = produce


def patch(selector: str, html: str, mode: str = "outer") -> tuple[str, list[str]]:
    """A Datastar event that patches elements: `html` replaces (or, by `mode`, joins) the element `selector` names."""
    lines = [f"selector {selector}", f"mode {mode}"] if selector else []
    lines += [f"elements {l}" for l in html.split("\n")]
    return "datastar-patch-elements", lines


def signals(values: dict[str, Any]) -> tuple[str, list[str]]:
    return "datastar-patch-signals", [f"signals {json.dumps(values)}"]


class App:
    """What a UI is: a name, and an answer for each request."""

    name = "app"

    def handle(self, req: Request) -> Reply | Sse:  # pragma: no cover - implemented by each UI
        raise NotImplementedError

    def writes(self) -> bool:
        """Whether this UI takes a request that changes something at all (the assurance UI takes none)."""
        return True


def static_file(root: Path, rel: str, allowed: Callable[[Path], bool] | None = None, csp: str | None = None) -> Reply:
    """A file under `root`, read-only: never outside it (a symbolic link included), never a directory."""
    try:
        base = root.resolve()
        path = (base / unquote(rel).lstrip("/")).resolve()
    except (OSError, ValueError):
        return Reply.text("not found", 404)
    if base not in path.parents or not path.is_file() or (allowed and not allowed(path.relative_to(base))):
        return Reply.text("not found", 404)
    ctype = TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return Reply(200, path.read_bytes(), ctype, {"Cache-Control": "no-cache"}, csp)


class UIServer:
    """One UI on one loopback port, in this process."""

    def __init__(self, app: App, port: int = 0):
        self.app = app
        self.httpd = ThreadingHTTPServer((HOST, port), self._handler())
        self.httpd.daemon_threads = True
        self.port = self.httpd.server_address[1]
        self.hosts = {f"{HOST}:{self.port}", f"localhost:{self.port}"}
        self.thread: threading.Thread | None = None

    @property
    def url(self) -> str:
        return f"http://{HOST}:{self.port}/"

    def start(self) -> "UIServer":
        self.thread = threading.Thread(target=self.httpd.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True)
        self.thread.start()
        return self

    def serve_forever(self) -> None:
        self.httpd.serve_forever(poll_interval=0.2)

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        if self.thread:
            self.thread.join(timeout=5)

    def _handler(self) -> type:
        outer = self

        class Handler(BaseHTTPRequestHandler):
            server_version = "agora-ui"
            sys_version = ""

            def log_message(self, *args: Any) -> None:  # the action log, not the terminal, is the record (0041 FR-042)
                pass

            def _refuse(self, status: int, why: str) -> None:
                self._send(Reply.text(why, status))

            def _send(self, r: Reply, head: bool = False) -> None:
                self.send_response(r.status)
                self.send_header("Content-Type", r.ctype)
                self.send_header("Content-Length", str(len(r.body)))
                if r.csp:
                    self.send_header("Content-Security-Policy", r.csp)
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Referrer-Policy", "no-referrer")
                for k, v in r.headers.items():
                    self.send_header(k, v)
                self.end_headers()
                if not head:
                    self.wfile.write(r.body)

            def _dispatch(self, method: str) -> None:
                if self.headers.get("Host", "") not in outer.hosts:  # DNS rebinding: only our own address and port
                    return self._refuse(403, "this UI answers only at its own loopback address")
                parts = urlsplit(self.path)
                req = Request(method, parts.path, parse_qs(parts.query, keep_blank_values=True), {}, self.headers)
                if method == "POST":
                    if not outer.app.writes():
                        return self._send(Reply(405, b"this UI takes no request that changes anything", "text/plain", {"Allow": "GET, HEAD"}, None))
                    origin = self.headers.get("Origin")
                    if (origin is not None and origin.removeprefix("http://") not in outer.hosts) or not self.headers.get("Datastar-Request"):
                        return self._refuse(403, "a request that changes something must come from this UI's own page")
                    n = int(self.headers.get("Content-Length") or 0)
                    if n > MAX_BODY:
                        return self._refuse(413, "too large")
                    body = self.rfile.read(n).decode("utf-8", "replace") if n else ""
                    if "json" not in (self.headers.get("Content-Type") or ""):
                        req.form = parse_qs(body, keep_blank_values=True)
                try:
                    reply = outer.app.handle(req)
                except Exception as e:  # a page never shows a stack trace (0041 FR-020)
                    reply = Reply.text(f"internal error: {type(e).__name__}", 500)
                if isinstance(reply, Sse):
                    return self._stream(reply)
                self._send(reply, head=method == "HEAD")

            def _stream(self, sse: Sse) -> None:
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.send_header("Connection", "close")
                self.send_header("Content-Security-Policy", PAGE_CSP)
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()

                def emit(event: str, lines: list[str]) -> None:
                    chunk = f"event: {event}\n" + "".join(f"data: {l}\n" for l in lines) + "\n"
                    self.wfile.write(chunk.encode("utf-8"))
                    self.wfile.flush()

                try:
                    sse.produce(emit)
                except (BrokenPipeError, ConnectionResetError):
                    pass  # the page went away
                except Exception as e:
                    try:
                        emit("datastar-patch-elements", [f"selector #act-panel", "mode inner",
                                                         f"elements <p class=\"fc-error\">internal error: {type(e).__name__}</p>"])
                    except OSError:
                        pass
                self.close_connection = True

            def do_GET(self) -> None:
                self._dispatch("GET")

            def do_HEAD(self) -> None:
                self._dispatch("HEAD")

            def do_POST(self) -> None:
                self._dispatch("POST")

            def _no(self) -> None:
                self._send(Reply(405, b"not allowed", "text/plain", {"Allow": "GET, HEAD, POST"}, None))

            do_PUT = do_DELETE = do_PATCH = do_OPTIONS = _no

        return Handler

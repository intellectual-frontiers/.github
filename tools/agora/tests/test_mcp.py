"""The MCP server (0041-command-line FR-023, FR-027; 0042-agora FR-020): tools from the registry, a write a dry run by default,
a decision never listed and refused, resources by URI, and nothing but protocol on standard output."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from agora.core.mcp import VERSIONS, Server, tool_name
from agora.core.registry import WRITES, Registry

from .helpers import HOME


def msg(i, method, **params):
    return {"jsonrpc": "2.0", "id": i, "method": method, "params": params}


class Session:
    """The server over real pipes: `agora mcp serve` as a client starts it."""

    def __init__(self, home: Path):
        env = {**os.environ, "PYTHONPATH": str(home / "tools"), "PYTHONDONTWRITEBYTECODE": "1"}
        self.p = subprocess.Popen([sys.executable, "-m", "agora", "mcp", "serve"], cwd=home, env=env, stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.n = 0

    def send(self, method, **params):
        self.n += 1
        self.p.stdin.write(json.dumps(msg(self.n, method, **params)) + "\n")
        self.p.stdin.flush()
        line = self.p.stdout.readline()
        reply = json.loads(line)  # every line standard output carries is a JSON-RPC message
        assert reply["id"] == self.n, reply
        return reply

    def notify(self, method, **params):
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": method, "params": params}) + "\n")
        self.p.stdin.flush()

    def call(self, tool, /, **arguments):
        return self.send("tools/call", name=tool, arguments=arguments)["result"]

    def close(self):
        if self.p.stdout.closed:
            return "", "", self.p.returncode
        if not self.p.stdin.closed:
            self.p.stdin.close()
        out = self.p.stdout.read()
        err = self.p.stderr.read()
        self.p.wait(timeout=20)
        self.p.stdout.close()
        self.p.stderr.close()
        return out, err, self.p.returncode


def doc_of(result):
    return json.loads(result["content"][0]["text"])


class OverPipes(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        shutil.copytree(HOME / "tools" / "agora", self.home / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        shutil.copytree(HOME / "ontology", self.home / "ontology")
        shutil.copytree(HOME / "spec-kit", self.home / "spec-kit")
        shutil.copy(HOME / ".gitignore", self.home / ".gitignore")
        self.s = Session(self.home)
        self.addCleanup(self.s.close)
        r = self.s.send("initialize", protocolVersion=VERSIONS[0], capabilities={}, clientInfo={"name": "test", "version": "0"})
        self.init = r["result"]
        self.s.notify("notifications/initialized")  # a notification is never answered

    def test_initialize_negotiates_and_declares_tools_and_resources(self):
        self.assertEqual(self.init["protocolVersion"], VERSIONS[0])
        self.assertIn("tools", self.init["capabilities"])
        self.assertIn("resources", self.init["capabilities"])
        self.assertEqual(self.init["serverInfo"]["name"], "agora")

    def test_a_list_a_read_a_dry_run_write_and_a_refused_decision_in_one_session(self):
        tools = self.s.send("tools/list")["result"]["tools"]
        names = [t["name"] for t in tools]
        self.assertIn("spec_show", names)
        self.assertNotIn("spec_set", names)  # a decision is not listed
        # a read: the command's own resource
        read = self.s.call("spec_show", spec="0020")
        self.assertFalse(read["isError"])
        doc = doc_of(read)
        self.assertEqual((doc["schema"], doc["kind"], doc["id"], doc["audience"]), ("agora/spec@1", "spec", "0020-spec-format", "public"))
        self.assertEqual(read["structuredContent"], doc)
        # a write without dry_run is a dry run: it shows the change and writes nothing
        before = sorted(p.relative_to(self.home) for p in (self.home / "spec-kit").rglob("*"))
        dry = doc_of(self.s.call("spec_new", slug="demo"))
        self.assertTrue(dry["data"]["dry_run"])
        self.assertTrue(dry["data"]["changes"])
        self.assertEqual(sorted(p.relative_to(self.home) for p in (self.home / "spec-kit").rglob("*")), before)
        # the same write with dry_run false writes the spec
        real = doc_of(self.s.call("spec_new", slug="demo", dry_run=False))
        self.assertFalse(real["data"]["dry_run"])
        self.assertTrue(any("demo" in p.name for p in (self.home / "spec-kit" / "specs").iterdir()))
        # a decision is refused, as an error resource that says what to run next, and changes nothing
        status_before = (self.home / "spec-kit" / "specs" / "0020-spec-format" / "spec.md").read_text()
        refused = self.s.call("spec_set", spec="0020", status="Superseded", dry_run=False)
        self.assertTrue(refused["isError"])
        err = doc_of(refused)
        self.assertEqual((err["kind"], err["data"]["code"]), ("error", "decision-refused"))
        self.assertEqual(err["actions"][0]["command"], "proposal new")
        self.assertEqual((self.home / "spec-kit" / "specs" / "0020-spec-format" / "spec.md").read_text(), status_before)
        for decision in ("ink_record", "proposal_advance"):
            self.assertTrue(self.s.call(decision)["isError"], decision)
        out, err_text, code = self.s.close()
        self.assertEqual(code, 0)
        self.assertEqual(out, "")  # nothing is written to standard output once the client has what it asked for

    def test_what_changes_or_runs_something_is_logged_as_mcp_and_a_read_is_not(self):
        self.s.call("spec_show", spec="0020")
        self.s.call("spec_new", slug="demo")
        self.s.call("spec_set", spec="0020", status="Superseded")
        self.s.send("resources/read", uri="agora://spec/0020")
        self.s.close()
        lines = [json.loads(l) for f in (self.home / ".agora" / "logs").glob("*.ndjson") for l in f.read_text().splitlines()]
        mcp = [(l["surface"], l["command"], l.get("dry_run", False)) for l in lines if l["surface"] == "mcp"]
        self.assertEqual(mcp, [("mcp", "spec new", True), ("mcp", "spec set", False)])  # the refused decision is recorded too

    def test_an_error_comes_back_as_a_resource_with_next_actions(self):
        r = self.s.call("spec_show", spec="no-such-spec")
        self.assertTrue(r["isError"])
        err = doc_of(r)
        self.assertEqual((err["kind"], err["data"]["code"]), ("error", "invalid-argument"))
        self.assertTrue(err["actions"])
        r = self.s.call("spec_show", spec="0020", nonsense="x")
        self.assertEqual(doc_of(r)["data"]["code"], "usage")

    def test_stderr_carries_diagnostics_and_stdout_only_protocol(self):
        self.s.call("check", sections=["environment"])
        out, err, code = self.s.close()
        self.assertEqual(out, "")
        self.assertEqual(code, 0)


class InProcess(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reg = Registry.load(HOME)

    def setUp(self):
        self.server = Server(self.reg, HOME, {})

    def rpc(self, method, i=1, **params):
        reply = self.server.line(json.dumps(msg(i, method, **params)))
        return json.loads(reply)

    def init(self, version=VERSIONS[0]):
        return self.rpc("initialize", protocolVersion=version)["result"]

    def test_the_tools_are_exactly_the_commands_that_declare_mcp_and_are_not_decisions(self):  # 0041 FR-022, FR-023, FR-027
        self.init()
        tools = {t["name"]: t for t in self.rpc("tools/list")["result"]["tools"]}
        want = {tool_name(c) for c in self.reg.commands.values() if "mcp" in self.reg.surfaces_of(c) and c.category != "decision"}
        self.assertEqual(set(tools), want)
        self.assertFalse({tool_name(c) for c in self.reg.commands.values() if c.category == "decision"} & set(tools))
        for c in self.reg.commands.values():
            if tool_name(c) not in tools:
                self.assertTrue(c.category in ("decision", "setup"), c.id)
            else:
                schema = tools[tool_name(c)]["inputSchema"]
                self.assertEqual(schema["type"], "object")
                self.assertEqual(("dry_run" in schema["properties"]), c.category in WRITES, c.id)
                if c.category in WRITES:
                    self.assertIs(schema["properties"]["dry_run"]["default"], True)
                self.assertEqual(tools[tool_name(c)]["annotations"]["readOnlyHint"], c.category not in WRITES)

    def test_a_tool_schema_comes_from_the_typed_arguments(self):  # 0041 FR-013
        self.init()
        tools = {t["name"]: t for t in self.rpc("tools/list")["result"]["tools"]}
        s = tools["requirement_set"]["inputSchema"]
        self.assertEqual(sorted(s["required"]), ["mechanism", "requirement"])
        self.assertEqual(s["properties"]["mechanism"]["enum"], ["check", "gate", "review", "none"])
        self.assertEqual(tools["check"]["inputSchema"]["properties"]["sections"]["type"], "array")
        self.assertEqual(tools["check"]["inputSchema"]["properties"]["changed"]["type"], "boolean")
        self.assertEqual(tools["check"]["inputSchema"]["properties"]["scope"]["items"]["type"], "string")

    def test_no_declaration_can_make_a_decision_callable(self):  # 0041 FR-023
        reg = Registry.load(HOME)
        reg.find("spec set").surfaces = ("ui", "mcp")  # a declaration that tries
        server = Server(reg, HOME, {})
        server.line(json.dumps(msg(0, "initialize", protocolVersion=VERSIONS[0])))
        listed = json.loads(server.line(json.dumps(msg(1, "tools/list"))))["result"]["tools"]
        self.assertNotIn("spec_set", [t["name"] for t in listed])
        res = json.loads(server.line(json.dumps(msg(2, "tools/call", name="spec_set", arguments={"spec": "0020", "status": "Superseded"}))))
        self.assertTrue(res["result"]["isError"])
        self.assertEqual(json.loads(res["result"]["content"][0]["text"])["data"]["code"], "decision-refused")

    def test_the_protocol_revision_is_the_clients_when_known_and_the_newest_otherwise(self):
        for v in VERSIONS:
            self.assertEqual(Server(self.reg, HOME).line(json.dumps(msg(1, "initialize", protocolVersion=v))).count(v), 1)
        reply = json.loads(Server(self.reg, HOME).line(json.dumps(msg(1, "initialize", protocolVersion="1999-01-01"))))
        self.assertEqual(reply["result"]["protocolVersion"], VERSIONS[0])

    def test_requests_before_initialize_ping_unknown_methods_and_bad_input(self):
        self.assertEqual(self.rpc("tools/list")["error"]["code"], -32600)
        self.assertEqual(self.rpc("ping")["result"], {})
        self.init()
        self.assertEqual(self.rpc("no/such/method")["error"]["code"], -32601)
        self.assertEqual(self.rpc("tools/call", name="no_such_tool")["error"]["code"], -32602)
        self.assertEqual(json.loads(self.server.line("{not json"))["error"]["code"], -32700)
        self.assertEqual(json.loads(self.server.line("[1]"))[0]["error"]["code"], -32600)
        self.assertIsNone(self.server.line(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"})))
        self.assertIsNone(self.server.line(json.dumps({"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {"requestId": 1}})))
        self.assertIsNone(self.server.line(json.dumps({"jsonrpc": "2.0", "method": "no/such/notification"})))

    def test_resources_are_listed_and_readable_by_uri(self):  # 0041 FR-027, 0042 FR-020
        self.init()
        listed = {r["uri"] for r in self.rpc("resources/list")["result"]["resources"]}
        for uri in ("agora://spec/0020-spec-format", "agora://design-system/frontiers-brand", "agora://brand/frontiers-brand",
                    "agora://command/spec+show", "agora://environment/reference"):
            self.assertIn(uri, listed)
        templates = [t["uriTemplate"] for t in self.rpc("resources/templates/list")["result"]["resourceTemplates"]]
        self.assertIn("agora://requirement/{spec}/{id}", templates)
        self.assertIn("agora://context/{resource}", templates)
        for uri, kind, ident in (("agora://spec/0020", "spec", "0020-spec-format"),
                                 ("agora://requirement/0041/FR-023", "requirement", "0041-command-line/FR-023"),
                                 ("agora://design-system/frontiers-brand", "design-system", "frontiers-brand"),
                                 ("agora://brand/frontiers-brand", "brand", "frontiers-brand"),
                                 ("agora://term/ReadCommandCategory", "term", "ReadCommandCategory"),
                                 ("agora://command/spec+show", "command", "spec show"),
                                 ("agora://environment/reference", "environment", "reference"),
                                 ("agora://context/spec:0020", "context", "spec:0020-spec-format")):
            with self.subTest(uri=uri):
                (c,) = self.rpc("resources/read", uri=uri)["result"]["contents"]
                doc = json.loads(c["text"])
                self.assertEqual((c["uri"], c["mimeType"], doc["kind"], doc["id"], doc["audience"]), (uri, "application/json", kind, ident, "public"))

    def test_a_uri_that_names_nothing_is_an_error_with_an_error_resource(self):
        self.init()
        for uri in ("agora://spec/9999", "agora://nonsense/x", "https://example.org/x", "agora://context/nonsense"):
            with self.subTest(uri=uri):
                err = self.rpc("resources/read", uri=uri)["error"]
                self.assertEqual(err["code"], -32002)
                self.assertEqual(err["data"]["resource"]["kind"], "error")
                self.assertTrue(err["data"]["resource"]["actions"])

    def test_a_tool_result_is_the_commands_json_resource_for_every_exposed_read(self):  # 0041 FR-024: the surfaces cannot disagree
        from .helpers import run_json
        self.init()
        for tool, args, argv in (("spec_show", {"spec": "0020"}, ["spec", "show", "0020"]),
                                 ("requirement_show", {"requirement": "0020/FR-013"}, ["requirement", "show", "0020/FR-013"]),
                                 ("command_list", {}, ["command", "list"]),
                                 ("context", {"resource": "spec:0020"}, ["context", "spec:0020"])):
            with self.subTest(tool=tool):
                got = self.rpc("tools/call", name=tool, arguments=args)["result"]["structuredContent"]
                code, want = run_json(argv)
                self.assertEqual(got, want)

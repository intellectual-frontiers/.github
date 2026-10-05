"""The IF Console extension's checks and build (0043-if-console FR-027, FR-028; 0042-agora FR-013, FR-032).

`check extension` reads the manifest and the code, lints the code and runs the extension's own unit tests under Node's built-in
test runner with a stand-in for the VS Code API. `extension build` packs the .vsix with the pinned vsce. Node is the one the
`nodejs-wheel-binaries` package supplies; nothing is taken from the host. Standard library only.
"""
from __future__ import annotations

import json
import re
import subprocess
import zipfile
from pathlib import Path

from agora.core.checks import Finding

DIR = "tools/if-console"
SETTINGS = {"if-console.launchers", "if-console.checkOnSave"}  # 0043 FR-024
COMMAND_PREFIX = "if-console."
ALLOWED_REQUIRES = {"vscode", "path", "fs", "crypto", "child_process"}  # what the code may require beyond its own files


def _read_json(path: Path, rel: str, out: list[Finding]):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        out.append(Finding("error", rel, f"cannot be read as JSON: {e}"))
        return None


def manifest_findings(home: Path) -> list[Finding]:
    """package.json: identity, contributions, activation, trust, settings, and that every contributed command is registered
    in the code (0043 FR-001, FR-006, FR-010, FR-024, FR-027, FR-030)."""
    ext = home / DIR
    rel = f"{DIR}/package.json"
    out: list[Finding] = []
    pkg = _read_json(ext / "package.json", rel, out)
    if pkg is None:
        return out
    err = lambda m: out.append(Finding("error", rel, m))
    if pkg.get("name") != "if-console":
        err(f"name is {pkg.get('name')!r}; the extension id is if-console (0043 FR-001)")
    if pkg.get("displayName") != "Intellectual Frontiers Console":
        err("displayName must be Intellectual Frontiers Console (0043 FR-001)")
    if not re.fullmatch(r"\^\d+\.\d+\.\d+", str(pkg.get("engines", {}).get("vscode", ""))):
        err("engines.vscode must state the VS Code version it needs, as ^MAJOR.MINOR.PATCH (0043 FR-030)")
    main = pkg.get("main", "")
    if not main or not (ext / main).is_file():
        err(f"main {main!r} is not a file")
    if pkg.get("dependencies"):
        err("has runtime dependencies; the extension ships none (0043 FR-027)")
    for name, version in (pkg.get("devDependencies") or {}).items():
        if not re.fullmatch(r"\d+\.\d+\.\d+", version):
            err(f"devDependency {name} is {version!r}; every package is pinned to one exact version (0043 FR-027)")
    caps = pkg.get("capabilities", {})
    if caps.get("untrustedWorkspaces", {}).get("supported") is not False:
        err("capabilities.untrustedWorkspaces.supported must be false: it runs a repository's launcher (0043 FR-006)")
    if "workspaceContains:.if-console.env" not in pkg.get("activationEvents", []):
        err("activationEvents must include workspaceContains:.if-console.env (0043 FR-004)")
    c = pkg.get("contributes", {})
    if c.get("keybindings"):
        err("binds keys; a person binds their own, and no key may run a decision (0043 FR-015)")
    props = c.get("configuration", {}).get("properties", {})
    if set(props) != SETTINGS:
        err(f"settings are {sorted(props)}; they are only {sorted(SETTINGS)} (0043 FR-024)")
    for key, p in props.items():
        if p.get("scope") != "application":
            err(f"setting {key} must have scope application, so no workspace can set it (0043 FR-004, FR-024)")
    ids = [x["command"] for x in c.get("commands", [])] + [v["id"] for vs in c.get("views", {}).values() for v in vs]
    ids += [t["type"] for t in c.get("taskDefinitions", [])] + list(props)
    for i in ids:
        if i != "if-console" and not i.startswith(COMMAND_PREFIX):
            err(f"{i} lacks the prefix {COMMAND_PREFIX} (0043 FR-001)")
    if [t["type"] for t in c.get("taskDefinitions", [])] != ["if-console"]:
        err("must contribute the task type if-console (0043 FR-010)")
    views = [v["id"] for v in c.get("views", {}).get("if-console", [])]
    if views != ["if-console.commands", "if-console.chores", "if-console.checks"]:
        err(f"the views are {views}; they are Command lines, Chores and Checks (0043 FR-008, FR-019)")
    if not c.get("viewsContainers", {}).get("activitybar"):
        err("must contribute an activity-bar view container (0043 FR-008)")
    if "if-console.servers" not in [m["id"] for m in c.get("mcpServerDefinitionProviders", [])]:
        err("must declare the MCP server definition provider if-console.servers (0043 FR-022)")
    src = "\n".join(p.read_text(encoding="utf-8") for p in sorted((ext / "src").glob("*.js")))
    registered = set(re.findall(r"\bcmd\('(\w+)'", src))
    for cmd in (x["command"] for x in c.get("commands", [])):
        if cmd.removeprefix(COMMAND_PREFIX) not in registered:
            err(f"{cmd} is contributed but the code registers no handler for it")
    for name in registered:
        if f"{COMMAND_PREFIX}{name}" not in [x["command"] for x in c.get("commands", [])]:
            err(f"the code registers {COMMAND_PREFIX}{name}, which package.json does not contribute")
    ignore = (ext / ".vscodeignore")
    if not ignore.is_file() or "test/**" not in ignore.read_text(encoding="utf-8"):
        out.append(Finding("error", f"{DIR}/.vscodeignore", "must exclude test/** from the package"))
    return out


def lint_findings(home: Path, node: str, forbidden_names: list[str]) -> list[Finding]:
    """The code parses (`node --check`), requires only VS Code, a few Node built-ins and its own files, and names no other
    repository or orchestrator (0043 FR-002, FR-028)."""
    ext = home / DIR
    out: list[Finding] = []
    files = sorted(p for p in ext.rglob("*") if p.is_file() and "node_modules" not in p.parts
                   and p.suffix in (".js", ".json", ".md", ".svg", ".env", "") and p.name != "package-lock.json")
    for f in files:
        rel = str(f.relative_to(home))
        if f.suffix == ".js":
            done = subprocess.run([node, "--check", str(f)], capture_output=True, text=True)
            if done.returncode != 0:
                out.append(Finding("error", rel, "does not parse: " + (done.stderr.strip().splitlines() or ["?"])[0]))
            if f.parent.name == "src":
                for m in re.finditer(r"require\(\s*['\"]([^'\"]+)['\"]\s*\)", f.read_text(encoding="utf-8")):
                    if not (m.group(1).startswith("./") or m.group(1) in ALLOWED_REQUIRES):
                        out.append(Finding("error", rel, f"requires {m.group(1)}, which is not a Node built-in the extension may use or one of its own files (0043 FR-027)"))
        text = f.read_text(encoding="utf-8", errors="replace")
        for n, line in enumerate(text.splitlines(), 1):
            for name in forbidden_names:
                if re.search(rf"(?<![\w./-]){re.escape(name)}(?![\w-])", line, re.I):
                    out.append(Finding("error", f"{rel}:{n}", f"names {name}, another repository or a command line the extension must not name (0043 FR-002, FR-004)"))
    return out


def run_tests(home: Path, node: str, env: dict[str, str], launcher_root: Path) -> tuple[list[Finding], list[str]]:
    """The unit tests under node's own runner, and the headless drive of a real launcher at `launcher_root`."""
    ext = home / DIR
    tests = sorted(str(p.relative_to(ext)) for p in (ext / "test").glob("*.test.js"))
    if not tests:
        return [Finding("error", f"{DIR}/test", "holds no *.test.js file (0043 FR-028)")], []
    run_env = {**env, "IF_CONSOLE_REAL_ROOT": str(launcher_root), "NODE_OPTIONS": ""}
    done = subprocess.run([node, "--test", "--test-reporter=tap", *tests], cwd=ext, env=run_env, capture_output=True, text=True)
    out = done.stdout
    counts = {k: int(m.group(1)) for k in ("tests", "pass", "fail", "skipped") if (m := re.search(rf"^# {k} (\d+)", out, re.M))}
    findings: list[Finding] = []
    if done.returncode != 0 or counts.get("fail", 1):
        failed = re.findall(r"^\s*not ok \d+ - (.+)$", out, re.M)
        for name in failed[:20] or ["the test run"]:
            findings.append(Finding("error", f"{DIR}/test", f"fails: {name}"))
        if not failed:
            findings.append(Finding("error", f"{DIR}/test", "the run failed: " + (done.stderr.strip() or out.strip())[-400:]))
    return findings, [f"node's test runner: {counts.get('pass', 0)} of {counts.get('tests', 0)} passed, {counts.get('skipped', 0)} skipped"]


def vsix_name(home: Path) -> str:
    pkg = json.loads((home / DIR / "package.json").read_text(encoding="utf-8"))
    return f"{pkg['name']}-{pkg['version']}.vsix"


def package(home: Path, node: str, vsce: str, out: Path, env: dict[str, str]) -> subprocess.CompletedProcess:
    """Pack the .vsix from tools/if-console/ into `out` with vsce. No dependency is bundled: there is none (0043 FR-027)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    return subprocess.run([node, vsce, "package", "--no-dependencies", "--skip-license", "--allow-missing-repository",
                           "--no-rewrite-relative-links", "--out", str(out)], cwd=home / DIR, env=env, capture_output=True, text=True)


def contents(vsix: Path) -> list[dict]:
    with zipfile.ZipFile(vsix) as z:
        return [{"path": i.filename, "bytes": i.file_size} for i in z.infolist()]

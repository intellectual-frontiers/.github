"""The IF Console extension's checks and build (0043-if-console FR-027, FR-028, FR-035; 0042-agora FR-013, FR-032).

The extension is TypeScript. `check extension` reads the manifest and the code, type-checks it with `tsc` (strict), lints it with ESLint
(typescript-eslint's recommended and type-checked rules), checks the codicon ids this command line may name against the locked
`@vscode/codicons`, bundles it with esbuild, and runs its unit tests under Node's built-in runner and its tests in a real VS Code.
`extension build` does the first four and packs the .vsix with the pinned vsce. Node is the one the `nodejs-wheel-binaries` package
supplies and every other program is in the extension's own npm lock (toolchain entry `extension-build`); nothing is taken from the host.
The programs run in a staged copy of the extension, beside the lock's `node_modules`, so that nothing is written into the repository.
Standard library only.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from typing import Any

from agora.core.checks import Finding

DIR = "tools/if-console"
SETTINGS = {"if-console.launchers", "if-console.checkOnSave"}  # 0043 FR-024
COMMAND_PREFIX = "if-console."
MAIN = "./dist/extension.js"
SKIP = shutil.ignore_patterns("node_modules", "dist", "out", "build")  # what is made, never what is kept
ALLOWED_REQUIRES = {"vscode", "path", "fs", "crypto", "child_process"}  # what the code may import beyond its own files


def _read_json(path: Path, rel: str, out: list[Finding]) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        out.append(Finding("error", rel, f"cannot be read as JSON: {e}"))
        return None


def sources(ext: Path, suffixes: tuple[str, ...] = (".ts",)) -> list[Path]:
    """The extension's own files under src/ with these suffixes, in a stable order."""
    return sorted(p for p in (ext / "src").rglob("*") if p.is_file() and p.suffix in suffixes)


def manifest_findings(home: Path) -> list[Finding]:
    """package.json: identity, contributions, activation, trust, settings, the bundle it runs, and that every contributed command is registered
    in the code (0043 FR-001, FR-006, FR-010, FR-024, FR-027, FR-030, FR-035)."""
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
    if pkg.get("main") != MAIN:
        err(f"main is {pkg.get('main')!r}; it is the one file esbuild bundles, {MAIN} (0043 FR-035)")
    if not (ext / "src" / "extension.ts").is_file():
        err("src/extension.ts, the bundle's entry, is missing (0043 FR-035)")
    if pkg.get("dependencies"):
        err("has runtime dependencies; the extension ships none (0043 FR-027, FR-035)")
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
    src = "\n".join(p.read_text(encoding="utf-8") for p in sources(ext))
    registered = set(re.findall(r"\bcmd\('(\w+)'", src))
    for cmd in (x["command"] for x in c.get("commands", [])):
        if cmd.removeprefix(COMMAND_PREFIX) not in registered:
            err(f"{cmd} is contributed but the code registers no handler for it")
    for name in registered:
        if f"{COMMAND_PREFIX}{name}" not in [x["command"] for x in c.get("commands", [])]:
            err(f"the code registers {COMMAND_PREFIX}{name}, which package.json does not contribute")
    ignore = ext / ".vscodeignore"
    kept = ignore.read_text(encoding="utf-8").split() if ignore.is_file() else []
    for need in ("src/**", "test/**", "**/*.map"):
        if need not in kept:
            out.append(Finding("error", f"{DIR}/.vscodeignore", f"must exclude {need} from the package (0043 FR-035)"))
    tsconfig = _read_json(ext / "tsconfig.json", f"{DIR}/tsconfig.json", out)
    if tsconfig is not None and tsconfig.get("compilerOptions", {}).get("strict") is not True:
        out.append(Finding("error", f"{DIR}/tsconfig.json", "compilerOptions.strict must be true (0043 FR-035)"))
    return out


def source_findings(home: Path, forbidden_names: list[str]) -> list[Finding]:
    """The code names no other repository or orchestrator (0043 FR-002, FR-004), and imports only VS Code, a few Node built-ins and its own
    files (0043 FR-027). Parsing, types and style are `tsc`'s and ESLint's."""
    ext = home / DIR
    out: list[Finding] = []
    files = sorted(p for p in ext.rglob("*") if p.is_file() and not (set(p.parts) & {"node_modules", "dist", "out"})
                   and p.suffix in (".ts", ".js", ".mjs", ".json", ".md", ".svg", ".env", "") and p.name != "package-lock.json")
    for f in files:
        rel = str(f.relative_to(home))
        text = f.read_text(encoding="utf-8", errors="replace")
        if f.suffix == ".ts" and f.relative_to(ext).parts[0] == "src":
            for m in re.finditer(r"""(?:\bfrom\s+|\bimport\s+|\brequire\(\s*)['"]([^'"]+)['"]""", text):
                name = m.group(1)
                if not (name.startswith(".") or name in ALLOWED_REQUIRES or (f.parts[-2] == "webview" and name.startswith("@vscode-elements/elements/"))):
                    out.append(Finding("error", rel, f"imports {name}, which is not a Node built-in the extension may use, VS Code, or one of its own files (0043 FR-027)"))
        for n, line in enumerate(text.splitlines(), 1):
            for name in forbidden_names:
                if re.search(rf"(?<![\w./-]){re.escape(name)}(?![\w-])", line, re.I):
                    out.append(Finding("error", f"{rel}:{n}", f"names {name}, another repository or a command line the extension must not name (0043 FR-002, FR-004)"))
    return out


def codicon_findings(home: Path, mapping: Path, version: str) -> list[Finding]:
    """The codicon ids a command line may name (lib/codicons.txt, 0041 FR-072) are the glyph map of the locked @vscode/codicons: the same ids,
    from the same version (0043 FR-035)."""
    pinned = home / "tools" / "agora" / "lib" / "codicons.txt"
    rel = "tools/agora/lib/codicons.txt"
    try:
        raw = json.loads(mapping.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return [Finding("error", rel, f"the locked @vscode/codicons has no readable glyph map: {e}")]
    locked = {name for names in raw.values() for name in names}
    text = pinned.read_text(encoding="utf-8")
    listed = {l.strip() for l in text.splitlines() if l.strip() and not l.startswith("#")}
    out: list[Finding] = []
    try:
        integrity = json.loads((home / DIR / "package-lock.json").read_text(encoding="utf-8"))["packages"]["node_modules/@vscode/codicons"]["integrity"]
    except (OSError, ValueError, KeyError):
        integrity = ""
    if f"@vscode/codicons {version}" not in text or not integrity or integrity not in text:
        out.append(Finding("error", rel, f"does not name @vscode/codicons {version} and the integrity hash the extension's lock holds for it ({integrity or 'none'})"))
    for name in sorted(listed - locked):
        out.append(Finding("error", rel, f"{name} is not a codicon of @vscode/codicons {version}"))
    for name in sorted(locked - listed):
        out.append(Finding("error", rel, f"{name} is a codicon of @vscode/codicons {version} that the list lacks; replace the list from the package"))
    return out


# ---- the staged copy and the programs run in it ---------------------------------------------------------------------

def stage(home: Path, modules: Path, into: Path) -> Path:
    """A copy of the extension beside the lock's node_modules (linked), where tsc, ESLint and esbuild run and write what they make.
    Nothing is written into the repository."""
    dest = into / "if-console"
    shutil.copytree(home / DIR, dest, ignore=SKIP)
    (dest / "node_modules").symlink_to(modules, target_is_directory=True)
    return dest


def _run(node: str, env: dict[str, str], cwd: Path, *argv: str) -> subprocess.CompletedProcess:
    return subprocess.run([node, *argv], cwd=cwd, env={**env, "NODE_OPTIONS": ""}, capture_output=True, text=True)


def _where(stage_dir: Path, path: str) -> str:
    """A path a program printed, as the repository's own."""
    p = Path(path)
    try:
        return f"{DIR}/{p.resolve().relative_to(stage_dir.resolve())}"
    except ValueError:
        return f"{DIR}/{path.removeprefix('./')}"


TSC_LINE = re.compile(r"^(?P<file>[^\s(][^(]*)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+): (?P<message>.*)$")


def typecheck(stage_dir: Path, node: str, tsc: str, env: dict[str, str]) -> list[Finding]:
    """`tsc --noEmit` on the extension host's code and the tests, and on the webview's own code (strict, 0043 FR-035). A type error fails."""
    out: list[Finding] = []
    for project in (".", "src/webview"):
        done = _run(node, env, stage_dir, tsc, "--noEmit", "--pretty", "false", "-p", project)
        found = False
        for line in done.stdout.splitlines():
            m = TSC_LINE.match(line)
            if m:
                found = True
                out.append(Finding("error", f"{_where(stage_dir, m['file'])}:{m['line']}", f"type error {m['code']}: {m['message']}"))
        if done.returncode != 0 and not found:
            out.append(Finding("error", f"{DIR}/tsconfig.json", "tsc failed: " + (done.stdout + done.stderr).strip()[-400:]))
    return out


def lint(stage_dir: Path, node: str, eslint: str, env: dict[str, str]) -> list[Finding]:
    """ESLint on the extension's TypeScript (recommended and type-checked rules) and its JavaScript. A warning fails too: the rules are errors
    or they are off (0043 FR-035)."""
    done = _run(node, env, stage_dir, eslint, ".", "--format", "json", "--max-warnings", "0")
    try:
        report = json.loads(done.stdout)
    except ValueError:
        return [Finding("error", f"{DIR}/eslint.config.mjs", "ESLint did not run: " + (done.stdout + done.stderr).strip()[-400:])]
    out: list[Finding] = []
    for entry in report:
        for m in entry.get("messages", []):
            rule = f" ({m['ruleId']})" if m.get("ruleId") else ""
            out.append(Finding("error", f"{_where(stage_dir, entry['filePath'])}:{m.get('line', 1)}", f"lint{rule}: {m['message']}"))
    if done.returncode != 0 and not out:
        out.append(Finding("error", f"{DIR}/eslint.config.mjs", "ESLint failed: " + (done.stdout + done.stderr).strip()[-400:]))
    return out


def bundle(stage_dir: Path, node: str, env: dict[str, str]) -> list[Finding]:
    """esbuild: dist/extension.js (the manifest's main), dist/webview.js and the codicon font, minified, with their source maps."""
    done = _run(node, env, stage_dir, "esbuild.mjs", "bundle")
    if done.returncode != 0 or not (stage_dir / "dist" / "extension.js").is_file():
        return [Finding("error", f"{DIR}/esbuild.mjs", "esbuild could not bundle the extension: " + (done.stderr or done.stdout).strip()[-500:])]
    return []


def compile_tests(stage_dir: Path, node: str, env: dict[str, str]) -> list[Finding]:
    """esbuild compiles the tests and the code they load, each file apart, into out/: what node's runner runs, and what the real-VS-Code
    scenarios' fixture loads."""
    if not list((stage_dir / "test").glob("*.test.ts")):
        return [Finding("error", f"{DIR}/test", "holds no *.test.ts file (0043 FR-028)")]
    built = _run(node, env, stage_dir, "esbuild.mjs", "test")
    if built.returncode != 0:
        return [Finding("error", f"{DIR}/test", "esbuild could not compile the tests: " + (built.stderr or built.stdout).strip()[-400:])]
    return []


def export_modules(stage_dir: Path, dest: Path) -> list[str]:
    """Copy the compiled modules (out/src, one CommonJS file per module, and out/test/support, the stand-in for the VS Code API and the
    other test support) into `dest`, emptying `src` and `test` there first. Gives the files written, relative to `dest`. 0043 FR-047."""
    written: list[str] = []
    for part in ("src", Path("test") / "support"):
        source, target = stage_dir / "out" / part, dest / part
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(source, target)
        written += sorted(str(p.relative_to(dest)) for p in target.rglob("*") if p.is_file())
    return written


def run_tests(stage_dir: Path, node: str, env: dict[str, str], launcher_root: Path) -> tuple[list[Finding], list[str]]:
    """The unit tests (TypeScript, compiled to out/ by esbuild) under node's own runner, with the bundle's own test among them, and the headless
    drive of a real launcher at `launcher_root`."""
    failed_build = compile_tests(stage_dir, node, env)
    if failed_build:
        return failed_build, []
    tests = sorted(str(p.relative_to(stage_dir)) for p in (stage_dir / "out" / "test").glob("*.test.js"))
    done = subprocess.run([node, "--test", "--test-reporter=tap", *tests], cwd=stage_dir,
                          env={**env, "IF_CONSOLE_REAL_ROOT": str(launcher_root), "NODE_OPTIONS": ""}, capture_output=True, text=True)
    text = done.stdout
    counts = {k: int(m.group(1)) for k in ("tests", "pass", "fail", "skipped") if (m := re.search(rf"^# {k} (\d+)", text, re.M))}
    findings: list[Finding] = []
    if done.returncode != 0 or counts.get("fail", 1):
        failed = re.findall(r"^\s*not ok \d+ - (.+)$", text, re.M)
        for name in failed[:20] or ["the test run"]:
            findings.append(Finding("error", f"{DIR}/test", f"fails: {name}"))
        if not failed:
            findings.append(Finding("error", f"{DIR}/test", "the run failed: " + (done.stderr.strip() or text.strip())[-400:]))
    return findings, [f"node's test runner: {counts.get('pass', 0)} of {counts.get('tests', 0)} passed, {counts.get('skipped', 0)} skipped"]


def vsix_name(home: Path) -> str:
    pkg = json.loads((home / DIR / "package.json").read_text(encoding="utf-8"))
    return f"{pkg['name']}-{pkg['version']}.vsix"


def package(stage_dir: Path, node: str, vsce: str, out: Path, env: dict[str, str]) -> subprocess.CompletedProcess:
    """Pack the .vsix from the staged, bundled extension into `out` with vsce. No dependency is bundled: there is none (0043 FR-027, FR-035);
    .vscodeignore leaves out the sources, the tests, the source maps and the lock."""
    out.parent.mkdir(parents=True, exist_ok=True)
    return subprocess.run([node, vsce, "package", "--no-dependencies", "--skip-license", "--allow-missing-repository",
                           "--no-rewrite-relative-links", "--out", str(out)], cwd=stage_dir, env=env, capture_output=True, text=True)


def contents(vsix: Path) -> list[dict]:
    with zipfile.ZipFile(vsix) as z:
        return [{"path": i.filename, "bytes": i.file_size} for i in z.infolist()]

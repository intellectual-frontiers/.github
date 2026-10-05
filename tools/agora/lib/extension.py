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

import io
import json
import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from typing import Any

from agora.core.checks import Finding

DIR = "tools/if-console"
SETTINGS = {"if-console.launchers", "if-console.checkOnSave", "if-console.showAllCommands", "if-console.rowLimit"}  # 0043 FR-024
CATEGORY = "IF Console"  # 0043 FR-039
# The first word of a command's title is a verb (0043 FR-039); the title is a verb and an object.
VERBS = {"Show", "Run", "Prove", "Check", "Get", "Learn", "Copy", "Open", "Find", "Refresh", "Stop", "Trust", "Follow"}
# The only commands a key may run: each reads, none writes or decides (0043 FR-015, FR-039).
KEYBINDABLE = {"if-console.showHome", "if-console.check", "if-console.checkChanged", "if-console.learn", "if-console.copyContext", "if-console.doctor"}
MENU_GROUPS = ("inline", "navigation", "1_run", "2_copy", "9_cutcopypaste")  # 0043 FR-038, in this order
VIEWS_ENTRIES = ("if-console.home", "if-console.checks", "if-console.commands")  # 0043 FR-036
COMMAND_PREFIX = "if-console."
MAIN = "./dist/extension.js"
SKIP = shutil.ignore_patterns("node_modules", "dist", "out", "build")  # what is made, never what is kept
ALLOWED_REQUIRES = {"vscode", "path", "fs", "crypto", "child_process"}  # what the code may import beyond its own files


BRAND = "design-systems/frontiers-brand"  # whose mark and colors the extension's icon and banner are (0043 FR-044)
ICON_SIZE = 128
ICON = "media/icon.png"  # made at build time, never tracked (.gitignore)


def _read_json(path: Path, rel: str, out: list[Finding]) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        out.append(Finding("error", rel, f"cannot be read as JSON: {e}"))
        return None


def sources(ext: Path, suffixes: tuple[str, ...] = (".ts",)) -> list[Path]:
    """The extension's own files under src/ with these suffixes, in a stable order."""
    return sorted(p for p in (ext / "src").rglob("*") if p.is_file() and p.suffix in suffixes)


def _slot_count(ext: Path) -> int:
    """How many view slots the code plans into (SLOTS in src/model/viewplan.ts), which the manifest must hold exactly."""
    m = re.search(r"export const SLOTS = (\d+)", (ext / "src" / "model" / "viewplan.ts").read_text(encoding="utf-8"))
    return int(m.group(1)) if m else 0


def _nls(ext: Path, raw: Any, out: list[Finding]) -> Any:
    """package.json with each `%key%` replaced by the English of package.nls.json, as VS Code shows it; a key with no entry, or an entry no key
    uses, is a finding (0043 FR-044)."""
    rel = f"{DIR}/package.nls.json"
    nls = _read_json(ext / "package.nls.json", rel, out) or {}
    used: set[str] = set()

    def walk(v: Any) -> Any:
        if isinstance(v, str):
            m = re.fullmatch(r"%([^%]+)%", v)
            if not m:
                return v
            used.add(m.group(1))
            if m.group(1) not in nls:
                out.append(Finding("error", rel, f"has no entry for {m.group(1)}, which package.json uses (0043 FR-044)"))
            return nls.get(m.group(1), v)
        if isinstance(v, list):
            return [walk(x) for x in v]
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        return v

    resolved = walk(raw)
    for key in sorted(set(nls) - used):
        out.append(Finding("error", rel, f"{key} is not used by package.json (0043 FR-044)"))
    return resolved


CATEGORIES = {"Programming Languages", "Snippets", "Linters", "Themes", "Debuggers", "Formatters", "Keymaps", "SCM Providers", "Other", "Extension Packs",
              "Language Packs", "Data Science", "Machine Learning", "Visualization", "Notebooks", "Education", "Testing"}
SCREENSHOT_MAX_BYTES = 300_000  # a screenshot in the package stays small (0043 FR-044)


def _marketplace(home: Path, ext: Path, raw: Any, pkg: Any, err: Any, out: list[Finding]) -> None:
    """What the marketplace shows without being published (0043 FR-044): the icon (made at build time, never tracked), the gallery banner in the
    brand's own ink, categories and keywords, the l10n folder, a README that shows screenshots kept small, and a CHANGELOG."""
    if raw.get("icon") != ICON:
        err(f"icon is {raw.get('icon')!r}; it is {ICON}, the 128-pixel PNG `extension build` makes from the brand's mark (0043 FR-044)")
    if (ext / ICON).exists() and not _is_png_128(ext / ICON):
        err(f"{ICON} is not a 128-pixel PNG (0043 FR-044)")
    banner = raw.get("galleryBanner") or {}
    try:
        ink = brand_colors(home)["deep-ink"]
    except (OSError, KeyError, ValueError):
        ink = None
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(banner.get("color", ""))) or banner.get("theme") not in ("dark", "light"):
        err("galleryBanner needs a color (#rrggbb) and a theme, dark or light (0043 FR-044)")
    elif ink and banner["color"].lower() != ink.lower():
        err(f"galleryBanner.color is {banner['color']}; it is the brand's deep ink, {ink} (0043 FR-044)")
    cats = raw.get("categories") or []
    if not cats or not set(cats) <= CATEGORIES:
        err(f"categories are {cats}; they are some of the marketplace's own (0043 FR-044)")
    if len(raw.get("keywords") or []) < 3:
        err("keywords must name at least three words a person would search for (0043 FR-044)")
    if raw.get("l10n") != "./l10n":
        err("l10n must be ./l10n, where the build writes the bundle of the code's strings (0043 FR-044)")
    for name in ("README.md", "CHANGELOG.md"):
        if not (ext / name).is_file():
            out.append(Finding("error", f"{DIR}/{name}", "is missing (0043 FR-044)"))
    readme = ext / "README.md"
    if readme.is_file():
        shown = re.findall(r"!\[[^\]]*\]\((media/screenshots/[^)\s]+)\)", readme.read_text(encoding="utf-8"))
        if not shown:
            out.append(Finding("error", f"{DIR}/README.md", "must show screenshots from media/screenshots/ (0043 FR-044, FR-045)"))
        for rel_path in shown:
            f = ext / rel_path
            if not f.is_file():
                out.append(Finding("error", f"{DIR}/README.md", f"shows {rel_path}, which is not there (0043 FR-044)"))
            elif f.stat().st_size > SCREENSHOT_MAX_BYTES:
                out.append(Finding("error", f"{DIR}/{rel_path}", f"is {f.stat().st_size} bytes; a screenshot in the package is at most {SCREENSHOT_MAX_BYTES} (0043 FR-044)"))
    changelog = ext / "CHANGELOG.md"
    if changelog.is_file() and raw.get("version") and f"## {raw['version']}" not in changelog.read_text(encoding="utf-8"):
        out.append(Finding("error", f"{DIR}/CHANGELOG.md", f"has no section for version {raw['version']} (0043 FR-044)"))


def _is_png_128(path: Path) -> bool:
    data = path.read_bytes()[:24]
    return data[:8] == b"\x89PNG\r\n\x1a\n" and int.from_bytes(data[16:20], "big") == 128 and int.from_bytes(data[20:24], "big") == 128


def manifest_findings(home: Path) -> list[Finding]:
    """package.json: identity, contributions, activation, trust, settings, the bundle it runs, and that every contributed command is registered
    in the code (0043 FR-001, FR-006, FR-010, FR-024, FR-027, FR-030, FR-035)."""
    ext = home / DIR
    rel = f"{DIR}/package.json"
    out: list[Finding] = []
    raw = _read_json(ext / "package.json", rel, out)
    if raw is None:
        return out
    err = lambda m: out.append(Finding("error", rel, m))
    pkg = _nls(ext, raw, out)
    _marketplace(home, ext, raw, pkg, err, out)
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
    for k in c.get("keybindings", []):
        if k.get("command") not in KEYBINDABLE:
            err(f"binds a key to {k.get('command')}; a key may run only {sorted(KEYBINDABLE)}, never a write or a decision (0043 FR-015, FR-039)")
    props = c.get("configuration", {}).get("properties", {})
    if set(props) != SETTINGS:
        err(f"settings are {sorted(props)}; they are only {sorted(SETTINGS)} (0043 FR-024)")
    for key, p in props.items():
        if p.get("scope") != "application":
            err(f"setting {key} must have scope application, so no workspace can set it (0043 FR-004, FR-024)")
        if not p.get("markdownDescription"):
            err(f"setting {key} must have a markdownDescription (0043 FR-040)")
    ids = [x["command"] for x in c.get("commands", [])] + [v["id"] for vs in c.get("views", {}).values() for v in vs]
    ids += [t["type"] for t in c.get("taskDefinitions", [])] + list(props)
    for i in ids:
        if i != "if-console" and not i.startswith(COMMAND_PREFIX):
            err(f"{i} lacks the prefix {COMMAND_PREFIX} (0043 FR-001)")
    if [t["type"] for t in c.get("taskDefinitions", [])] != ["if-console"]:
        err("must contribute the task type if-console (0043 FR-010)")
    views = [v["id"] for v in c.get("views", {}).get("if-console", [])]
    slots = _slot_count(ext)
    want = ["if-console.home", *[f"if-console.view.{i}" for i in range(slots)], "if-console.checks", "if-console.commands"]
    if views != want:
        err(f"the views are {views}; they are Home, a pool of {slots} view slots (the views each command line declares), Checks and All commands, in that order (0043 FR-036)")
    for v in c.get("views", {}).get("if-console", []):
        if v["id"] == "if-console.commands" and "allCommands" not in v.get("when", ""):
            err("All commands must be hidden by default and shown by the setting or the view-title toggle (0043 FR-036)")
    welcome = " ".join(w.get("contents", "") for w in c.get("viewsWelcome", []) if w.get("view") == "if-console.home")
    whens = " ".join(w.get("when", "") for w in c.get("viewsWelcome", []) if w.get("view") == "if-console.home")
    for pattern, what in ((r"!if-console\.hasRepository", "no command line found"), (r"(?<![!\w])if-console\.untrusted", "an untrusted workspace"),
                          (r"(?<![!\w])if-console\.toolchainMissing", "a missing toolchain")):
        if not re.search(pattern, whens):
            err(f"Home needs welcome content for {what} (0043 FR-037)")
    if "](command:" not in welcome:
        err("Home's welcome content must have buttons (0043 FR-037)")
    palette = {m["command"]: m for m in c.get("menus", {}).get("commandPalette", [])}
    for cmd_ in c.get("commands", []):
        name = cmd_["command"]
        if cmd_.get("category") != CATEGORY:
            err(f"{name} must have the category {CATEGORY} (0043 FR-039)")
        if not cmd_.get("icon"):
            err(f"{name} must have an icon (0043 FR-039)")
        words = cmd_.get("title", "").rstrip("\u2026").split()
        if len(words) < 2 or words[0] not in VERBS:
            err(f"{name}'s title {cmd_.get('title')!r} must be a verb and an object, the verb one of {sorted(VERBS)} (0043 FR-039)")
        if not cmd_.get("enablement") and not palette.get(name, {}).get("when"):
            err(f"{name} must have an enablement or a palette `when`, so that only what can run now is offered (0043 FR-039)")
    seen_groups: set[str] = set()
    for menu, entries in c.get("menus", {}).items():
        for m in entries:
            if menu == "view/item/context":
                group = m.get("group", "").split("@")[0]
                if group not in MENU_GROUPS:
                    err(f"the menu entry {m.get('command')} is in the group {group!r}; a row's menus use {list(MENU_GROUPS)} (0043 FR-038)")
                seen_groups.add(group)
    for g in MENU_GROUPS:
        if g not in seen_groups:
            err(f"no row menu uses the group {g} (0043 FR-038)")
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
    icon = ext / "media" / "if-console.svg"
    if icon.is_file() and re.search(r'(?:fill|stroke|stop-color)="(?!none|currentColor)[^"]+"|#[0-9a-fA-F]{3,8}\b', icon.read_text(encoding="utf-8")):
        err("the activity-bar icon must draw in currentColor and no other color (0043 FR-036)")
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


# ---- what the marketplace shows (0043 FR-044) -----------------------------------------------------------------------------

def brand_colors(home: Path) -> dict[str, str]:
    """The palette of the brand whose mark the icon is: each color's name and its hex value, from tokens.json."""
    tokens = json.loads((home / BRAND / "tokens.json").read_text(encoding="utf-8"))
    return {k: v["$value"] for k, v in tokens["color"].items() if isinstance(v, dict) and "$value" in v}


def icon_png(home: Path) -> bytes:
    """The 128-pixel icon: the brand's mark, drawn in one color (the brand's warm paper) from the master's own ink, on the brand's deep ink.
    Pillow only, from the brand's own files (design-systems/frontiers-brand, the largest icon master of its tokens); nothing is drawn by hand."""
    from PIL import Image, ImageChops, ImageDraw  # a pinned package of this group's lock

    from agora.lib import imagery

    brand = home / BRAND
    colors = brand_colors(home)
    ink, paper = _rgb(colors["deep-ink"]), _rgb(colors["warm-paper"])
    master = Image.open(imagery.icon_master(brand)).convert("RGBA")
    box = master.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox() or (0, 0, *master.size)
    mark = master.crop(box)
    flat = Image.new("RGBA", mark.size, (255, 255, 255, 255))
    flat.alpha_composite(mark)
    # the master's own darkness is the mark's strength: darker ink, more paper; the master's transparency stays transparent
    strength = ImageChops.multiply(flat.convert("L").point(lambda v: min(255, int((255 - v) * 1.7))), mark.getchannel("A"))
    inner = round(ICON_SIZE * 0.78)
    scale = min(inner / mark.width, inner / mark.height)
    size = (max(1, round(mark.width * scale)), max(1, round(mark.height * scale)))
    strength = strength.resize(size, Image.LANCZOS)
    canvas = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle((0, 0, ICON_SIZE - 1, ICON_SIZE - 1), radius=ICON_SIZE // 6, fill=(*ink, 255))
    layer = Image.new("RGBA", size, (*paper, 255))
    layer.putalpha(strength)
    canvas.alpha_composite(layer, ((ICON_SIZE - size[0]) // 2, (ICON_SIZE - size[1]) // 2))
    out = io.BytesIO()
    canvas.save(out, "PNG", optimize=True)
    return out.getvalue()


def _rgb(hex_value: str) -> tuple[int, int, int]:
    h = hex_value.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def make_icon(home: Path, stage_dir: Path) -> list[Finding]:
    """Write media/icon.png into the staged copy, from the brand's mark (0043 FR-044)."""
    try:
        data = icon_png(home)
    except (OSError, KeyError, ValueError, ImportError) as e:
        return [Finding("error", f"{DIR}/{ICON}", f"cannot be made from the brand's mark at {BRAND}: {e}")]
    (stage_dir / ICON).write_bytes(data)
    return []


def _unescape(raw: str) -> str:
    """A JavaScript string literal's text as the string it makes (the escapes this code base uses: \\u2026, quotes, newline)."""
    return re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), raw).replace("\\'", "'").replace('\\"', '"').replace("\\n", "\n")


L10N_CALL = re.compile(r"""\bt\(\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`([^`$]*)`)""")


def l10n_messages(ext: Path) -> list[str]:
    """Every message the code gives `t(...)`, each a literal in src/ (the build reads them from the source), in a stable order."""
    found: set[str] = set()
    for p in sources(ext):
        for m in L10N_CALL.finditer(p.read_text(encoding="utf-8")):
            found.add(_unescape(next(g for g in m.groups() if g is not None)))
    return sorted(found)


def write_l10n(stage_dir: Path) -> list[str]:
    """l10n/bundle.l10n.json: each message the code gives `t(...)`, its own English as the key and the value, which a translation replaces
    (0043 FR-044). Written into the staged copy."""
    messages = l10n_messages(stage_dir)
    out = stage_dir / "l10n"
    out.mkdir(exist_ok=True)
    (out / "bundle.l10n.json").write_text(json.dumps({m: m for m in messages}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return messages


def prepare(home: Path, stage_dir: Path) -> list[Finding]:
    """What is made at build time and never tracked, written into the staged copy: the 128-pixel icon and the l10n bundle (0043 FR-044)."""
    found = make_icon(home, stage_dir)
    write_l10n(stage_dir)
    return found

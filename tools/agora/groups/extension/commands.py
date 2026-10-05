"""The extension group: `extension build` and the `extension` check section (0042-agora FR-013, FR-032; 0043-if-console FR-027, FR-028).

Thin: the rules and the packing are agora.lib.extension. Node is the one the locked `nodejs-wheel-binaries` package supplies.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from agora.core import AgoraError, Ctx, Finding, Opt, Resource, SectionResult, command, next_command, section
from agora.core.resource import MISSING, FAILED, USAGE
from agora.lib import extension, node, vscode_tests
from agora.lib.register import known_repositories
from agora.toolchain import extension_build


def _node(ctx: Ctx) -> str:
    found = node.node_path(ctx.env)
    if found is None:
        raise AgoraError("missing-program", "this needs node, which comes from the package " + node.PACKAGE, exit=MISSING,
                         detail={"package": node.PACKAGE})
    return found


def _build_tools(ctx: Ctx, names: list[str]):
    """The toolchain entries a step uses, or the reason they cannot be had (a cold cache offline, a missing library)."""
    try:
        return ctx.toolchain().use(names), ""
    except AgoraError as e:
        return None, e.message


@section("extension")
def check_extension(ctx: Ctx, scope: str | None) -> SectionResult:
    runner = ctx.section_options.get("runner")
    if runner in ("browser", "python"):
        return SectionResult("extension", "skipped", reason=f"--runner {runner} is for design-systems; this section's runners are node and vscode")
    home = ctx.public
    try:
        exe = _node(ctx)
    except AgoraError as e:
        return SectionResult("extension", "skipped", reason=e.message)
    own = ctx.registry.root_manifest.get("register_name", "")
    names = sorted(known_repositories(home) - {own} | {ctx.registry.name})
    findings = extension.manifest_findings(home)
    findings += extension.source_findings(home, names)
    notes = ["manifest and source rules read tools/if-console/"]
    data: dict = {}
    unrun = ""
    tools, why = _build_tools(ctx, ["extension-build"])
    if tools is None:
        unrun = why  # what could not run is skipped, never passed (0041 FR-033)
    else:
        with tempfile.TemporaryDirectory(prefix="agora-extension-") as tmp:
            stage_dir = extension.stage(home, tools.path_of("extension-modules"), Path(tmp))
            env = tools.env()
            if runner in (None, "node"):
                findings += extension.codicon_findings(home, tools.path_of("codicons-mapping"), extension_build.PACKAGES["@vscode/codicons"])
                findings += extension.typecheck(stage_dir, exe, str(tools.path_of("tsc")), env)
                findings += extension.lint(stage_dir, exe, str(tools.path_of("eslint")), env)
                notes.append(f"tsc {extension_build.PACKAGES['typescript']} (strict) and ESLint {extension_build.PACKAGES['eslint']} (recommended, type-checked) ran on the TypeScript; the codicon list is the locked package's")
            built = extension.bundle(stage_dir, exe, env)
            findings += built
            if not built and runner in (None, "node"):
                tests, more = extension.run_tests(stage_dir, exe, ctx.toolchain().clean_env(), home)
                findings, notes = findings + tests, notes + more
            if not built and runner == "vscode":
                findings += extension.compile_tests(stage_dir, exe, env)
            if not built and runner in (None, "vscode"):
                real, why = _build_tools(ctx, ["vscode", "extension-build"])
                if real is None:
                    unrun = why
                else:
                    vsix = Path(tmp) / extension.vsix_name(home)
                    packed = extension.package(stage_dir, exe, str(real.path_of("vsce")), vsix, real.env())
                    if packed.returncode != 0 or not vsix.is_file():
                        findings.append(Finding("error", "tools/if-console", "vsce could not pack the extension for the VS Code tests: "
                                                + (packed.stderr or packed.stdout).strip()[-300:]))
                    else:
                        try:
                            f, more, rows = vscode_tests.run(home, stage_dir, exe, str(real.path_of("code")), str(real.path_of("code-cli")),
                                                             str(real.path_of("vscode-test")), str(vsix), ctx.toolchain().clean_env())
                            findings, notes, data = findings + f, notes + more, {"vscode": rows}
                        except vscode_tests.DisplayError as e:
                            unrun = str(e)
    result = SectionResult.from_findings("extension", findings, notes, data)
    if unrun and result.status == "passed":  # what could not run is skipped, never passed (0041 FR-033)
        result.status, result.reason = "skipped", f"part of the section did not run: {unrun}"
    return result


@command("extension test", category="check", toolchain=("vscode", "extension-build"),
         help="Run a caller's own tests of the IF Console extension inside a real VS Code, in a trusted workspace holding this clone and the folders named, or capture its screenshots",
         options=[Opt("--suite", "TEXT", "the directory of the tests: an index.js that exports run(), as tools/if-console/test/vscode/suite does"),
                  Opt("--screenshots", "TEXT", "instead of a suite, open the extension's views and a resource page, Learn and a dry-run diff in Dark+, Light+ and High Contrast and write a PNG of each to this folder"),
                  Opt("--workspace", "TEXT", "a folder to add to the workspace after this clone; repeatable, as NAME=PATH or PATH", multiple=True),
                  Opt("--report", "TEXT", "also write every test's name, status and seconds to this JSON file")])
def extension_test(ctx: Ctx, suite: str | None, screenshots: str | None, workspace: list[str] | tuple[str, ...], report: str | None) -> Resource:
    """Another repository's tests of the extension (0043-if-console FR-034). Nothing of the caller is named here: the suite and the folders are
    paths, and the suite loads the extension's own test support from IF_CONSOLE_EXTENSION_DIR."""
    exe = _node(ctx)
    if bool(suite) == bool(screenshots):
        raise AgoraError("invalid-argument", "name one of --suite DIR (tests of your own) and --screenshots DIR (the extension's screenshots)", exit=USAGE)
    shots = Path(screenshots).expanduser().resolve() if screenshots else None
    suite_dir = Path(suite).expanduser().resolve() if suite else None
    if suite_dir is not None and not (suite_dir / "index.js").is_file():
        raise AgoraError("invalid-argument", f"--suite {suite}: there is no index.js in it", exit=USAGE)
    folders: list[tuple[str, str]] = []
    for w in workspace:
        name, sep, raw = w.partition("=")
        path = Path(raw if sep else w).expanduser().resolve()
        if not path.is_dir():
            raise AgoraError("invalid-argument", f"--workspace {w}: {path} is not a folder", exit=USAGE)
        folders.append((name if sep else path.name, str(path)))
    try:
        r = ctx.toolchain().use(["vscode", "extension-build"])
    except AgoraError as e:
        raise AgoraError("toolchain-missing", f"the real VS Code did not run: {e.message}", exit=MISSING) from e
    with tempfile.TemporaryDirectory(prefix="agora-extension-") as tmp:
        stage_dir = extension.stage(ctx.home, r.path_of("extension-modules"), Path(tmp))
        built = extension.bundle(stage_dir, exe, r.env()) or extension.compile_tests(stage_dir, exe, r.env())
        if built:
            raise AgoraError("invalid-extension", "the extension did not build for the VS Code run: " + "; ".join(f.message for f in built[:3]), exit=FAILED,
                             detail={"findings": [f"{f.where}: {f.message}" for f in built]})
        try:
            findings, notes, rows = vscode_tests.run(ctx.home, stage_dir, exe, str(r.path_of("code")), str(r.path_of("code-cli")), str(r.path_of("vscode-test")), "",
                                                     ctx.toolchain().clean_env(), folders, str(suite_dir) if suite_dir else None, screenshots=shots)
        except vscode_tests.DisplayError as e:
            raise AgoraError("no-display", f"the real VS Code did not run: {e}", exit=MISSING) from e
    if report:
        Path(report).expanduser().write_text(json.dumps({"tests": rows}, indent=2) + "\n", encoding="utf-8")
    data = {"suite": str(suite_dir) if suite_dir else None, "screenshots": sorted(p.name for p in shots.glob("*.png")) if shots else None,
            "folder": str(shots) if shots else None, "folders": [{"name": n, "path": p} for n, p in folders], "tests": rows, "notes": notes,
            "passed": sum(1 for t in rows if t["status"] == "passed"), "findings": [f"{f.where}: {f.message}" for f in findings]}
    if findings:
        raise AgoraError("tests-failed", "; ".join(f.message for f in findings[:3]), exit=FAILED, detail=data)
    return Resource("extension", "test", data)


@command("extension build", category="build", toolchain=("extension-build",),
         help="Build the IF Console extension's .vsix into build/ from tools/if-console/: type-check, lint, bundle and pack it, with Node from the locked package and the extension's own lock; or, with --modules DIR, write its compiled modules for another repository's tests",
         options=[Opt("--modules", "TEXT", "instead of the .vsix, write the unbundled compiled modules (src/ and test/support/, one CommonJS file per module) into this folder, for tests that load them")])
def extension_build_command(ctx: Ctx, modules: str | None = None) -> Resource:
    exe = _node(ctx)
    if modules:
        return _modules(ctx, exe, Path(modules).expanduser().resolve())
    problems = extension.manifest_findings(ctx.home)
    if problems:
        raise AgoraError("invalid-extension", "the extension's package.json is not valid: " + "; ".join(f.message for f in problems[:3]),
                         exit=FAILED, detail={"findings": [f"{f.where}: {f.message}" for f in problems]})
    out = ctx.home / "build" / extension.vsix_name(ctx.home)
    rel = str(out.relative_to(ctx.home))
    data = {"vsix": rel, "dry_run": ctx.dry_run, "changes": [{"path": rel, "change": "modify" if out.exists() else "create", "added": 0,
                                                              "removed": 0, "diff": []}]}
    if not ctx.dry_run:
        resolved = ctx.toolchain().use(["extension-build"])
        env = resolved.env()
        with tempfile.TemporaryDirectory(prefix="agora-extension-") as tmp:
            stage_dir = extension.stage(ctx.home, resolved.path_of("extension-modules"), Path(tmp))
            found = extension.typecheck(stage_dir, exe, str(resolved.path_of("tsc")), env)
            found += extension.lint(stage_dir, exe, str(resolved.path_of("eslint")), env)
            found += extension.bundle(stage_dir, exe, env)
            if found:
                raise AgoraError("invalid-extension", f"the extension does not build: {len(found)} problem{'s' if len(found) != 1 else ''}; first: " + "; ".join(f.message for f in found[:3]),
                                 exit=FAILED, detail={"findings": [f"{f.where}: {f.message}" for f in found]})
            done = extension.package(stage_dir, exe, str(resolved.path_of("vsce")), out, env)
        if done.returncode != 0 or not out.is_file():
            raise AgoraError("build", "vsce could not pack the extension: " + (done.stderr or done.stdout).strip()[-500:], exit=FAILED)
        data["bytes"] = out.stat().st_size
        data["files"] = extension.contents(out)
    return Resource("extension", "if-console", data, actions=[next_command("check the extension", "check", sections=["extension"])])


def _modules(ctx: Ctx, exe: str, dest: Path) -> Resource:
    """`extension build --modules DIR` (0043-if-console FR-047): the unbundled compiled modules, built in the staged copy with the locked toolchain."""
    data = {"modules": str(dest), "dry_run": ctx.dry_run, "changes": [{"path": str(dest), "change": "modify" if dest.exists() else "create", "added": 0,
                                                                        "removed": 0, "diff": []}]}
    if not ctx.dry_run:
        resolved = ctx.toolchain().use(["extension-build"])
        with tempfile.TemporaryDirectory(prefix="agora-extension-") as tmp:
            stage_dir = extension.stage(ctx.home, resolved.path_of("extension-modules"), Path(tmp))
            found = extension.compile_tests(stage_dir, exe, resolved.env())
            if found:
                raise AgoraError("invalid-extension", "the extension's modules did not build: " + "; ".join(f.message for f in found[:3]), exit=FAILED,
                                 detail={"findings": [f"{f.where}: {f.message}" for f in found]})
            dest.mkdir(parents=True, exist_ok=True)
            data["files"] = extension.export_modules(stage_dir, dest)
    return Resource("extension", "modules", data)

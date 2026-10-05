"""The IF Console extension's tests inside a real VS Code (0043-if-console FR-032; 0042-agora FR-013).

`check extension --runner vscode` starts the display server (`Xvfb`, installed with VS Code's libraries by `system add`) on a free
display for this one run, runs `tools/if-console/test/vscode/run.js` on the package's Node with the toolchain's VS Code and
@vscode/test-electron, reads the report it writes, and stops the display server. Standard library only.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from agora.core.checks import Finding

DIR = "tools/if-console"
TIMEOUT = 900  # seconds for the whole run, VS Code started twice included


class DisplayError(Exception):
    pass


def _free_display() -> int:
    for n in range(99, 400):
        if not Path(f"/tmp/.X11-unix/X{n}").exists() and not Path(f"/tmp/.X{n}-lock").exists():
            return n
    raise DisplayError("no free display number between :99 and :399")


class Display:
    """A virtual display server for one run: started on a free display, stopped when the run ends."""

    def __init__(self) -> None:
        self.proc: subprocess.Popen[bytes] | None = None
        self.name = ""

    def __enter__(self) -> "Display":
        program = shutil.which("Xvfb")
        if not program:
            raise DisplayError("Xvfb, the display server VS Code's tests start under, is not installed; run `agora system add` once")
        n = _free_display()
        self.proc = subprocess.Popen([program, f":{n}", "-screen", "0", "1280x1024x24", "-nolisten", "tcp"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.name = f":{n}"
        end = time.monotonic() + 15
        while time.monotonic() < end:
            if Path(f"/tmp/.X11-unix/X{n}").exists():
                return self
            if self.proc.poll() is not None:
                raise DisplayError(f"Xvfb exited with status {self.proc.returncode} on display {self.name}")
            time.sleep(0.1)
        self.__exit__()
        raise DisplayError(f"Xvfb did not open display {self.name} in 15 seconds")

    def __exit__(self, *exc: object) -> None:
        if self.proc is not None and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()


def run(home: Path, node: str, code: str, code_cli: str, test_electron: str, vsix: str, env: dict[str, str],
        folders: list[tuple[str, str]] | None = None, suite: str | None = None) -> tuple[list[Finding], list[str], list[dict]]:
    """Run the tests. Returns findings (one per failed test), notes for a person, and every test's name, status and seconds.

    With `suite` (a directory whose index.js exports run(), see test/vscode/run.js) only that suite runs, once, in a trusted workspace
    holding this clone and `folders` (name, path), the caller's own tests of the extension for a workspace of its own."""
    ext = home / DIR
    began = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="agora-vscode-") as tmp, Display() as display:
        report = Path(tmp) / "report.json"
        run_env = {**env, "DISPLAY": display.name, "IF_CONSOLE_VSCODE": code, "IF_CONSOLE_VSCODE_CLI": code_cli, "IF_CONSOLE_VSIX": vsix, "IF_CONSOLE_TEST_ELECTRON": test_electron,
                   "IF_CONSOLE_REAL_ROOT": str(home), "IF_CONSOLE_VSCODE_REPORT": str(report), "NODE_OPTIONS": "", "HOME": env.get("HOME", tmp)}
        if suite:
            run_env["IF_CONSOLE_VSCODE_SUITE"] = suite
            run_env["IF_CONSOLE_VSCODE_FOLDERS"] = json.dumps([{"name": n, "path": p} for n, p in folders or []])
        try:
            done = subprocess.run([node, str(ext / "test" / "vscode" / "run.js")], cwd=ext, env=run_env, capture_output=True, text=True,
                                  timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            return [Finding("error", f"{DIR}/test/vscode", f"the run did not finish in {TIMEOUT} seconds")], [], []
        data = json.loads(report.read_text(encoding="utf-8")) if report.is_file() else {"tests": [], "errors": []}
    tests = data.get("tests", [])
    findings = [Finding("error", f"{DIR}/test/vscode", f"fails in a real VS Code: {t['name']}: {' | '.join(l.strip() for l in (t.get('reason') or 'no reason given').splitlines()[:5])}")
                for t in tests if t["status"] != "passed"]
    for e in data.get("errors", []):
        findings.append(Finding("error", f"{DIR}/test/vscode", f"VS Code did not finish: {e}"))
    if not tests and not findings:
        tail = (done.stderr or done.stdout).strip()[-400:]
        findings.append(Finding("error", f"{DIR}/test/vscode", f"VS Code ran no test (exit {done.returncode}): {tail}"))
    passed = sum(1 for t in tests if t["status"] == "passed")
    notes = [f"real VS Code: {passed} of {len(tests)} tests passed in {time.monotonic() - began:.1f}s ("
             + ", ".join(f"{t['name'].split(': ', 1)[-1]} {t['seconds']}s" for t in tests) + ")"]
    return findings, notes, [{"name": t["name"], "status": t["status"], "seconds": t["seconds"]} for t in tests]

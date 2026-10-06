"""A slow step that never looks stuck (0041-command-line FR-020; 0006-onboarding FR-020 in `workspaces-host`). Standard library only.

At a person's terminal a step shows one line with a spinner, the seconds and, when it fetches into a folder, how much has arrived; it shows
nothing when it ends quickly and leaves one ✅ (or ❌) line when it took a while. Anywhere else (a log, a pipe) it prints one plain line when it
starts, on standard error. `WS_HOST_PROGRESS=never` switches all of it off."""
from __future__ import annotations

import os
import sys
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

_FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
_active = False


def _utf8() -> bool:
    return "utf" in (os.environ.get("LC_ALL") or os.environ.get("LC_CTYPE") or os.environ.get("LANG") or "").lower()


def _tty() -> bool:
    try:
        return sys.stderr.isatty() and os.environ.get("TERM") != "dumb"
    except (AttributeError, ValueError):
        return False


def _size(folder: Path | None) -> int:
    total = 0
    if folder is not None:
        for root, _, files in os.walk(folder):
            for f in files:
                try:
                    total += os.lstat(os.path.join(root, f)).st_size
                except OSError:
                    pass
    return total


@contextmanager
def step(label: str, watch: Path | None = None) -> Iterator[None]:
    """`with step("📦 Preparing the packages a command needs", watch=cache):` around a slow call."""
    global _active
    if _active or os.environ.get("WS_HOST_PROGRESS") == "never":
        yield
        return
    if not _tty():
        print(f"{label}...", file=sys.stderr, flush=True)
        _active = True
        try:
            yield
        finally:
            _active = False
        return
    stop, shown = threading.Event(), [False]
    started, base = time.monotonic(), _size(watch)

    def spin() -> None:
        i = 0
        while not stop.wait(0.1):
            took = time.monotonic() - started
            if took < 0.5:
                continue
            shown[0] = True
            grown = _size(watch) - base
            extra = f" \033[2m{grown / 1_000_000:.0f} MB\033[0m" if grown > 100_000 else ""
            sys.stderr.write(f"\r\033[K\033[1;36m{_FRAMES[i % len(_FRAMES)]}\033[0m {label}{extra} \033[2m({int(took)}s)\033[0m")
            sys.stderr.flush()
            i += 1

    t = threading.Thread(target=spin, daemon=True)
    _active = True
    t.start()
    ok = False
    try:
        yield
        ok = True
    finally:
        stop.set()
        t.join()
        _active = False
        if shown[0]:
            took = time.monotonic() - started
            sys.stderr.write("\r\033[K")
            if not ok:
                sys.stderr.write(f"{'❌' if _utf8() else 'x'} {label}\n")
            elif took >= 2.0:
                sys.stderr.write(f"{'✅' if _utf8() else 'ok'} {label}\n")
            sys.stderr.flush()

"""Starting a UI: which app a name means, and running it in this process (0042-agora FR-023)."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .assurance import Assurance
from .console import Console
from .server import App, UIServer
from .theme import declared

APPS = {"console": Console, "assurance": Assurance}


def build(registry: Any, home: Path, env: dict[str, str], ui: str) -> App:
    if ui not in declared(registry) or ui not in APPS:
        raise KeyError(ui)
    return APPS[ui](registry, home, env)


def start(registry: Any, home: Path, env: dict[str, str], ui: str, port: int = 0) -> UIServer:
    return UIServer(build(registry, home, env, ui), port)

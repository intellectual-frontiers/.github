"""The invocation context every command receives."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .registry import Registry


@dataclass
class Ctx:
    registry: Registry
    home: Path  # this repository: where the launcher, the manifests and the public rules live
    root: Path  # the repository being read or checked (--root), this one by default
    surface: str = "cli"  # cli, ui or mcp (0041 FR-042)
    offline: bool = False
    dry_run: bool = False
    debug: bool = False
    env: dict[str, str] = field(default_factory=dict)
    values: dict[str, Any] = field(default_factory=dict)  # the parsed arguments, for logging
    section_options: dict[str, Any] = field(default_factory=dict)  # `check`'s --runner, --brand, --paragon, for the sections
    no_log: bool = False  # a check that drives a UI keeps its own calls out of the action log
    on_section: Callable[[str, str, Any], None] | None = None  # `check` reports each section as it starts and ends (a UI streams it)

    @property
    def relocated(self) -> bool:
        return self.root.resolve() != self.home.resolve()

    @property
    def audience(self) -> str:
        """0041 FR-040: the manifest's audience, or `unstated` when --root points elsewhere."""
        return "unstated" if self.relocated else self.registry.audience

    @property
    def name(self) -> str:
        return self.registry.name

    @property
    def public(self) -> Path:
        """The public root whose rules apply (this repository), whatever --root names."""
        return self.home

    def type(self, name: str):
        return self.registry.types[name]

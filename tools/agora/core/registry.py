"""The registry (0041-command-line FR-007, FR-012): commands, nouns, categories, surfaces, groups, sections, suites.

Built from the root manifest (tools/agora/agora.toml), one manifest per group (groups/<group>/agora.toml) and the
commands each group's commands.py declares with the decorators below. Standard library only (FR-005).

A group adds commands with `@command(...)`, check sections with `@section(...)` and typed arguments as module-level
`ArgType` instances; the loader finds them in the module's namespace, so loading twice gives the same registry.
"""
from __future__ import annotations

import importlib
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .types import ArgType

VERBS = ("list", "show", "status", "check", "build", "generate", "add", "set", "record", "new", "advance", "publish", "serve")
NOUNLESS = ("check", "fresh", "test", "doctor", "lock", "context", "help")  # 0041 FR-010
CONTROL_WORDS = {"mcp": ("serve",)}  # 0041 FR-011
CATEGORIES = ("read", "check", "record", "build", "generate", "decision", "setup")  # 0041 FR-014
SURFACES = ("editor", "mcp")
WRITES = ("record", "build", "generate", "decision", "setup")  # every category but read and check (0041 FR-015)


def default_surfaces(category: str) -> tuple[str, ...]:
    """0041 FR-022: by category."""
    if category in ("read", "check", "record", "build", "generate"):
        return ("editor", "mcp")
    if category == "decision":
        return ("editor",)
    return ()


@dataclass
class Arg:
    """A positional argument. `type` names an ArgType. `words=True` takes the rest of the line as one value."""

    name: str
    type: str = "TEXT"
    help: str = ""
    words: bool = False
    required: bool = True
    many: bool = False  # zero or more values, each of the type


@dataclass
class Opt:
    """An option. `type=None` makes it a flag. `log=False` keeps its value out of the action log (0041 FR-042)."""

    flag: str
    type: str | None = None
    help: str = ""
    multiple: bool = False
    required: bool = False
    default: Any = None
    log: bool = True
    alias: str = ""  # a short flag the script has for it, such as -o for --out

    @property
    def dest(self) -> str:
        return self.flag.lstrip("-").replace("-", "_")


@dataclass
class Command:
    words: tuple[str, ...]
    category: str
    help: str = ""
    args: tuple[Arg, ...] = ()
    options: tuple[Opt, ...] = ()
    relocatable: bool = False
    surfaces: tuple[str, ...] | None = None  # None: the default by category
    toolchain: tuple[str, ...] = ()  # the toolchain entries its plan names (0041 FR-066); fetched on first use
    toolchain_unless: str = ""  # an option whose use stands in for them: a program of the person's own, named explicitly
    isolated: bool = False
    group: str = ""
    fn: Callable[..., Any] | None = None
    toolchain_optional: tuple[str, ...] = ()  # entries it uses when it can: without one it says what it left out (`doctor` lists them)

    @property
    def id(self) -> str:
        return " ".join(self.words)

    @property
    def noun(self) -> str | None:
        return self.words[0] if len(self.words) == 2 else None

    @property
    def verb(self) -> str | None:
        return self.words[1] if len(self.words) == 2 else (self.words[0] if self.words == ("check",) else None)


@dataclass
class Section:
    name: str
    help: str = ""
    watch: tuple[str, ...] = ()
    scope: str | None = None  # the typed argument --scope takes, where the section supports it
    options: tuple[str, ...] = ()  # check options beyond --scope/--suite/--changed it accepts
    toolchain: tuple[str, ...] = ()  # entries it needs whatever its options; a section that needs them only for some harnesses
    #                                  leaves this empty and its group's manifest names them per runner and harness
    toolchain_unless: str = ""  # a check option whose use stands in for them (a program of the person's own, named explicitly)
    relocatable: bool = False
    isolated: bool = False
    group: str = ""
    fn: Callable[..., Any] | None = None
    many: bool = False  # `--scope` may be given more than once, and the function receives a list (0042 FR-013)
    toolchain_optional: tuple[str, ...] = ()  # entries a runner of it uses when it can; one it cannot have is skipped and said


@dataclass
class Generator:
    """A generator (0041 FR-035): the sources it reads, the tracked files it writes, and the command that rewrites them.

    `fn(ctx, scope) -> Generated` returns every file it writes, in memory (core/generate.py). `command` is the words of
    the command that rewrites the files. `toolchain` are the entries it cannot run without: `fresh` says so, exit 3, when
    one cannot be had, and refuses to call its output current while a person's own program stands in for one (0025 FR-019)."""

    name: str
    help: str = ""
    sources: tuple[str, ...] = ()  # globs of what it reads
    outputs: tuple[str, ...] = ()  # globs of the tracked files it writes
    command: str = ""
    toolchain: tuple[str, ...] = ()
    group: str = ""
    fn: Callable[..., Any] | None = None

    @property
    def watch(self) -> tuple[str, ...]:
        return self.sources + self.outputs


@dataclass
class Group:
    name: str
    help: str
    path: Path
    packages: dict[str, str] = field(default_factory=dict)
    nouns: dict[str, str] = field(default_factory=dict)
    manifest: dict[str, Any] = field(default_factory=dict)

    @property
    def lock(self) -> Path:
        return self.path / "agora.lock"


def command(name: str, *, category: str, help: str = "", args: tuple[Arg, ...] | list[Arg] = (),
            options: tuple[Opt, ...] | list[Opt] = (), relocatable: bool = False, surfaces: tuple[str, ...] | None = None,
            toolchain: tuple[str, ...] = (), toolchain_unless: str = "", isolated: bool = False, toolchain_optional: tuple[str, ...] = ()):
    """Declare a command. The function is `fn(ctx, **values) -> Resource`, thin: it calls library code (0041 FR-024)."""

    def deco(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn.__agora_command__ = Command(tuple(name.split()), category, help, tuple(args), tuple(options), relocatable,
                                       surfaces, tuple(toolchain), toolchain_unless, isolated, "", fn, tuple(toolchain_optional))
        return fn

    return deco


def context_for(kind: str, type: str):
    """Provide `context KIND:ID` for a kind of resource: `fn(ctx, id) -> Context`; `type` validates the id."""

    def deco(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn.__agora_context__ = (kind, type)
        return fn

    return deco


def generator(name: str):
    """Implement a generator the group's manifest declares: `fn(ctx, scope) -> Generated`."""

    def deco(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn.__agora_generator__ = name
        return fn

    return deco


def section(name: str):
    """Implement a check section the group's manifest declares: `fn(ctx, scope) -> SectionResult`."""

    def deco(fn: Callable[..., Any]) -> Callable[..., Any]:
        fn.__agora_section__ = name
        return fn

    return deco


class Registry:
    def __init__(self, home: Path | None = None):
        self.home = home
        self.root_manifest: dict[str, Any] = {}
        self.name = "agora"
        self.audience = "public"
        self.groups: dict[str, Group] = {}
        self.commands: dict[str, Command] = {}
        self.sections: dict[str, Section] = {}
        self.generators: dict[str, Generator] = {}
        self.types: dict[str, ArgType] = {}
        self.type_group: dict[str, str] = {}
        self.nouns: dict[str, str] = {}  # noun -> help
        self.suites: dict[str, dict[str, Any]] = {}
        self.conflicts: list[str] = []
        self.contexts: dict[str, tuple[str, Callable[..., Any]]] = {}  # kind -> (id type, provider)
        self.topics: dict[str, Any] = {}  # name -> help.Topic, found by presence in agora/help/ (0041 FR-065)

    # loading -------------------------------------------------------------------------------------------------
    @classmethod
    def load(cls, home: Path) -> "Registry":
        reg = cls(home)
        manifest = home / "tools" / "agora" / "agora.toml"
        reg.root_manifest = tomllib.loads(manifest.read_text(encoding="utf-8"))
        rm = reg.root_manifest
        reg.name = rm.get("name", "agora")
        reg.audience = rm.get("audience", "public")
        for gname in rm.get("groups", []):
            reg.load_group(home / "tools" / "agora" / "groups" / gname)
        from . import help as helping

        reg.topics = helping.discover()
        reg.suites = {k: {"sections": list(v.get("sections", [])), "options": dict(v.get("options", {}))}
                      for k, v in rm.get("suites", {}).items()}
        return reg

    def load_group(self, path: Path, module: str | None = None) -> Group:
        m = tomllib.loads((path / "agora.toml").read_text(encoding="utf-8"))
        g = Group(m["name"], m.get("help", ""), path, dict(m.get("packages", {})),
                  {k: v.get("help", "") for k, v in m.get("nouns", {}).items()}, m)
        if g.name in self.groups:
            self.conflicts.append(f"group {g.name} is declared twice")
        self.groups[g.name] = g
        for noun, help_ in g.nouns.items():
            if noun in self.nouns:
                self.conflicts.append(f"noun {noun} is declared by two groups")
            self.nouns[noun] = help_
        for sname, s in m.get("sections", {}).items():
            self._add_section(Section(sname, s.get("help", ""), tuple(s.get("watch", ())), s.get("scope"),
                                      tuple(s.get("options", ())), tuple(s.get("toolchain", ())), s.get("toolchain_unless", ""),
                                      bool(s.get("relocatable", False)), bool(s.get("isolated", False)), g.name,
                                      many=bool(s.get("scope_many", False)), toolchain_optional=tuple(s.get("toolchain_optional", ()))))
        for gname, gen in m.get("generators", {}).items():
            if gname in self.generators:
                self.conflicts.append(f"generator {gname} is declared twice")
            self.generators[gname] = Generator(gname, gen.get("help", ""), tuple(gen.get("sources", ())),
                                               tuple(gen.get("outputs", ())), gen.get("command", ""),
                                               tuple(gen.get("toolchain", ())), g.name)
        mod = importlib.import_module(module or f"agora.groups.{g.name}.commands")
        self._collect(mod, g)
        for s in list(self.sections.values()):
            if s.group == g.name and s.fn is None:
                self.conflicts.append(f"section {s.name} is declared in group {g.name}'s manifest but has no implementation")
        for gen in self.generators.values():
            if gen.group == g.name and gen.fn is None:
                self.conflicts.append(f"generator {gen.name} is declared in group {g.name}'s manifest but has no implementation")
        return g

    def _collect(self, mod: Any, g: Group) -> None:
        found: list[tuple[int, str, Any]] = []
        for attr, obj in vars(mod).items():
            if isinstance(obj, ArgType) and obj.name != "TEXT":
                self.add_type(obj, g.name)
            elif callable(obj) and getattr(obj, "__module__", None) == mod.__name__:
                if (hasattr(obj, "__agora_command__") or hasattr(obj, "__agora_section__")
                        or hasattr(obj, "__agora_context__") or hasattr(obj, "__agora_generator__")):
                    found.append((obj.__code__.co_firstlineno, attr, obj))
        for _, _, fn in sorted(found, key=lambda t: t[0]):
            if hasattr(fn, "__agora_command__"):
                c: Command = fn.__agora_command__
                self.add_command(Command(**{**c.__dict__, "group": g.name}))
            if hasattr(fn, "__agora_context__"):
                kind, tname = fn.__agora_context__
                if kind in self.contexts:
                    self.conflicts.append(f"context for {kind} is provided twice")
                self.contexts[kind] = (tname, fn)
            if hasattr(fn, "__agora_generator__"):
                gen = self.generators.get(fn.__agora_generator__)
                if gen is None or gen.group != g.name:
                    self.conflicts.append(f"generator {fn.__agora_generator__} is implemented by group {g.name} "
                                          "but not declared in its manifest")
                else:
                    gen.fn = fn
            if hasattr(fn, "__agora_section__"):
                s = self.sections.get(fn.__agora_section__)
                if s is None or s.group != g.name:
                    self.conflicts.append(f"section {fn.__agora_section__} is implemented by group {g.name} "
                                          "but not declared in its manifest")
                else:
                    s.fn = fn

    def add_type(self, t: ArgType, group: str) -> None:
        old = self.types.get(t.name)
        if old is not None and old.meaning() != t.meaning():
            self.conflicts.append(f"type {t.name} is declared twice with different meanings "
                                  f"(groups {self.type_group[t.name]} and {group})")
        self.types.setdefault(t.name, t)
        self.type_group.setdefault(t.name, group)

    def add_command(self, c: Command) -> None:
        old = self.commands.get(c.id)
        if old is not None:
            where = f"groups {old.group} and {c.group}" if old.group != c.group else f"group {c.group}"
            kind = "a command in two groups" if old.group != c.group else "two commands with one name"
            self.conflicts.append(f"{kind}: {c.id!r} ({where})")
            return
        self.commands[c.id] = c

    def _add_section(self, s: Section) -> None:
        if s.name in self.sections:
            self.conflicts.append(f"section {s.name} is declared twice")
        self.sections[s.name] = s

    # queries -------------------------------------------------------------------------------------------------
    def find(self, cid: str) -> Command | None:
        return self.commands.get(" ".join(cid.split()))

    def surfaces_of(self, c: Command) -> tuple[str, ...]:
        return c.surfaces if c.surfaces is not None else default_surfaces(c.category)

    def first_words(self) -> list[str]:
        return sorted({c.words[0] for c in self.commands.values()})

    def commands_under(self, noun: str) -> list[Command]:
        return [c for c in self.commands.values() if len(c.words) == 2 and c.words[0] == noun]

    def lookup(self, tokens: list[str]) -> tuple[Command | None, list[str]]:
        """The command the leading words name, and the tokens left."""
        words: list[str] = []
        for t in tokens:
            if t.startswith("-"):
                break
            words.append(t)
        for n in (2, 1):
            if len(words) >= n and " ".join(words[:n]) in self.commands:
                return self.commands[" ".join(words[:n])], tokens[n:]
        return None, tokens

    def validate(self) -> list[str]:
        """Grammar and declaration problems (0041 FR-008, FR-010, FR-011, FR-014, FR-022, FR-023), plus load conflicts."""
        out = list(self.conflicts)
        for c in self.commands.values():
            if c.category not in CATEGORIES:
                out.append(f"{c.id}: category {c.category!r} is not one of {', '.join(CATEGORIES)} (0041 FR-014)")
            if len(c.words) == 1:
                if c.words[0] not in NOUNLESS:
                    out.append(f"{c.id}: a command with no noun must be one of {', '.join(NOUNLESS)} (0041 FR-010)")
            elif len(c.words) == 2:
                noun, verb = c.words
                if noun in CONTROL_WORDS:
                    if verb not in CONTROL_WORDS[noun]:
                        out.append(f"{c.id}: {noun} takes the control words {', '.join(CONTROL_WORDS[noun])} (0041 FR-011)")
                elif verb not in VERBS:
                    out.append(f"{c.id}: {verb!r} is not one of the fixed verbs (0041 FR-008)")
                elif verb == "check":
                    out.append(f"{c.id}: a check runs only through check (0041 FR-010)")
                if noun not in self.nouns:
                    out.append(f"{c.id}: noun {noun} is declared by no group manifest (0041 FR-007)")
            else:
                out.append(f"{c.id}: a command is <noun> <verb> or one of the closed set (0041 FR-008, FR-010)")
            if c.category == "decision" and "mcp" in self.surfaces_of(c):
                out.append(f"{c.id}: a decision command must not be exposed over MCP (0041 FR-023)")
            for s in self.surfaces_of(c):
                if s not in SURFACES:
                    out.append(f"{c.id}: surface {s!r} is not editor or mcp (0041 FR-022)")
            for a in c.args:
                if a.type not in self.types and a.type != "TEXT":
                    out.append(f"{c.id}: argument {a.name} has type {a.type}, which no group declares (0041 FR-013)")
            for o in c.options:
                if o.type and o.type not in self.types and o.type != "TEXT":
                    out.append(f"{c.id}: option {o.flag} has type {o.type}, which no group declares (0041 FR-013)")
        for sname, s in self.suites.items():
            for n in s["sections"]:
                sec = self.sections.get(n)
                if sec is None:
                    out.append(f"suite {sname} names section {n}, which is not declared (0041 FR-031)")
        return out

    def plan_conflicts(self) -> list[str]:
        """0041 FR-029: an invocation whose plan needs two locks without isolation."""
        out = []
        with_pkgs = {g.name for g in self.groups.values() if g.packages}
        groups_of = lambda names: {self.sections[n].group for n in names if n in self.sections
                                   and not self.sections[n].isolated}
        invocations = {f"check --suite {k}": v["sections"] for k, v in self.suites.items()}
        invocations["check"] = list(self.sections)
        for label, names in invocations.items():
            needs = groups_of(names) & with_pkgs
            if len(needs) > 1:
                out.append(f"{label} needs the locks of groups {', '.join(sorted(needs))} in one process; declare "
                           "those sections isolated (0041 FR-028)")
        return out

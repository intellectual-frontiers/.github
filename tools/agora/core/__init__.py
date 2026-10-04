"""agora's core: standard library only (0041-command-line FR-005)."""
from .checks import Finding, SectionResult
from .ctx import Ctx
from .registry import Arg, Command, Opt, Registry, Section, command, section
from .resource import Action, AgoraError, Call, Link, Resource, next_command
from .types import ArgType, Choice, Dynamic, Pattern

__all__ = ["Action", "AgoraError", "Arg", "ArgType", "Call", "Choice", "Command", "Ctx", "Dynamic", "Finding", "Link",
           "Opt", "Pattern", "Registry", "Resource", "Section", "SectionResult", "command", "next_command", "section"]

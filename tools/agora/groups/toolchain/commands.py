"""The `toolchain` check section (0041-command-line FR-066, FR-068; 0042-agora FR-013, FR-030; 0025-tooling-environment).

The programs themselves are `archon`'s: `provider`, `toolchain` and `system` are `ws-host`'s nouns (0041 FR-069). This group holds only the check of what agora declares,
the rules in agora.lib.toolchain_rules, and, with `--functional`, each installed entry's own check. Standard library only.
"""
from __future__ import annotations

from agora.core import AgoraError, Ctx, Finding, SectionResult, section
from agora.core import toolchain
from agora.lib import toolchain_rules


@section("toolchain")
def check_toolchain(ctx: Ctx, scope: str | None) -> SectionResult:
    declared = toolchain.declared(ctx.home)
    findings = toolchain_rules.entry_findings(declared, ctx.registry)
    findings += toolchain_rules.lock_findings(ctx.home, ctx.registry)
    findings += toolchain_rules.workflow_findings(ctx.home)
    findings += toolchain_rules.code_findings(ctx.home)
    notes = [f"toolchain: {len(declared)} entries declared in .workspaces-host/toolchain.d ({', '.join(declared)})"]
    findings += toolchain_rules.generated_findings(ctx.home)
    findings += toolchain_rules.pin_findings(ctx.home)
    if ctx.section_options.get("functional"):
        findings += _functional(ctx, notes)
    return SectionResult.from_findings("toolchain", findings, notes, {"entries": sorted(declared)})


def _functional(ctx: Ctx, notes: list[str]) -> list[Finding]:
    """Each installed entry's own check: a document compiles, a file converts, a page loads (0025 FR-016)."""
    tc = ctx.toolchain()
    out: list[Finding] = []
    for name, mod in sorted(tc._code.items()):
        if not hasattr(mod, "check"):
            continue
        try:
            r = tc.resolve([name])
        except AgoraError as e:
            notes.append(f"{name}: not checked, {e.message}")
            continue
        try:
            notes.append(f"{name}: {mod.check(r)}")
        except AgoraError as e:
            out.append(Finding("error", f".workspaces-host/toolchain.d/{name}.toml", e.message))
    return out

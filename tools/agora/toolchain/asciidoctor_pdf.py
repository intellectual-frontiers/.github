"""asciidoctorj-pdf, Asciidoctor PDF for the AsciidoctorJ the `asciidoctor` entry holds (0042-agora FR-030).

One jar from Maven Central that bundles the Asciidoctor PDF gem and the gems it needs, added to AsciidoctorJ's class path so that `-b pdf` converts a
document to a PDF.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from agora.core.toolchain import Resolved, ToolchainError, run_program

from . import asciidoctor

NAME = "asciidoctor-pdf"


def argv(r: Resolved, program: str) -> list[str]:
    """AsciidoctorJ's invoker with this jar on its class path, so that `-b pdf` finds the converter."""
    return asciidoctor.argv(r, "asciidoctor", (r.path_of("asciidoctor-pdf"),))


def check(r: Resolved) -> str:
    with tempfile.TemporaryDirectory(prefix="agora-check-") as tmp:
        src, out = Path(tmp) / "check.adoc", Path(tmp) / "check.pdf"
        src.write_text("= Check\n\nHello *world*.\n", encoding="utf-8")
        code, text = run_program([*r.argv("asciidoctor-pdf"), "-b", "pdf", "-o", str(out), str(src)], r.env(), timeout=300)
        if code != 0 or not out.is_file() or not out.read_bytes().startswith(b"%PDF-"):
            raise ToolchainError(f"asciidoctor-pdf did not write a PDF: {text[-400:]}", entries=[NAME], fetchable=False)
    return "asciidoctorj-pdf wrote a PDF"

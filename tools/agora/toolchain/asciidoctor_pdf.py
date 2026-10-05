"""asciidoctorj-pdf, Asciidoctor PDF for the AsciidoctorJ the `asciidoctor` entry holds (0042-agora FR-030).

One jar from Maven Central that bundles the Asciidoctor PDF gem and the gems it needs, added to AsciidoctorJ's class path so that
`-b pdf` converts a document to a PDF. It is its own entry so that `asciidoctor` stays exactly the version and checksum that the
private repositories pin.
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Resolved, ToolchainError, run_program
from . import asciidoctor

NAME = "asciidoctor-pdf"
VERSION = "2.3.27"
JAR = f"lib/asciidoctorj-pdf-{VERSION}.jar"


def provides(platform: str) -> dict[str, str]:
    return {"asciidoctor-pdf": JAR}


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
    return f"asciidoctorj-pdf {VERSION} wrote a PDF"


_ARCHIVE = Archive(f"https://repo1.maven.org/maven2/org/asciidoctor/asciidoctorj-pdf/{VERSION}/asciidoctorj-pdf-{VERSION}.jar",
                   "f7a3d702e7a4bc86d420c7b59a25d81a7e927dea1579a515c5a704341f3b5463", "file", dest=JAR, size=5304467)

ENTRY = Entry(
    NAME, VERSION, f"asciidoctorj-pdf {VERSION}, the PDF converter for the asciidoctor entry's AsciidoctorJ",
    {p: (_ARCHIVE,) for p in ("linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64")},
    provides, needs=("jre", "asciidoctor"), override_hint="a jar of asciidoctorj-pdf", check=check, argv=argv)

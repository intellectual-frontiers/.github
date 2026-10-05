"""AsciidoctorJ, the Asciidoctor route that needs no Ruby (0042-agora FR-030; 0041-command-line FR-066).

AsciidoctorJ 3.0.1 bundles Asciidoctor 2.0.26 and asciidoctor-epub3 2.2.0 and runs on the `jre` entry. The version, address and
checksum are the same as the private repositories' own entry of this name pins. `asciidoctor-pdf` is a separate entry, so that
this one stays exactly what they pin.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from agora.core.toolchain import Archive, Entry, Resolved, ToolchainError, run_program

NAME = "asciidoctor"
VERSION = "3.0.1"
JARS = ("asciidoctorj-3.0.1.jar", "asciidoctorj-cli-3.0.1.jar", "asciidoctorj-epub3-2.2.0.jar",
        "jruby-complete-9.4.14.0.jar", "asciidoctorj-api-3.0.1.jar", "jcommander-2.0.jar")
# AsciidoctorJ's own start script's options, less its -Xverify:none (which a current Java warns about on every run).
JVM = ["--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED", "--add-opens", "java.base/java.io=ALL-UNNAMED", "-Xss8m",
       "-Xms256m", "-Xmx1g", "-Djava.awt.headless=true", "-Dfile.encoding=UTF-8", "-XX:+TieredCompilation",
       "-XX:TieredStopAtLevel=1", "-Djruby.compile.mode=OFF", "-Xshare:auto"]


def provides(platform: str) -> dict[str, str]:
    return {"asciidoctor": f"lib/asciidoctorj-{VERSION}.jar", "asciidoctor-jruby": "lib/jruby-complete-9.4.14.0.jar"}


def classpath(r: Resolved, extra: tuple[Path, ...] = ()) -> str:
    home = r.entry_path(NAME)
    return os.pathsep.join([*(str(home / "lib" / j) for j in JARS), *map(str, extra)])


def argv(r: Resolved, program: str, extra: tuple[Path, ...] = ()) -> list[str]:
    main = "org.jruby.Main" if program == "asciidoctor-jruby" else "org.asciidoctor.cli.jruby.AsciidoctorInvoker"
    return [*r.argv("java"), *JVM, "-cp", classpath(r, extra), main]


def check(r: Resolved) -> str:
    with tempfile.TemporaryDirectory(prefix="agora-check-") as tmp:
        src = Path(tmp) / "check.adoc"
        src.write_text("Hello *world*.\n", encoding="utf-8")
        code, text = run_program([*r.argv("asciidoctor"), "-s", "-o", "-", str(src)], r.env())
        if code != 0 or "<strong>world</strong>" not in text:
            raise ToolchainError(f"asciidoctor did not convert a document: {text[-300:]}", entries=[NAME], fetchable=False)
    code, version = run_program([*r.argv("asciidoctor"), "--version"], r.env())
    return version.strip().splitlines()[0]


_ARCHIVE = Archive(f"https://repo1.maven.org/maven2/org/asciidoctor/asciidoctorj/{VERSION}/asciidoctorj-{VERSION}-bin.zip",
                   "18b085b7f67a7f872abe00352be5caacd9b436400aec27f838c6380077cb88bf", "zip",
                   prefix=f"asciidoctorj-{VERSION}", size=76713527)

ENTRY = Entry(
    NAME, VERSION, "AsciidoctorJ 3.0.1 (Asciidoctor 2.0.26, asciidoctor-epub3 2.2.0) on the jre",
    {p: (_ARCHIVE,) for p in ("linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64")},
    provides, needs=("jre",), override_hint="an asciidoctor program", check=check, argv=argv)

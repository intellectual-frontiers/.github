"""AsciidoctorJ, the Asciidoctor route that needs no Ruby (0042-agora FR-030; 0041-command-line FR-066).

AsciidoctorJ bundles Asciidoctor and asciidoctor-epub3 and runs on the `jre` entry. `asciidoctor-pdf` is a separate entry, so that this one stays exactly what
the private repositories pin.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from agora.core.toolchain import Resolved, ToolchainError, run_program

NAME = "asciidoctor"
JARS = ("asciidoctorj-3.0.1.jar", "asciidoctorj-cli-3.0.1.jar", "asciidoctorj-epub3-2.2.0.jar",
        "jruby-complete-9.4.14.0.jar", "asciidoctorj-api-3.0.1.jar", "jcommander-2.0.jar")
# AsciidoctorJ's own start script's options, less its -Xverify:none (which a current Java warns about on every run).
JVM = ["--add-opens", "java.base/sun.nio.ch=ALL-UNNAMED", "--add-opens", "java.base/java.io=ALL-UNNAMED", "-Xss8m",
       "-Xms256m", "-Xmx1g", "-Djava.awt.headless=true", "-Dfile.encoding=UTF-8", "-XX:+TieredCompilation",
       "-XX:TieredStopAtLevel=1", "-Djruby.compile.mode=OFF", "-Xshare:auto"]


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

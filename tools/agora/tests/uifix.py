"""A small public root with the code of agora, for the UI tests: servers run in the temp clone, never in this one."""
from __future__ import annotations

import shutil
import threading
from pathlib import Path

from agora.core.registry import Registry
from agora.core.ui import runtime
from agora.core.ui.check import Client

from .helpers import HOME, TempRepo, spec_text

KIND_TTL = """@prefix ifcore: <https://example.test/ifcore#> .

ifcore:DesignSystemKindScheme a skos:ConceptScheme ; rdfs:label "Design system kind"@en .
ifcore:WebDesignSystemKind a skos:Concept ; skos:inScheme ifcore:DesignSystemKindScheme ; skos:prefLabel "web presentation"@en ;
    skos:notation "web" ;
    ifcore:hasAudience ifcore:Public .
ifcore:BrandDesignSystemKind a skos:Concept ; skos:inScheme ifcore:DesignSystemKindScheme ; skos:prefLabel "brand"@en ;
    skos:notation "brand" ;
    ifcore:hasAudience ifcore:Public .

ifcore:ToyWeb a ifcore:DesignSystem ;
    dcterms:identifier "toy-web" ;
    rdfs:label "Toy Web"@en ;
    ifcore:designSystemStatus ifcore:DraftDesignSystem ;
    dcterms:type ifcore:WebDesignSystemKind ;
    rdfs:comment "At design-systems/toy-web/."@en ;
    ifcore:hasAudience ifcore:Public .
"""


class UiRepo(TempRepo):
    """A clone holding agora's code, a spec, the register and a one-design-system ontology."""

    def setUp(self) -> None:
        super().setUp()
        shutil.copytree(HOME / "tools" / "agora", self.root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        self.write("ontology/ifcore.ttl", KIND_TTL)
        self.write("design-systems/toy-web/spec.md", spec_text("toy-web"))
        self.servers: list = []
        self.addCleanup(self.stop_all)

    def stop_all(self) -> None:
        for s in self.servers:
            s.stop()

    def serve(self, ui: str = "console", **attrs):
        reg = Registry.load(self.root)
        server = runtime.start(reg, self.root, {"PATH": "/usr/bin:/bin"}, ui, 0)
        for k, v in attrs.items():
            setattr(server.app, k, v)
        server.start()
        self.servers.append(server)
        return server, Client(server.port)

    def logs(self) -> str:
        return "".join(f.read_text() for f in sorted((self.root / ".agora" / "logs").glob("*.ndjson"))) if (self.root / ".agora" / "logs").is_dir() else ""

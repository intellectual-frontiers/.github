"""Writing a spec, and the design systems and brands."""
from __future__ import annotations

from agora.core.help import Step, topic


@topic("specs", "Writing a spec, its requirements and its register rows.")
def specs():
    return {
        "plain": ("This repository is built spec first: the spec, then the ontology, then the code. A spec says what must be "
                  "true; every requirement in it has a row in the enforcement register that says how it is enforced."),
        "sections": (
            ("Start a spec",
             "This writes the skeleton under spec-kit/specs/ with the next number. It writes no requirement for you.\n\n"
             "    ./agora spec new my-feature --title \"My feature\""),
            ("Write the requirements",
             "Each requirement is a line that starts with a bold FR number and says MUST or MUST NOT, so that anyone can test it. "
             "The format is 0020-spec-format; read it with `agora spec show 0020`."),
            ("Give every requirement a register row",
             "The register is spec-kit/enforcement.tsv. A requirement is enforced by a check, by a gate, by a review, or by "
             "nothing yet, and the row says which and names the command. Setting a row is a record, so it is a step you can "
             "preview before it is written.\n\n    ./agora requirement list --spec 0042\n    ./agora requirement set 0042-agora/FR-001 --mechanism check --by \".github: agora check commands\""),
            ("Find the ontology term a requirement needs",
             "The ontology comes second, after the spec. Search it by a word, a CURIE or a label before you add a term, so that an "
             "established one is reused; `show` gives a term's meaning, its relations, every statement about it and the requirements "
             "that already cite it. The IF Console shows the same in its Ontology view, with Search in its title.\n\n"
             "    ./agora ontology list --match \"design system\"\n    ./agora ontology show ifcore:DesignSystem"),
            ("Check your work",
             "The checks read every spec and every row, and fail where a requirement has no row or a row names a command that "
             "does not exist.\n\n    ./agora check specs register"),
            ("Moving a spec between statuses",
             "Draft, Adopted and Superseded are a decision only a person makes. The command asks you and shows its dry run first; "
             "an AI agent writes a proposal instead (`agora help ai`)."),
        ),
        "steps": (
            Step("List the specs", "spec list"),
            Step("List the requirements of a spec", "requirement list"),
            Step("Start a new spec", "spec new"),
            Step("List the ontology's classes", "ontology list", {"kind": "class"}),
            Step("Show one ontology term", "ontology show"),
            Step("Check the specs and the register", "check", {"sections": ["specs", "register"]}),
        ),
    }


@topic("design-systems", "What a design system is, and how to check one or start one.")
def design_systems():
    return {
        "plain": ("A design system is a folder under design-systems/ with its own spec, its own rules and its own test harness, "
                  "so that anything made with it can be checked the same way every time."),
        "sections": (
            ("Look at them",
             "Each has a kind, such as web, slides, print or brand, a spec and a harness.\n\n    ./agora design-system list"),
            ("Check one",
             "A harness runs in a real browser or in Python, once under every brand that themes it. The first run fetches the "
             "browser or TeX; `agora help start` explains the toolchain.\n\n    ./agora check design-systems --scope frontiers-brand\n    ./agora check --suite python"),
            ("Start a new one",
             "A design system needs its spec and its entry in the ontology first; the command refuses without them and writes "
             "only the scaffold. Preview it with --dry-run.\n\n    ./agora design-system new my-slides --kind slides"),
            ("Its harness stays inside it",
             "A harness must run on its own, by the means its README documents, without agora. agora calls it; it never "
             "depends on agora."),
        ),
        "steps": (
            Step("List the design systems", "design-system list"),
            Step("Show one", "design-system show"),
            Step("Run the Python harnesses", "check", {"suite": "python"}),
            Step("Run the browser harnesses", "check", {"suite": "browser"}),
        ),
    }


@topic("brands", "Brands: the generated theme files, the imagery, and the marks.")
def brands():
    return {
        "plain": ("A brand is a design system of kind brand. Its tokens are the source; its theme files, imagery sizes, "
                  "app icons and traced marks are generated from them, and `agora fresh` proves they are current."),
        "sections": (
            ("Look at a brand",
             "    ./agora brand list\n    ./agora brand show frontiers-brand"),
            ("Change a token, then regenerate",
             "Edit tokens.json, then rewrite what is generated from it. The commands take --dry-run to show the change first.\n\n"
             "    ./agora brand generate frontiers-brand\n    ./agora decoration generate"),
            ("Imagery",
             "The pool holds the approved artwork. Building writes the web sizes, the share card, the app icons and the favicon; "
             "adding a piece measures it first.\n\n    ./agora imagery list frontiers-brand\n    ./agora imagery build frontiers-brand\n    ./agora check imagery"),
            ("The ink record",
             "Recording a name against a spot colour is a decision only a person makes, so it asks you first. "
             "An AI agent writes a proposal instead."),
        ),
        "steps": (
            Step("List the brands", "brand list"),
            Step("Rewrite a brand's theme files", "brand generate"),
            Step("Build a brand's imagery", "imagery build"),
            Step("Check the imagery", "check", {"sections": ["imagery"]}),
            Step("Prove the generated files are current", "fresh"),
        ),
    }

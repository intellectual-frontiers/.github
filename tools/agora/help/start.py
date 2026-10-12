"""The first day, and the check to run before a push."""
from __future__ import annotations

from agora.core.help import Step, topic


@topic("start", "Your first day: what to install, what to run once, and how to look around.")
def start():
    return {
        "plain": ("agora is this repository's one command line. It needs only uv on your machine: uv brings archon, the command runner, and "
                  "archon brings the newest Python, the packages agora locks and the programs outside Python (TeX, a browser, Java, Node) "
                  "that a command names. You never install a tool by hand: for each program archon uses one already on your machine "
                  "when it is new enough, otherwise one from your package manager, otherwise the program's own download, checked against "
                  "its fingerprint."),
        "sections": (
            ("1. Install uv",
             "uv is the one thing to install, once (https://docs.astral.sh/uv/getting-started/installation/). Then run agora from the "
             "root of this clone; the first run fetches archon and everything the command needs, and says what it is doing."),
            ("2. See what you have",
             "Ask agora how it finds your machine. It says whether a person is at the invocation (agora assumes not, unless you are at a "
             "terminal), the package manager archon found, and where each program would come from.\n\n"
             "    ./agora doctor"),
            ("3. See what runs here",
             "Every command is listed, and each says what it needs and whether this machine can run it. A command whose program no source can "
             "supply here (you are offline and have none, or there is no build for your platform) exits 3 and says why.\n\n"
             "    ./agora command list --json"),
            ("4. Look around",
             "Every command is listed, and each says what it does. The topics here are the rest of the learning.\n\n"
             "    ./agora command list\n    ./agora help"),
            ("5. Before you push",
             "Run the checks. `agora help check` says which."),
        ),
        "steps": (
            Step("See what agora needs and what is present", "doctor"),
            Step("List the commands", "command list"),
            Step("Run the quick checks", "check", {"suite": "spec"}),
        ),
    }


@topic("check", "What to run before you push, and what each check tells you.")
def check():
    return {
        "plain": ("Four commands say whether a change is sound. Run the first three before every push; the rest depend on what "
                  "you changed."),
        "sections": (
            ("The quick checks",
             "The spec suite needs nothing but uv. It checks the specs, the enforcement register, the controls, the "
             "ontology, the toolchain, the commands and the help topics. A section whose program no source can supply on "
             "this machine is skipped and the run is incomplete (exit 3); `--available` accepts that and "
             "exits 0 when what ran passed.\n\n    ./agora check --suite spec\n    ./agora check --suite spec --available"),
            ("The tests and the generated files",
             "agora's own tests, and the proof that every generated file is current. When a generated file is stale, fresh names "
             "the command that rewrites it.\n\n    ./agora test\n    ./agora fresh"),
            ("Only what you changed",
             "This runs the checks whose watched files changed since your last commit.\n\n    ./agora check --changed"),
            ("If you changed a design system or a brand",
             "The harnesses run in a real browser or in Python, once under every brand. `agora help design-systems` has more.\n\n"
             "    ./agora check --suite browser\n    ./agora check --suite python\n    ./agora check --suite images"),
            ("How to read the result",
             "A finding names a file and a line, and says what to edit. A section that could not run says why and exits with 3: "
             "it is skipped, never passed. Exit 1 means something you checked failed; exit 2 means the command was used wrongly."),
        ),
        "steps": (
            Step("Run the quick checks", "check", {"suite": "spec"}),
            Step("Run the quick checks on a machine that cannot get every program", "check", {"suite": "spec", "available": True}),
            Step("Run agora's own tests", "test"),
            Step("Prove the generated files are current", "fresh"),
            Step("Run only what you changed", "check", {"changed": True}),
        ),
    }

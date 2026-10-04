"""The first day, and the check to run before a push."""
from __future__ import annotations

from agora.core.help import Step, topic


@topic("start", "Your first day: what to install, what to run once, and how to look around.")
def start():
    return {
        "plain": ("agora is this repository's one command line. It needs only Python and uv on your machine. Everything else it "
                  "needs, it fetches itself, checks against a fixed fingerprint, and keeps in a cache that belongs to you."),
        "sections": (
            ("1. Install two things yourself",
             "Install Python 3.11 or later and uv (https://docs.astral.sh/uv/). Nothing else is needed from your machine, and agora "
             "never uses a program it finds there unless you tell it to by name."),
            ("2. See that it runs",
             "From the root of your clone, ask agora how it finds your machine. It lists what is present and what is not, and "
             "fails only on a real problem.\n\n    ./agora doctor"),
            ("3. Install the system libraries, once",
             "The browser and VS Code need a few shared libraries and a display server that only an administrator can install. "
             "One command does it, and it is the only command that uses sudo. It prints exactly what it will run and asks "
             "before it runs anything; with --dry-run it prints and stops.\n\n    ./agora system add --dry-run\n    ./agora system add\n\n"
             "On a distribution other than Debian or Ubuntu it names the libraries and stops, and you install them with your own "
             "package manager."),
            ("4. Fetch the programs, once",
             "agora keeps the programs outside Python in a toolchain: TeX, a browser, Java, VS Code and a few more, each at one "
             "exact version, checked against its fingerprint before it is used. This fetches all of them into your cache. If you "
             "skip it, each command fetches what it needs the first time. The files are large; they are fetched once.\n\n"
             "    ./agora toolchain add\n\nTo see what is there first:\n\n    ./agora toolchain list"),
            ("5. Look around",
             "Every command is listed, and each says what it does. The topics here are the rest of the learning.\n\n"
             "    ./agora command list\n    ./agora help"),
            ("6. Before you push",
             "Run the checks. `agora help check` says which."),
        ),
        "steps": (
            Step("See what agora needs and what is present", "doctor"),
            Step("Install the system libraries (asks before it uses sudo)", "system add", note="asks for your password through sudo"),
            Step("Fetch the toolchain", "toolchain add"),
            Step("See the toolchain's state", "toolchain list"),
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
             "The spec suite needs nothing but Python and uv. It checks the specs, the enforcement register, the controls, the "
             "ontology, the toolchain, the commands and the help topics.\n\n    ./agora check --suite spec"),
            ("The tests and the generated files",
             "agora's own tests, and the proof that every generated file is current. When a generated file is stale, fresh names "
             "the command that rewrites it.\n\n    ./agora test\n    ./agora fresh"),
            ("Only what you changed",
             "This runs the checks whose watched files changed since your last commit.\n\n    ./agora check --changed"),
            ("If you changed a design system or a brand",
             "The harnesses run in a real browser or in Python, once under every brand. `agora help design-systems` has more.\n\n"
             "    ./agora check --suite browser\n    ./agora check --suite python\n    ./agora check --suite images"),
            ("If you changed the VS Code extension",
             "The unit tests run on Node; the second suite runs the extension inside a real VS Code under a display server, which "
             "needs the one-time `agora help start` setup.\n\n    ./agora check --suite extension"),
            ("How to read the result",
             "A finding names a file and a line, and says what to edit. A section that could not run says why and exits with 3: "
             "it is skipped, never passed. Exit 1 means something you checked failed; exit 2 means the command was used wrongly."),
        ),
        "steps": (
            Step("Run the quick checks", "check", {"suite": "spec"}),
            Step("Run agora's own tests", "test"),
            Step("Prove the generated files are current", "fresh"),
            Step("Run only what you changed", "check", {"changed": True}),
            Step("Check the VS Code extension", "check", {"suite": "extension"}),
        ),
    }

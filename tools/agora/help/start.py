"""The first day, and the check to run before a push."""
from __future__ import annotations

from agora.core.help import Step, topic


@topic("start", "Your first day: what to install, what to run once, and how to look around.")
def start():
    return {
        "plain": ("agora is this repository's one command line. It needs only ws-host on your machine. ws-host brings Python and uv, "
                  "installs everything else agora needs, checks each program against a fixed fingerprint, and keeps one copy that "
                  "belongs to you."),
        "sections": (
            ("1. Install ws-host yourself",
             "Install ws-host (https://github.com/intellectual-frontiers/workspaces-host) and follow its first-run steps. Nothing else is "
             "needed from your machine, and agora never uses a program it finds there."),
            ("2. Nothing to enable",
             "ws-host uses this clone by itself: it comes from the intellectual-frontiers organization that ws-host trusts, and installing ws-host was your yes. "
             "A clone from another organization is the one case that asks you, once, from the root of the clone.\n\n    ws-host provider add ."),
            ("3. See that it runs",
             "Ask agora how it finds your machine. It lists what is present and what is not, and fails only on a real problem.\n\n"
             "    ./agora doctor"),
            ("4. Install the system libraries, once",
             "The browser needs a few shared libraries that only an administrator can install. ws-host does it, and it is the only "
             "command that uses sudo. It prints exactly what it will run and asks before it runs anything; with --dry-run it prints "
             "and stops.\n\n    ws-host system ensure --dry-run\n    ws-host system ensure"),
            ("5. Fetch the programs, once",
             "agora keeps the programs outside Python as a toolchain: TeX, a browser, Java, Node and a few more, each at one exact "
             "version, checked against its fingerprint before it is used. Each command has ws-host install what it needs the first "
             "time; to fetch them all ahead of time:\n\n    ws-host toolchain ensure --provider agora --all"),
            ("6. Look around",
             "Every command is listed, and each says what it does. The topics here are the rest of the learning.\n\n"
             "    ./agora command list\n    ./agora help"),
            ("7. Before you push",
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
             "The spec suite needs nothing but ws-host. It checks the specs, the enforcement register, the controls, the "
             "ontology, the toolchain, the commands and the help topics.\n\n    ./agora check --suite spec"),
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
            Step("Run agora's own tests", "test"),
            Step("Prove the generated files are current", "fresh"),
            Step("Run only what you changed", "check", {"changed": True}),
        ),
    }

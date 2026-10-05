"""The toolchain, the editor, AI agents, extending agora, the guide, and recovering."""
from __future__ import annotations

from agora.core.help import Step, topic


@topic("toolchain", "The programs agora fetches for itself, and how to see, fetch and trust them.")
def toolchain():
    return {
        "plain": ("agora needs more than Python: TeX, a browser, Java, VS Code. It does not use the ones on your machine. It fetches "
                  "each one at a fixed version, checks its fingerprint before it unpacks anything, and keeps it in a cache that "
                  "belongs to you."),
        "sections": (
            ("See the entries",
             "    ./agora toolchain list\n    ./agora toolchain show chromium"),
            ("Fetch them",
             "Each command fetches what it needs the first time, so this is only for fetching ahead of time. Every entry also "
             "runs its own small test after it is unpacked.\n\n    ./agora toolchain add"),
            ("Offline",
             "With --offline nothing is downloaded. A command that needs something not in the cache stops and names it; "
             "fetch it while you are online."),
            ("Use a program of your own",
             "Only when you ask for it, by name: set the entry's variable, such as AGORA_JRE, to the program. doctor lists every "
             "one that is set, and fresh will not call a generated file current when one stood in."),
            ("The system libraries",
             "A few shared libraries and a display server cannot be fetched without administrator rights. `agora help start` "
             "explains the one command that installs them."),
        ),
        "steps": (
            Step("List the entries", "toolchain list"),
            Step("Show one entry", "toolchain show"),
            Step("Fetch every entry", "toolchain add"),
            Step("List the system libraries and which are present", "system list"),
            Step("See what is present", "doctor"),
        ),
    }


@topic("editor", "Working in VS Code with IF Console: install it, find your way, and learn by doing.")
def editor():
    return {
        "plain": ("IF Console is a VS Code extension that shows this command line in the editor: a tree of commands, findings in the "
                  "Problems panel, a diff before anything is written, and a confirmation only you can give. It adds nothing a "
                  "command does not do."),
        "sections": (
            ("Build and install it",
             "Build the package, then in VS Code open the Extensions view, choose the three-dots menu, Install from VSIX, and pick "
             "the file in build/.\n\n    ./agora extension build"),
            ("Trust",
             "VS Code asks whether you trust the folder. IF Console runs nothing until you do, because it runs this repository's "
             "own command line. That choice is VS Code's own and is yours."),
            ("Find your way",
             "Open the IF Console view in the activity bar. Home lists what needs you, each with the command line that fixes it and "
             "a Run button; the views below it (Specs, Design systems, Toolchain and the others this command line declares) list "
             "its resources; Checks lists the sections. All commands, the tree of every command, is hidden until you turn on the "
             "setting `if-console.showAllCommands`. The palette's IF Console commands run Check, Fresh, Test and Doctor, and "
             "Learn shows these topics in one panel, each step with its command line to copy and a Run button."),
            ("Writes and decisions",
             "A command that writes shows what it would change in the resource panel first (each file can open as a diff), and runs only if you apply it. A decision "
             "asks in a dialog that names the command and what it changes."),
            ("Check the extension itself",
             "The unit tests run on Node. The real VS Code tests start VS Code under a display server, so run the one-time "
             "setup in `agora help start` first.\n\n    ./agora check extension"),
        ),
        "steps": (
            Step("Build the extension", "extension build"),
            Step("Check the extension", "check", {"sections": ["extension"]}),
            Step("Check it inside a real VS Code", "check", {"suite": "vscode"}),
        ),
    }


@topic("ai", "Working with an AI agent safely: its skill, its tools, and what it may and may not decide.")
def ai():
    return {
        "plain": ("An AI agent can read and propose here, but it cannot decide. agora gives it a skill file that says how, an MCP "
                  "server that offers it the commands it may use, and proposals for the changes only you may accept."),
        "sections": (
            ("The skill",
             "A skill file tells an agent how to call agora. It is generated from the registry, so it never drifts; fresh proves it.\n\n"
             "    ./agora skill generate"),
            ("The MCP server",
             "It serves every command that is not a decision, over standard input and output, and a write is a dry run unless "
             "the agent says otherwise. Point the agent's client at this command from the repository root:\n\n    ./agora mcp serve"),
            ("What an agent may not do",
             "It may not run a decision (a spec's status, an ink record, accepting a proposal). It writes a proposal instead: a "
             "tracked file that names the command and its values, with the reason."),
            ("Proposals",
             "You read a proposal, and accepting it replays its dry run first and then the command.\n\n"
             "    ./agora proposal list --status open"),
            ("What to give an agent",
             "`agora context spec:0042` returns the spec, its requirements, the files it governs and what to run next, bounded and "
             "saying what it left out."),
        ),
        "steps": (
            Step("Write the agent skill", "skill generate"),
            Step("List the open proposals", "proposal list", {"status": "open"}),
            Step("Draft a proposal", "proposal new"),
            Step("Get an agent the context for a resource", "context"),
        ),
    }


@topic("extend", "Adding a command or a group of commands with an AI, and proving the change is sound.")
def extend():
    return {
        "plain": ("Everything here is extended in Python, by adding a file. A command is a function in a group; a group is a "
                  "folder; a help topic is a module. Nothing else lists them, and the checks say whether the change is sound."),
        "sections": (
            ("Spec first",
             "Write the requirement, then the ontology entry, then the code. A new command needs an individual in "
             "ontology/ifcore.ttl and its requirement a row in spec-kit/enforcement.tsv; `agora help specs` has the steps."),
            ("A command",
             "In a group's commands.py, a function with the command decorator: its noun and verb, its category, its typed "
             "arguments, and a short help line. It returns a resource and calls library code. It imports only the standard "
             "library at module level."),
            ("A group",
             "A folder under tools/agora/groups/ with an agora.toml (its name, its nouns, its check sections) and a commands.py. "
             "If it needs a Python package, the manifest pins it to one exact version and `agora lock GROUP` writes its hashed lock."),
            ("A help topic or a toolchain entry",
             "A module in tools/agora/help/ or tools/agora/toolchain/ is found by presence. An entry carries its version, an "
             "address and a SHA-256 for each platform, and a small test that proves it works."),
            ("Prove it",
             "These four say whether the change is sound, and the last two rewrite what is generated.\n\n"
             "    ./agora check --suite spec\n    ./agora test\n    ./agora fresh\n    ./agora docs generate\n    ./agora skill generate"),
            ("A prompt to give an AI",
             "Tell it the spec first, name the group, and ask it to run those commands until they pass: \"Add a command "
             "`widget list` to a new group `widget`. Write the requirement in the spec and the ontology individual first, then the "
             "code, then run agora check --suite spec, test and fresh until they pass.\""),
        ),
        "steps": (
            Step("Check the spec suite", "check", {"suite": "spec"}),
            Step("Check the help topics", "check", {"sections": ["help"]}),
            Step("Run agora's own tests", "test"),
            Step("Prove the generated files are current", "fresh"),
            Step("Rewrite the guide's reference", "docs generate"),
            Step("Rewrite the agent skill", "skill generate"),
        ),
    }


@topic("guide", "The guide: where it lives, how it is built, and how it is published.")
def guide():
    return {
        "plain": ("The guide is a book. You write it in AsciiDoc in docs-src/, its reference chapters are written by agora from the "
                  "code, and one command builds it as a website, a single page, a PDF and an EPUB."),
        "sections": (
            ("Write",
             "The overview, the start and the questions are files in docs-src/chapters/. The reference chapters carry a header "
             "that says they are generated; edit the code they come from, not them."),
            ("Rewrite the reference",
             "    ./agora docs generate\n    ./agora fresh"),
            ("Build",
             "The converters are in the toolchain, so the first build fetches Java and AsciidoctorJ. The result is in build/docs/ "
             "unless you name another folder; open index.html there.\n\n    ./agora docs build"),
            ("Publish",
             "A push to main builds and publishes the guide to GitHub Pages through the pages workflow. The owner sets Settings, "
             "Pages, Source to GitHub Actions once."),
        ),
        "steps": (
            Step("Rewrite the generated chapters", "docs generate"),
            Step("Build the guide", "docs build"),
            Step("Prove the generated files are current", "fresh"),
        ),
    }


@topic("recover", "What to do when something fails.")
def recover():
    return {
        "plain": "Nothing here loses your work. When something fails, read what it says first: it names the command that fixes it.",
        "sections": (
            ("Exit statuses",
             "0 is success. 1 means what you checked failed. 2 means the command was used wrongly. 3 means something is missing: "
             "a package, a toolchain entry or a library, and the message names it."),
            ("A program or library is missing",
             "Fetch the toolchain, and install the system libraries once.\n\n    ./agora toolchain add\n    ./agora system add --dry-run"),
            ("A download did not match its fingerprint",
             "agora deleted it and unpacked nothing. A flaky network can cut a transfer; run the fetch again. If it fails twice, "
             "something is wrong with the source, and the entry's pin should be looked at, not worked around."),
            ("A generated file is stale",
             "fresh names the command that rewrites it. Run that command, review the change, and commit it.\n\n    ./agora fresh"),
            ("Offline",
             "Use --offline to make sure nothing is downloaded. A command that needs something not cached names it."),
            ("A report to paste",
             "To ask a person or an AI for help, give them what agora sees. It holds no secret.\n\n    ./agora doctor\n    ./agora context command:check"),
            ("The logs",
             "What a command did is kept, untracked, under .agora/logs/, one line each, for you to read."),
        ),
        "steps": (
            Step("See what is wrong", "doctor"),
            Step("Prove the generated files are current", "fresh"),
            Step("Fetch the toolchain", "toolchain add"),
            Step("List the system libraries and which are present", "system list"),
            Step("Gather a report to paste", "context", {"resource": "command:check"}),
        ),
    }

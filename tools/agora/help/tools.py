"""The toolchain, the editor, AI agents, extending agora, the guide, and recovering."""
from __future__ import annotations

from agora.core.help import Step, topic


@topic("toolchain", "The programs ws-host installs for agora, and how to see, fetch and trust them.")
def toolchain():
    return {
        "plain": ("agora needs more than Python: TeX, a browser, Java, Node. It does not use the ones on your machine. ws-host installs "
                  "each one at a fixed version, checks its fingerprint before it unpacks anything, and keeps it in a store that "
                  "belongs to you, with one copy for every repository that pins it."),
        "sections": (
            ("See the entries",
             "    ws-host provider show agora\n    ws-host toolchain show chromium --provider agora\n\nThe entries are the files in "
             ".workspaces-host/toolchain.d/ of this clone."),
            ("Fetch them",
             "Each command has ws-host install what it needs the first time, so this is only for fetching ahead of time.\n\n"
             "    ws-host toolchain ensure --provider agora --all"),
            ("Check that they work",
             "Every entry has its own small test, which runs on what is installed.\n\n    ./agora check toolchain --functional"),
            ("Offline",
             "With --offline nothing is downloaded. A command that needs something not in the store stops and names it; "
             "install it while you are online."),
            ("The system libraries",
             "A few shared libraries cannot be fetched without administrator rights. `agora help start` explains the one command "
             "that installs them."),
            ("Change a pin",
             "Edit the entry's file, run `ws-host toolchain generate agora`, and commit what it writes: the lock beside the entries is "
             "generated, and `agora check toolchain` fails when it is not current."),
        ),
        "steps": (
            Step("Check the toolchain's declarations", "check", {"sections": ["toolchain"]}),
            Step("See what is present", "doctor"),
        ),
    }


@topic("editor", "Working in VS Code with the Workspaces Console: install it, find your way, and learn by doing.")
def editor():
    return {
        "plain": ("The Workspaces Console is a VS Code extension that shows this command line in the editor: a tree of commands, "
                  "findings in the Problems panel, a diff before anything is written, and a confirmation only you can give. It adds "
                  "nothing a command does not do. ws-host houses it."),
        "sections": (
            ("Install it",
             "ws-host installs it from its release when it sets up VS Code.\n\n    ws-host vscode ensure"),
            ("Trust",
             "VS Code asks whether you trust the folder. The Console runs nothing until you do, because it runs this repository's "
             "own command line. That choice is VS Code's own and is yours."),
            ("Find your way",
             "Open the Workspaces Console view in the activity bar. Home lists what needs you, each with the command line that fixes "
             "it and a Run button; the views below it (Specs, Design systems and the others this command line declares) list its "
             "resources; Checks lists the sections. All commands, the tree of every command, is hidden until you turn on the "
             "setting `workspaces-console.showAllCommands`. The palette's Workspaces Console commands run Check, Fresh, Test and "
             "Doctor, and Learn shows these topics in one panel, each step with its command line to copy and a Run button."),
            ("Writes and decisions",
             "A command that writes shows what it would change in the resource panel first (each file can open as a diff), and runs only if you apply it. A decision "
             "asks in a dialog that names the command and what it changes."),
        ),
        "steps": (
            Step("See what is present", "doctor"),
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
             "Ensure the toolchain is installed and the system libraries are present, once.\n\n    ws-host toolchain ensure --provider agora --all\n    ws-host system ensure --dry-run"),
            ("A download did not match its fingerprint",
             "ws-host installed nothing. A flaky network can cut a transfer; run the fetch again. If it fails twice, "
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
            Step("Gather a report to paste", "context", {"resource": "command:check"}),
        ),
    }

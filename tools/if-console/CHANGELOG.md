# Changelog

All notable changes to Intellectual Frontiers Console (IF Console). The version is the one in `package.json`; an extension that is installed
from a `.vsix` is updated by building and installing the new one (the repository's own `extension build` command).

## 0.1.0

First version.

- **Home** in its own activity-bar container: what needs you across every command line in the window (failing checks, open proposals, stale
  generated files, toolchain and library gaps, health), each with the plain words, the exact command line to copy and a Run button; its count
  is the view's badge and the status bar's, and a click on either opens Home with the first suggestion in view.
- **The views each command line declares** (for example Specs, Design systems, Builds, Toolchain), then **Checks**, with rows drawn from the
  command line's own declaration: a label, a muted description, a status as a colored codicon, a badge, a rich tooltip, inline buttons and
  grouped context menus. **All commands** is the tree of every noun and command, hidden until you show it.
- **Search** in the title of a view whose command line declares a `search` option for its list (the Ontology view, for one): it asks for a
  text, runs the list with that option, and shows the rows in the command line's own ranking, each with the icon of its kind; a choice opens
  the term. A request that finds nothing says so and offers every row. A list may also name a row field for each row's own icon.
- **The resource panel**: one panel for the window in which a resource, a Learn topic and a dry run open, drawn from the resource's JSON with
  VS Code Elements and the codicon font. It has history (back and forward), a breadcrumb, an *Open to the Side* choice, a header (codicon, title,
  kind and id, audience and status pills), an action toolbar (a primary action, icon buttons, an overflow menu with *Copy as JSON* and *Copy
  Context*, a decision styled apart and still behind its modal), and sections by the data's shape: a key-value grid, a sortable and filterable
  table whose rows open and whose cells that name another resource are links, a stage ladder as a stepper, findings that open at their file and line, paragraphs, and link chips.
- **Learn**: a quick pick of the topics the command line lists, and a topic as numbered steps, each with the exact command line to copy and a
  Run button, a step you must do yourself marked as yours, and a link to the next topic.
- **Dry run**: a write is run with `--dry-run` first; its change summary (files, lines added and removed) is in the panel with *Open Diff* for each
  file, *Apply* and *Discard*; a decision then meets its modal.
- **Show View…** in the palette lists the views a window has by their real titles, and a view no command line declares is not shown.
- **Native surfaces first**: a Test Explorer controller (a test for each check section, with finding children at their lines), Problems,
  file decorations for files with findings, `vscode.diff`, a log output channel, tasks, hovers, Go to Definition, CodeLens and links in the files a
  command line's references name, and settings that carry a description each.
- **Marketplace-ready package**: a 128-pixel icon made at build time from the organization's brand mark, a gallery banner, categories and
  keywords, this changelog, a README with screenshots, `package.nls.json` and a language bundle for every string the code shows.
- Unchanged guarantees: nothing runs in a workspace you have not trusted, a write is always dry-run first, a decision only after a modal only you
  can answer and never over MCP, no network, no telemetry, and the extension exports no API.

# I am an agent

This site is written for you as much as for a person: every page has a Markdown twin and every model has JSON, so you can read what you need without a browser.

- **`llms.txt`** at the site's root lists every page and file with a line for each. Start there.
- **Markdown twins.** Change `.html` to `.md` in any page's address and you get the same page in Markdown, with its links.
- **Models and programs as JSON.** `models/index.json` lists the data models and `programs/index.json` the command-line programs; each entry names its file. Every element has a stable id, a layer, a definition, where it is written (a link to the line) and what it is made into (its trace).
- **`search.json`** is the site's search index.
- **Specifications** have one page each, with an anchor for each requirement and the row that says how it is enforced, so a requirement can be quoted by address (`specs/0033-kanon.md#fr-001`).

How to find the code for a question: name the library (the Libraries pages say what each is for), open its API reference for the export, follow "Declared in" to the file, and open the specification the page cites to learn what it must do. The layers tell you what you may edit: only governance is written by hand where a library has generated layers; files with `.auto.` in their name are never edited.

**Your first small task:** from `llms.txt` alone, find where a Kanon table of layers is declared and which test proves the requirement that says so.

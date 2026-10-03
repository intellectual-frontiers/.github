# Font licences

Every font in this folder is free to use, embed in a PDF, and redistribute. Each is licensed under the SIL Open Font License 1.1 (`OFL-1.1.txt`) unless a line below says otherwise. A font's licence is a condition of keeping it here: add a font only with a licence that allows embedding and redistribution, and list it.

| Family | Files | Designer or foundry (from the font) | Licence | Used for |
|---|---|---|---|---|
| Source Serif 4, Source Sans 3, Source Code Pro | SourceSerif4-*, SourceSans3-*, SourceCodePro-* | Adobe | OFL 1.1 | The book's text and code; the article's house typeface set (`house`) |
| Inter | Inter-* (Regular, Medium, SemiBold, Bold, Italic, Bold Italic; Inter 4.0) | Rasmus Andersson | OFL 1.1 | The book's sans and covers |
| STIX Two Math | STIXTwoMath-Regular.otf | STI Pub | OFL 1.1 | Mathematics; glyph fallback |
| Spectral | Spectral-* | Production Type | OFL 1.1 | `spectral` typeface set |
| PT Serif | PTSerif-* | ParaType | OFL 1.1 (as published by Google Fonts) | `pt-serif` set |
| Gelasio | Gelasio-* | Eben Sorkin | OFL 1.1 | `gelasio` set |
| Charis SIL | CharisSIL-* | SIL International | OFL 1.1 | `charis` set |
| Lato | Lato-* | Lukasz Dziedzic | OFL 1.1 | `lato` set |
| Roboto Condensed, Fjalla One, Martian Mono | various | various | OFL 1.1 (Apache 2.0 for Roboto Condensed) | Covers, "Try this with AI" boxes, and figures |

Spectral, PT Serif, and Gelasio here are the Latin subsets Google Fonts serves (about 220 to 230 characters). They do not have arrows, mathematical signs, or Greek letters, so every typeface set falls back to the house fonts and STIX Two Math for a missing character (`latex/typefaces.json`). They are fit for this build and not as general-purpose copies.

Commercial typefaces (Quadraat, Harding, Guardian, Meta, Minion, and others) are never kept here. Licensed copies are the consumer's own: it installs them outside this design system and names their directory in `IF_FONTS_LICENSED` (`docs/paper-layouts.md`, "Typefaces").

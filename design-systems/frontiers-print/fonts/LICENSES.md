# Font licences

Every font in this folder is free to use, embed in a PDF, and redistribute. Each is licensed under the SIL Open Font License 1.1 (`OFL-1.1.txt`) unless a line below says otherwise. A font's licence is a condition of keeping it here: add a font only with a licence that allows embedding and redistribution, and list it.

| Family | Files | Designer or foundry (from the font) | Licence | Used for |
|---|---|---|---|---|
| Source Serif 4, Source Sans 3, Source Code Pro | SourceSerif4-*, SourceSans3-*, SourceCodePro-* | Adobe | OFL 1.1 | The house typeface set (`house`) |
| STIX Two Math | STIXTwoMath-Regular.otf | STI Pub | OFL 1.1 | Mathematics; glyph fallback |
| Spectral | Spectral-* | Production Type | OFL 1.1 | `spectral` typeface set |
| PT Serif | PTSerif-* | ParaType | OFL 1.1 (as published by Google Fonts) | `pt-serif` set |
| Gelasio | Gelasio-* | Eben Sorkin | OFL 1.1 | `gelasio` set |
| Charis SIL | CharisSIL-* | SIL International | OFL 1.1 | `charis` set |
| Lato | Lato-* | Lukasz Dziedzic | OFL 1.1 | `lato` set |
| Inter, Roboto Condensed, Fjalla One, Martian Mono | various | various | OFL 1.1 (Apache 2.0 for Roboto Condensed) | Figures and diagrams (the figure kit) |

Spectral, PT Serif, and Gelasio here are the Latin subsets Google Fonts serves (about 220 to 230 characters). They do not have arrows, mathematical signs, or Greek letters, so every typeface set falls back to the house fonts and STIX Two Math for a missing character (`house-design/latex/typefaces.json`). They are fit for this build and not as general-purpose copies.

Commercial typefaces (Quadraat, Harding, Guardian, Meta, Minion, and others) are never kept here. Licensed copies go in `house-design/theme/fonts-licensed/`, which is not committed (`works/research/layouts/README.md`, "Typefaces").

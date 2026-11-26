# Feature Specification: A read-only static report site

**Spec ID:** 0002-report-site
**Status:** Active
**Owner:** if
**Domain:** commons

**Input:** An assessor, a client or an owner should be able to open a report of a compliance posture without logging in to anything: an index of how each requirement stands and a page for each with its objectives, its evidence, its grade and who answers for it. The report is made from the assessment, the grades and the matrix of responsibility (commons assessment, tenancy), is plain files that can be kept as evidence and read offline, and shows counts and never a percentage.

## Requirements

- **FR-001**: A report MUST be made from a title, the instant the posture is of, a framework's id and title, an assessment, the grades of its objectives, optionally the matrix of responsibility and the titles of requirements; it MUST show what it is given and work out no standing or grade of its own.
- **FR-002**: The site MUST have an `index.html`, a `style.css`, a page `requirements/<id>.html` for each requirement of the assessment, and `report.json` with the counts, roll-ups and grades the pages are made from.
- **FR-003**: The index MUST list each requirement with its standing, its number of objectives and who answers for it (or that this is not stated), the count of objectives in each standing and of each grade, the requirements nobody is named for, and the evidence that names objectives the framework does not have; it MUST give no percentage.
- **FR-004**: A requirement's page MUST give, for each of its objectives, the statement, its standing and grade (with the record the grade rests on, its origin and its age), and a table of the evidence with its method, result, who made it, when and the source; and who answers for the requirement with the note of a shared one.
- **FR-005**: Every text that comes from the input MUST be escaped for HTML; a file name MUST keep only letters, digits, dots, dashes and underscores; the pages MUST have a language, a title, headings and tables with column headers.
- **FR-006**: The site MUST be plain HTML and one stylesheet with no script and no address of anywhere (no link, font, image or form that reaches out), so that it can be opened from a file and kept as evidence; and the same input MUST give the same bytes.
- **FR-007**: Writing a site MUST put each file under the folder given, in the order of their paths, and MUST refuse a file whose path leaves the site.

## Acceptance scenarios

1. **Given** an assessment with one requirement met and one with no evidence, **When** the site is made, **Then** the index lists both with their standing and a page exists for each, per FR-002 and FR-003.
2. **Given** a statement that contains `<script>`, **When** the site is made, **Then** no page contains a script element, per FR-005 and FR-006.

## Out of scope

- Serving the site, signing it and publishing it: the program that uses the library.
- Printing and PDF.
- Several tenants in one site: a portfolio page is a later addition.

## Edge cases

- A requirement with no responsibility stated is shown as not stated, per FR-003.
- An objective with no evidence says so, per FR-004.

## Assumptions

- A reader's browser follows the system's light or dark preference through the stylesheet.

## Open questions

- None.

## Key entities

- **Report input**, **Site**.

## Success criteria

- **SC-001**: A posture can be handed over as a folder of files that opens offline and shows, for every requirement, what supports it and how strongly.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] No company fact is asserted here
- [x] Every open item is marked, not silently decided

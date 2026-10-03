# Templating reference

The optional server-side template vocabulary the markup contract (`chrome.md`) is written
against, with its names listed in `data/registry.json`. A consumer MAY implement it or produce the
same markup another way; nothing else in this design system depends on it (spec FR-020). Templates as described here are valid HTML5 inside a content
document. They run when content loads, over the whole content store, and nothing of them reaches a
browser. A template is evaluated against a
**current record**: the document's own record at the top level, the matched record inside `app-each`,
and the included document's own record inside `app-include`.

| Construct | Does |
| --- | --- |
| `<app-field name="title">` | Outputs one scalar property of the current record, as escaped text. `of="/portfolio/x"` reads another record. |
| `data-app-bind-<attr>="prop"` | Sets `href`, `src`, `alt`, `title`, `datetime`, `width` or `height` from a property. `href` and `src` accept only URL-typed properties or `@url`. |
| `data-app-if="condition"` | Keeps the element only when the condition holds. |
| `<app-each kind="Book" where="…" sort="…" limit="n"><template>…</template></app-each>` | Renders the template once per matching record. |
| `<app-include src="_partials/cta.html">` | Splices in the body of a `Partial` or `Page` document. `src` follows relative-reference rules from the including document. |
| `<app-records kind="Book"><a href="/portfolio/x"></a>…</app-records>` | A curated list of records, in the order written. |
| `<app-units>` | The business units, from the ontology. |

## Properties
Any scalar property of the record's shape, plus `@url` (the record's URL) and `@kind` (its shape name).
An absent optional property outputs nothing, and a binding to it omits the attribute.

## Conditions
One or more terms joined by ` and `: `has prop`, `prop = 'text'`, `prop != 'text'`, `prop = 5`. Comparison
is typed: text properties compare with a quoted string, integer properties with an integer.

## Query order
`sort="prop"` or `sort="prop desc"` over a scalar property. Absent values sort last in both directions, and
ties break by URL. `limit` applies after `where` and `sort`.

## Layouts and fragments (on `<body>`)
`data-app-layout="default|bare"`: no attribute means no layout. `data-app-chrome` refines `default`.
`data-app-as="fragment"` returns the body content alone.

Every reference is checked against the ontology shapes when content loads; an error names the file and element.

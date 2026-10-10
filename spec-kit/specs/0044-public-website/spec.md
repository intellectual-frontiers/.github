# Feature Specification: The public website

**Spec ID:** 0044-public-website
**Status:** Draft

**Input:** How www.intellectualfrontiers.com is made: its pages rendered on
the server from the Eidolon's website model, showing the company's works
rather than its structure, with server-driven dynamic parts (Datastar) and an
application beside them that serves what only identified readers may reach.
One program, `eid-site`, written in Rust, renders the pages, serves them from
an in-memory cache, and publishes them with their model as a container image.
This spec states what the pages are rendered from, which works and facts they
may show, how they present them, which addresses the website keeps, how the
program renders, caches, serves and publishes them, how the application
relates to the pages, and how it is checked. What a public record holds is
0015-work-packages FR-029; what a content document is, 0002-content-format;
how addresses map to content, 0004-addressing; what the application does,
0046-distribution-platform.

## Generation

- **FR-001**: The public website's pages MUST be rendered by one
  deterministic program, `eid-site` (FR-032), on the server, from the
  website's model: what the program reads from the vault's work packages,
  ontology and content, the public root's ontology, content and design
  systems, and, for the registers FR-013 names, the snapshot it describes,
  kept to what FR-003 lets the website show. Rendering the same model MUST
  yield the same pages. The website MUST NOT be published as static files.
- **FR-002**: No page MAY be authored outside the Eidolon's two
  repositories: the web property is a presentation layer generated from the
  vault, has no repository of its own, and holds no works
  (0001-eidolon-architecture FR-001).
- **FR-003**: The generator MUST include a work only when the work is
  Public or announced (0015-work-packages FR-027), and for an announced
  work that is not Public, only its public record (0015 FR-029). It MUST
  include a content document only when its audience is Public. Nothing
  else, including a title, a slug or the existence of a work, MAY appear
  in any generated file.
- **FR-004**: The generator MUST refuse to write the website when a check
  of its own output finds a page or file showing a work that is neither
  Public nor announced, or a fact outside a public record (FR-003).
- **FR-031**: The website MUST be rendered on the server only (FR-001):
  its pages are server-rendered, and its dynamic parts (the log-in, a
  person's own page parts, filtering and searching, live updates) MUST be
  server-driven over server-sent events with Datastar (FR-059).
- **FR-032**: The website's generator, its preview server and its publisher
  MUST be one program, `eid-site`. It MUST be written in Rust
  (0025-tooling-environment FR-030). The `site` command group of `eid` MUST
  only run it and MUST NOT decide what the website shows.
- **FR-033**: The server MUST render the website's pages from the model
  into an in-memory cache. Each cached page MUST know its sources, which
  form its source graph: the records, documents, files and other pages its
  rendering read. A page MUST be rendered again only when a source in its
  graph has changed. A change MUST be found by comparing content hashes. A
  page whose rendering did not change MUST NOT cause the pages that depend
  on it to be rendered again. A page MUST be rendered when its sources
  change and MUST NOT be rendered again for a request; what a request adds
  to it (a logged-in person's own parts, FR-058) MUST be added to the
  cached page, and an answer to a Datastar request MUST be computed from
  the model and the cache.

## Showing the work

- **FR-005**: The home page MUST lead with the works: what was most
  recently announced or released, and a showcase of each kind of work. A
  unit MUST NOT be the principal subject of any page except one page about
  the company (0021-works-and-presentations FR-014, FR-015).
- **FR-006**: The website MUST have, for each kind of work it shows, an
  index and a page per item: books, the Journal (0009-press) with the
  research papers, pillars and notes it carries as departments (FR-061),
  patents, trademarks, defensive disclosures, the products (FR-063), the
  spoken works, ventures and companies, funds, and the Network's hunts.
  Writing is carried by the Journal's elsewhere department (FR-065) and
  has no index of its own.
- **FR-007**: The products front MUST present every Public skill with its
  text, every book companion that is Public, and the interactive tools the
  previous website offered, as products a reader can use; an interactive
  tool keeps the address the previous website published.
- **FR-008**: A book's page MUST show its front cover, its public record,
  its status (0015 FR-031), its companion and its news. Wherever the website
  shows a book's cover, on its page and on every shelf of books, it MUST show
  it as the standing 3D mockup composed from the approved front cover
  (0016-press-production FR-028), not the flat cover. Every other image on
  the website MUST come from the frontiers-brand imagery pool
  (0014-design-systems FR-044), except the home page's picture, which is the
  website's own (FR-077); a work other than a book needs no image. A
  book's page MUST also show what `page.yml` beside its jacket states
  (0015-work-packages): the premise, a pull quote, the specifications the
  website shows, its parts and chapters, the frameworks it teaches and who
  it is for.
- **FR-009**: Writing published on a channel the company owns, and any
  work whose authoritative text lives elsewhere, MUST be shown as a
  reference that links to where it lives, never as a copy
  (0015-work-packages FR-026).
- **FR-010**: Every page's colours, type and imagery MUST come from the
  frontiers-brand design system's tokens; the generator MUST NOT state a
  colour literal of its own (0014-design-systems FR-044).
- **FR-054**: A page with a breadcrumb trail MUST show it in a band of the
  header, which stays at the top of the viewport while the page scrolls, as
  frontiers-nature-web FR-012 and FR-013 state for their own chrome: the
  first crumb links home, the last is the current page, marked
  `aria-current="page"`, and BreadcrumbList structured data matches it. A
  trail of five or more crumbs MUST fold the crumbs between the first and
  the current page's nearest parents (two on a narrow screen, three on a
  wide one when that still folds two) into a menu that opens on activation
  and closes on an outside click or Escape. A long label MUST be shortened
  with an ellipsis and keep its full text as the link's title. A browser
  that cannot open the menu MUST show the whole trail.
- **FR-055**: Every author the vault keeps a biography for (its house
  design's author files) MUST have one profile page at `/authors/<slug>`,
  listed at `/authors`, that shows the biography and every book, paper,
  Journal article and patent on the website the author wrote or invented.
  A page that names such an author (a book, a paper, a Journal article, a
  patent) MUST link the name to the profile and MUST NOT repeat the
  biography. An author with no biography is shown by name only.
- **FR-056**: Every book with a preview excerpt whose audience is Public
  (0021-works-and-presentations FR-027) and whose PDF the program holds
  MUST offer a preview on its page; no other book MAY: its front matter and its first
  chapter, read from the PDF's outline, or its first 15% of pages when
  those are shorter, by the decision authority's rule; no other page of an
  announced book's manuscript MAY appear (FR-003). The preview MUST be read
  in the page's own reader and MUST NOT be offered as a download: the
  server MUST draw a previewed page from the book's PDF when the reader
  asks for it, MUST keep a drawn page in memory, and MUST send it over
  Datastar (FR-059) only as an image whose tiles are shuffled, which the
  reader puts back together on a canvas with a watermark that names the
  website and the page. The server MUST NOT draw a page outside the
  preview and MUST NOT serve the PDF for it. The reader MUST show no text
  layer, MUST hide the pages when printed, and MUST show the preview's
  pages, the book's page count and a way to ask for the book.
- **FR-057**: A work's renditions (a PDF, an EPUB, a recording) MUST be
  kept in the vault's build directory, untracked by Git, under the address
  the website serves them from:
  `/works/<origin>/<audience>/<kind>/<format>/<slug>.<ext>`, or, for a
  browsable edition of many pages (FR-060),
  `/works/<origin>/<audience>/<kind>/html/<slug>/` holding its pages, where
  `<origin>` is `auto` for a rendition generated from the work's source
  and `original` for one that was not, and `<audience>` is `public` for a
  Public work and `confidential` otherwise. A rendition, whatever its
  audience, MUST be served only to a person who has logged in (FR-058),
  except a browsable edition, which is served as FR-060 states,
  and MUST NOT be in the website's model unless the model is exported
  with its renditions (a browsable edition whose presentation is Public
  always is); a book's PDF the model holds for its preview
  (FR-056) MUST NOT be served. On the person's own computer the program
  MUST serve the whole tree without a log-in, with a listing of each of
  its directories.
- **FR-058**: The program MUST offer a log-in: at `/__eid/login` (FR-036),
  linked as "Login" at the bottom right of every page's footer, a person
  enters an email address, and when it is one of the addresses the
  program itself holds (not its configuration) the program MUST email a
  code that holds for three minutes; the code entered logs the person in
  for a session of at most twelve hours, held in a cookie the program
  signs. Any other address MUST see the same steps and MUST NOT be logged
  in. A page MUST NOT name a rendition's address: once logged in, the
  server MUST add its work's renditions for download to the page, and the
  answer MUST be private to that person and never cached; not logged in, a rendition's address MUST answer that a log-in is needed and
  send the person to log in, whether or not a file is there (FR-003).
  Tries and emails MUST be limited. Every credential MUST come from the
  destination's secrets (FR-022). A program holding renditions with no
  log-in configured MUST refuse to start. The pages themselves stay
  public.
- **FR-060**: A work's browsable edition (0021-works-and-presentations
  FR-026) MUST be its pages, generated from its source, kept in the works
  tree (FR-057) and served to whoever its presentation's audience allows:
  one whose audience is Public to every visitor, and any other only to a
  person who has logged in (FR-058), and on the person's own computer
  without a log-in. The program MUST NOT serve a work's browsable edition
  that no presentation describes. A role for a named agreement, such as a
  subscription, is not specified yet. The work's page MUST link its
  browsable edition only for a reader who may open it.
- **FR-061**: The Journal's front page MUST be the website's one front for
  the firm's research. It MUST show, in this order: the current issue
  (0009-press FR-053) with its volume, number, citation form and the
  items published in the quarter; the sections, one per research area,
  each holding the area's papers, pillars, notes and positions with the
  department of each as its label (0009-press FR-047); the newest notes;
  the elsewhere department (FR-065); the register of positions and the
  corrections page (0009-press FR-048, FR-049); and the masthead, which
  states the Journal's policy in a sentence per rule. A paper, pillar and
  note keep the page and address they have, within the Journal's section
  of the website. A paper whose research area is not recorded MUST be
  listed under one holding heading that says so, and the check (FR-004)
  MUST report it.
- **FR-062**: Every card and item page of the Journal MUST show its
  department as its kicker and its settledness as written in its work's
  status, with its claim kinds where its record labels them
  (0009-press FR-001, FR-021); a working paper's card MUST say it is a
  working paper. An item that an episode of the Show presents MUST link
  the episode (0017-spoken-and-research-works FR-010).
- **FR-063**: The products front MUST list every intellectual product a
  reader can use, grouped by how it is taken: open (skills, companions
  and interactive tools, per FR-007); software; services (the shared
  services); and data and methods (datasets, methods and landscape
  studies). Every card MUST show the product's stage as its record states
  it (0011-studios FR-013), a piece of software MUST show its licence and
  status (0011-studios FR-015), and a shared service MUST NOT be labeled
  an AI Workforce unless its record is (0011-studios FR-011). The
  publications the company runs MUST be listed as products, each a
  reference to where it lives (FR-009).
- **FR-064**: The ventures front MUST list only ventures, companies and
  funds, with the Network's hunts. A venture's card and page MUST show
  its entity, its operator, its rights position and its closure condition
  where its record states them (0011-studios FR-014), and MUST say which
  it does not state. A product spun out into a venture MUST be shown on
  the product's page as having become the venture and on the venture's
  page as having grown out of the product (0011-studios FR-028).
- **FR-065**: Writing whose authoritative text lives elsewhere (FR-009)
  MUST be shown in the Journal's elsewhere department (0009-press FR-054),
  each piece with its kind as its kicker, its author and an outward link,
  and on its author's profile (FR-055), and MUST NOT appear in an issue
  unless 0009-press FR-054 admits it.
- **FR-066**: The navigation of every page MUST list exactly six fronts,
  in this order: Books, Products, Journal, Patents, The Show, Ventures.
  The home page's showcases (FR-005) MUST follow the same fronts: one
  showcase for the Journal that leads with the current issue, and none
  for research or writing apart from it.
- **FR-067**: The Journal MUST offer a machine edition: each article as a
  Markdown copy beside its page, as ScholarlyArticle structured data, and
  as one line of `llms.txt`; each issue as a JSON document; and a stable
  identifier and citation form on every article and issue.
- **FR-069**: When the program senses the vault's command line beside the
  website it serves, its launcher `eid` at the root of the clone it renders
  from, which is so on the person's own computer (FR-017) and never in the
  container image (FR-035), the page of every book, research paper,
  pillar and note, Journal article, product and venture MUST show, under
  its page head and before the work, a band headed "Console", read from the
  desk export the vault's command line writes (`eid insight build desk`,
  specified in the vault). The Console has two parts. "What's left" MUST
  show what the work still needs: the export's items grouped by who acts
  (the decision authority, the editor, the author, the producer), each
  with its level (a blocker, needs a person, for information), its
  sentence, the command that shows or fixes it, where it was found, and
  the requirement it serves as the spec's own text cut at two hundred
  characters with the spec's path and line; the work's readiness score and
  the prerequisites of its next stage; and "Nothing is left on the desk"
  when the export holds no item for the work. "Starting something new"
  MUST show the guides the export names for the work's kind: the vault's
  help topics, each with its summary, its sections and its steps, every
  step's command shown as the line a person types with a control that
  copies it. Each of the six fronts and the home page MUST show a Console
  too: its "What's left" is the roll-up of the pages under that front (the
  home page's of every page), the counts by level, and the pages with the
  most to do first, each linked; its "Starting something new" is the
  guides the export names for the front, among them how to start a work
  of that kind, run its checks and advance it. The Console MUST say when
  the export was made and the command that refreshes it; when the export
  is missing it MUST say so and name that command. On this computer the
  Console is a facade for the vault's command line: beside every command
  it shows, a control MUST run that command through the vault's own
  launcher, never a shell, and stream what it prints into the page as it
  runs, with its exit; a `read`, `check` or `build` command runs at once; a
  `record` or `generate` command runs first as a dry run, and for real only
  on a second request that says so; a `decision` or `setup` command never
  runs from a page, its line is there to copy; a line that is not a
  command of the vault, or that carries a shell's own characters, is
  refused and the refusal shown. One command runs at a time. The Console
  MUST offer its own refresh, the command that makes the export again, and
  the page MUST show the result once it is written. Nothing runs from a
  model or at a container host, and the address that runs a line is one of
  the reserved ones (FR-036). A rendered page MUST carry only the Console's
  placeholder, which asks the program's server for the Console when the
  page opens, at a reserved address (FR-036); the Console MUST be rendered
  at that request from the export and MUST NOT be part of any rendered
  page, so that the check of the pages (FR-004) never reads it and a page
  is published without it. The Console MAY name a work that is not yet
  announced, since it is the editor's own desk on the editor's own
  computer. The program MUST sense the Console by that launcher and by
  nothing else, with no mode to choose: the same build and the same serve
  show it where the launcher is and not where it is not, so what the
  person tests differs from what the destination serves by the placeholder
  and the control alone. The Console MUST NOT render where no launcher is
  beside the website, the container host among them (FR-035), MUST NOT be
  in the model or in any file the model holds, and nothing it shows MAY
  reach a published page (FR-003, FR-027).
- **FR-070**: Wherever the Console may render, the masthead MUST carry a
  control labelled "Console" that shows and hides every Console on the
  page without a reload. The person's choice MUST be kept in the browser
  and hold across pages, the Console MUST be shown until the person hides
  it, and the control MUST NOT appear where the Console may not render.
- **FR-071**: The control and the Console's heading MUST carry the brand's
  console icon, the "What's left" part its what's-left icon and the
  "Starting something new" part its desk icon (frontiers-brand FR-021),
  each before the words and drawn in the text's colour. The Console MUST
  be set apart from the page by a double rule in the brand's tertiary
  colour and MUST say that it is for this computer only.
- **FR-072**: Every page's head MUST link the brand's icons, as the
  vendored brand ships them (frontiers-brand FR-007, FR-013, FR-018), and
  never a redrawn one: `images/favicon.png` at `/assets/favicon.png`,
  `images/favicon.ico` at `/favicon.ico`, the Apple touch icon at
  `/apple-touch-icon.png`, and a web app manifest at `/site.webmanifest`
  that names the 192, 512 and maskable 512 icons under `/assets/icons/`
  with the brand's surface and primary colours read from its stylesheet.
  These addresses MUST stay as they are, unhashed, since devices and
  browsers fetch them by name; the manifest's colours are the brand's, not
  the generator's (FR-010).
- **FR-073**: Every page MUST read in the house's written voice on one
  point the check can hold: it MUST NOT announce what it is about to say,
  describe what the writing is doing, look back at what it said, or head a
  section with a topic or an activity instead of a claim
  (frontiers-written-voice FR-009). The check (FR-004) MUST read every
  page's title, description, headings and paragraphs against the lists the
  vendored written voice keeps in `patterns.json` (its announcements,
  throat-clearing, headline openings and bare labels) and MUST refuse the
  website on a hit, whichever source the text came from: the generator's
  own words, a work in the vault, a page under the public root's
  `content/`, or the snapshot (FR-013). The lists have one source, the
  design system, so the website and the writers' own sweeps agree.
- **FR-074**: The company's records that the website shows MUST be held
  in the public root under `registers/`, one JSON file per record named by
  its slug, as the patents are (0051-patent-portfolio FR-008), and the
  generator MUST read them there, never from the snapshot (FR-013):
  `registers/portfolio/` for the works of the portfolio register that are
  not held elsewhere (ventures, companies and funds, FR-064; software,
  shared services, datasets, methods, landscape studies and the
  company-run publications, FR-063), each with its kind, unit, title,
  summary, status, year and the detail, links and specifications its page
  shows, and `moved.json` naming each `/portfolio/` address of the previous
  website whose work is held elsewhere now and where it lives
  (0024-persistent-addresses); `registers/trademarks/` for the marks, with `groups.json` naming
  the groups and the date the USPTO record was read; `registers/disclosures/`
  for the defensive disclosures; `registers/hunts/` for the Network's
  hunts with their packets; `registers/topics/` for the subject tags the
  website files records under, each with its title and summary (the
  research areas are topics too, from their records, FR-075); and
  `registers/writing/` for the founder's writing that lives elsewhere
  (FR-009, FR-065), each with its title, summary, date, kind, series, tags
  and address; and `registers/news/` for the dated What's new items the
  previous website published, each with its title, date, link, summary,
  area, kind, keywords and text. A fund's record carries, under `fund`,
  the size, the earlier address and the lists its page shows. A record
  carries `order`, its place in the
  register, so a front lists records as the register orders them. A record
  states facts; the ontology holds the individual it describes where one is
  asserted (0007-work-and-assets FR-008), and a page MUST show what a
  record states and say what it does not (FR-063, FR-064).
- **FR-075**: The research areas, pillars, notes and publications the
  website shows MUST be research records of the vault
  (0017-spoken-and-research-works FR-017), one per work package under
  `works/research/<slug>/`, read from the record's AsciiDoc source and
  shown only when the ontology gives the work a Public audience; the
  generator MUST read them there, never from the snapshot (FR-013). A
  pillar's page is its header and its sections; a note's is its summary,
  header and sections; an area's introduction is its sections and its
  parent is its `:parent-area:`; a publication's page is its header, its
  abstract and its summary. A section's claim label, falsifiability list,
  points, sources, table, figure and screen are the blocks the vault's
  research standard writes (`house-design/research/README.md`, section
  attributes), and a figure or screen is shown as its title and
  description (FR-042). A record's `:related:` names other records by
  slug; the generator resolves each among the pillars, notes, papers,
  publications, disclosures, trademarks, patent families and portfolio
  works it lists, in that order, and leaves out one it does not list.
- **FR-076**: The blog posts of the previous website MUST be content
  documents of the public root, `content/blogs/<slug>.html`, each of kind
  `ifweb:ArchivedPostPage` (0013-web-content-kinds FR-018), kept as
  published with its date and summary; the generator MUST read them there,
  never from the snapshot (FR-013), list them in the archive at `/blogs`
  and serve each at `/blogs/<slug>`, the address it had. The topics the
  website organizes records under MUST be the research areas (FR-075),
  each at `/topics/<slug>` with its introduction, parent and the records
  filed under it (FR-042), and the subject tags of `registers/topics/`
  (FR-074).
- **FR-077**: The website is a work of kind `website` whose slug is its
  domain name (0015-work-packages FR-004, FR-036):
  `works/website/www.intellectualfrontiers.com/`, the default website.
  The generator MUST build the site named to it, or the default, and read
  from that package its identity (`website.yml`), its stylesheet, scripts
  and interactive tools, the home page's picture and the previous
  website's sitemap (FR-014); its check MUST refuse the website when a
  page's address, contact address or analytics container (FR-015) differs
  from what `website.yml` states, and MUST write the crawler rules from
  it. The website's own copy MUST be held in the public root under
  `websites/<fqdn>/`: `websites/www.intellectualfrontiers.com/about.json`,
  the About page's proposition, opening statement and body, claims
  standard, unit boundaries, provenance and corporate facts. The Zero
  Security Theatre registers (FR-043) are a data file beside that area's
  research record (0017-spoken-and-research-works FR-018).
- **FR-078**: Every date the website shows MUST be a fact its source
  states, never chosen for effect. A work's date is the date its record
  carries. A pillar's start is its `:started:`, and where that year is
  earlier than the record, `:started-from:` names the verifiable thing it
  rests on (a mark in use since that year, a filing), which the page shows
  beside the year. A note whose record marks it evergreen
  (`:evergreen: true`) shows no date, since its subject has none; its
  record keeps the date it was written. The home page and the Journal
  state how far back the firm's record runs from the dates the registers
  hold (the earliest patent filing, mark in use, paper in a journal, essay
  and post), computed, never written as a literal.
- **FR-079**: A kicker (the small label above a heading, on a page head, a
  section head or a card), a badge, a meta line, a lede and a tagline MUST
  each say something the words beside them do not: a work's kind where
  the heading does not state it, a series, a journal, a subject, a status,
  a year, a fact the heading leaves out. None of them MUST repeat the
  heading, the breadcrumb trail, the section's own heading, one another, a
  fact the row or the paragraph beside them states, or the page's place
  in the site. A section of one kind of card carries no kind kicker, a
  page whose trail names what it belongs to carries none either, a status
  shown as a badge is not the meta line too, a shelf headed as an
  experiment does not badge each book again, a lede does not restate the
  number or name its heading carries, and a tagline drawn from a record's
  summary is not followed by the same summary as the first paragraph. A
  card's text says what its title and its section do not: a card in a
  section of book companions names its book and no more, a mark's card
  under a status heading starts at its classes, and a skill's card starts
  at when to use it, not that it is a skill. A heading names its subject,
  never the page or the reader's position on it: no "here", "below",
  "this page" or "this patent" where the number is known, and no empty
  heading. A link or button is named by what it reaches ("Read the
  original patent", "Visit netspective.com"), never "here" or a bare
  "Visit", and one page makes one call to the same action: two buttons to
  the same address, or a sentence that asks what the button beside it
  asks, are one too many.
- **FR-059**: The website's dynamic parts MUST use Datastar over server-
  sent events, its one script library (0014-design-systems FR-008), loaded
  on every page: the log-in MUST open as a dialog on the page and its
  steps MUST be answered as patches to that page; once logged in, the
  page's "Login" and its downloads (FR-058) MUST be patched in place; a
  book's preview pages MUST be patched into its reader (FR-056); a
  showcase's filters and search MUST be answered by the server as a patch
  of its list, and the list MUST show every item without the script; and
  on the person's own computer a page MUST be patched when its rendering
  changes. A Datastar answer MUST hold only what the page it patches may
  show.

## Addresses

- **FR-011**: A patent family's page MUST answer at `/patents/<slug>`, the
  address the previous website published, and every address the previous
  website redirected to a patent page MUST keep redirecting there
  (0024-persistent-addresses FR-002).
- **FR-012**: The website MUST NOT serve the ontology: no ontology file, and
  no page at a namespace's address, which answers like any address the
  website does not serve. The ontology is read and searched in the IF
  Console (0043-if-console). An address the website does not serve MUST
  answer with one not-found page and a not-found status (0004-addressing
  FR-007).
- **FR-013**: The generator MUST read nothing from a snapshot of the
  previous website: every register and text the previous website
  published has a permanent home that this specification names (the
  records registers, FR-074; the research records, FR-075; the archived
  posts and topics, FR-076; the website's own copy, FR-077), and a text
  carried from the previous website is this website's writing, so it
  keeps the written voice (FR-073) and git holds it as it was published.
- **FR-014**: The generator MUST report every address the previous
  website's sitemap lists that the generated website neither serves nor
  redirects, so nothing it published is dropped unnoticed. The sitemap is
  held with the website's own package (FR-077).
- **FR-068**: The addresses the fronts of FR-066 replaced MUST redirect
  permanently (FR-016): the research index to the Journal's sections, the
  toolbox and each of its items to the products front and its items, and
  the writing index to the Journal's elsewhere department. A paper's,
  pillar's and note's address MUST NOT change; a record the vault renamed
  because two records shared one slug (0017-spoken-and-research-works
  FR-026) keeps its old address as a permanent redirect, from the record's
  `:legacy-slugs:`.
- **FR-015**: Every page MUST load the analytics container the previous
  website used, the one the website's package states (FR-077), and no
  other tracking.

## Publishing and testing

- **FR-016**: The program's server MUST route every address itself: every
  page MUST answer at its address without a trailing slash; the same
  address with a trailing slash, an `index` or an `.html` ending MUST
  redirect to it; a redirect the website keeps MUST answer as a permanent
  redirect; and an address that matches no page, no file and no redirect
  MUST answer with the not-found page and a not-found status.
- **FR-017**: The program MUST serve the website on the person's own
  computer from the sources (FR-033), and the container image (FR-035)
  MUST run on the person's own computer, so what a person tests locally is
  what the destination serves.
- **FR-018**: The website MUST be published to a destination only through
  that destination's publishing command. Each destination MUST be described
  in the ontology before it is used: the vendor service that hosts it, its
  publishing strategy, the file holding its configuration, and the file
  holding its deployment record (0037-vendor-management-policy for the
  vendor). The publishing command MUST refuse a destination whose vendor
  service has no onboarding Decision.
- **FR-019**: A publish MUST make a preview, reachable only at the
  destination's own preview address, unless the person states that it is to
  be promoted to the destination's production, naming who decides and why.
  Pointing a domain the company holds at a destination is the decision
  authority's recorded Decision (0022-domain-names), and no publishing
  command does it.
- **FR-020**: A publish MUST first run the website's own check (FR-004)
  and refuse to build the image or push it when the check fails. The image
  MUST hold exactly the model and files that were checked.
- **FR-021**: Each publish MUST append to the destination's deployment
  record: when, the source commit, preview or production, the
  destination's version identifier, the preview address, the image's
  digest, a checksum over every file of the model, and for a promotion who
  decided and why. A deployment record MUST NOT hold a credential, a token
  or a signed address.
- **FR-022**: The credentials a publish needs MUST be read from the
  environment when it runs and MUST NOT be written to any file, record or
  output.
- **FR-023**: Code that runs at a destination other than the program MUST
  NOT decide what is served: the program's server routes every address
  (FR-016). The application is governed by FR-024 to FR-030.
- **FR-034**: The server's answer for an address MUST be the same on the
  person's own computer and in the image, given the same model: the same
  bytes, status and headers for a person who has not logged in. When a
  check (FR-004) refuses a changed state, the server MUST keep answering
  with the last state that passed and MUST report the problems at
  `/__eid/status`.
- **FR-035**: The website MUST be published as a container image that
  holds the program (FR-032) and the checked model (FR-001), with the
  files its pages use, published to one of the destinations FR-018
  describes: Cloudflare Containers, an AWS container service, Railway or
  Azure Container Apps. Where the host builds the image itself (Railway),
  it MUST build it from the same build context, holding exactly the checked
  model (FR-020). The image MUST
  render the website from that model into memory when it starts, MUST
  answer `/__eid/health`, and MUST hold no credential. The model MUST hold
  nothing FR-003 keeps from the website: no list of works it must not show,
  and no manuscript but the PDF of a book that offers a preview, which the
  server draws the preview from and never serves (FR-056).
- **FR-036**: The addresses under `/__eid/` are reserved to the program's
  server (FR-026). The generator MUST NOT generate a page there.
- **FR-037**: An image the website serves MUST be served in its fast web
  form: a PNG or JPEG as a WebP, and an SVG as an optimized SVG. Where a
  print, e-book, guide or retail pipeline also reads the source, the form is
  a companion kept beside the source (`name.auto.webp`; for a raster at least
  1000 pixels wide also `name.auto-960.webp` and `name.auto-480.webp`;
  `name.auto.svg`), described by the manifest `images.auto.json` of its
  directory, and `eid picture build` makes it. A companion is fresh when it
  exists and the manifest holds, for the source, the hash of the source's
  content and the version of the conversion; a companion that is missing or
  stale MUST be made again, and a fresh one MUST NOT be. Where only the
  website uses the picture (the previous website's public images), the fast
  form MUST replace the original: a WebP of at most 200 KB, made by `eid
  picture convert`, which rewrites each reference to the old address and
  deletes the original only when nothing in the vault names it any more.
  When the source is not in the vault (the public root, the vendored brand),
  the website MUST make the form when it builds and MUST NOT write beside
  the source. A pipeline's original MUST NOT be changed, and it MUST be
  served as it is when its fast form is not smaller or an optimized SVG
  fails its checks.

- **FR-038**: The content delivery network in front of the website's host
  MUST be configured by `eid cdn` from a file in the vault, as code: the zone
  settings, the tiered cache and the cache rules, each cache rule limited to
  the website's hostname. The command MUST send only what differs from the
  zone, MUST list in its plan the settings that change the whole zone, and MUST
  refuse while the hostname is undecided. It MUST change no DNS record and MUST
  NOT point any domain (FR-019). The file MUST hold no credential, only the
  name of the environment variable that holds the token. A purge of the
  website's cache MUST follow a production publish (FR-019).

- **FR-039**: The generator's check MUST fail a page that loads a stylesheet
  from another host, an image without its width and height or without alt
  text, a page of more than 150 000 bytes of HTML before compression, a page
  (other than the not-found page) without exactly one `h1`, and a home page
  whose picture is not fetched ahead of the page's own load.
- **FR-040**: Every file under `/static/` MUST carry in its address a hash
  of its content and MUST be served with a cache lifetime of one year and
  the `immutable` directive; every page MUST be served so that a cache
  asks again before it reuses it, and a page holding a logged-in person's
  own parts MUST be served private and never stored. The fonts the pages
  use MUST be served by the website itself and MUST be declared in the
  page's own head, and the analytics container (FR-015) MUST load after
  the page is usable.

- **FR-041**: A page that shows counts, candidates or figures that are
  examples MUST say so where they appear. The Network's hunts MUST label
  their counts and evidence packets "illustrative", and an illustrative
  scoreboard MUST keep its caption.
- **FR-042**: A research pillar, note or area page MUST show, for each
  section, its claim label, points, sources, table with caption and
  falsifiability list when the record holds them (FR-075). A figure or screen the
  website does not draw MUST be shown as its title and description. An area
  page MUST show its introduction, its parent area and the records filed
  under it, found by the area's name in a record's title, summary, text or
  classifications.
- **FR-043**: The Zero Security Theatre area MUST show its test, its
  attack-and-recovery scoreboard, open questions and planned outputs. Its
  registers MUST be filterable by tag, MUST show a method as an ordered list
  and MUST link each entry to its pillars.
- **FR-044**: A fund's page MUST show its size only as the register states
  it, with the register's status beside it, and MUST show every list the
  register names for that fund.
- **FR-045**: A patent family's page MUST show, for each filing, its status
  date, publication and grant dates, examiner, art unit and parent
  applications, and for the family its priority application, last event
  date, related records and the official PDF when the register has one. A
  trademark's page MUST show its registration date, first use, classes,
  USPTO status and where it is used, with the registered and trademark signs
  raised.
- **FR-046**: The What's new page MUST group its items by month and offer
  area and kind filters. A book's page MAY show a pull quote, premise,
  audience, parts, frameworks and specifications from the snapshot, but its
  status comes from the vault.
- **FR-047**: The Organization structured data MUST carry the company's
  email, address, founder and its LinkedIn page. The sitemap MUST give a
  lastmod only for a page whose record has a date. A companion page MUST list
  its section headings, and an interactive tool MUST push its prompt-copied,
  artifact-downloaded, email and LinkedIn events to the analytics data layer.

## The application

- **FR-024**: The website MUST be one site at one domain made of two parts: the
  generated pages (FR-001 to FR-023) and an application, the distribution
  platform (0046-distribution-platform), that serves what the pages cannot:
  authenticated readers' surfaces and the delivery of renditions.
- **FR-025**: The application MUST NOT alter or add to a rendered page;
  the program's server alone renders the pages (FR-033), and a page MUST
  NOT need the application in order to render.
- **FR-026**: Each address the application serves MUST be recorded as
  reserved, and so MUST each address the program's server serves (FR-036).
  The program MUST NOT render a page at a reserved address and MUST refuse
  to serve a model where one collides. Every other address MUST answer as
  FR-016 states.
- **FR-027**: Content beyond the `Public` audience MUST NOT be in any generated
  file (FR-003) and MUST reach a reader only through the application
  evaluating the request (0046-distribution-platform FR-015). A request that
  fails the evaluation MUST answer as an address the website does not serve
  (0046-distribution-platform FR-016).
- **FR-028**: The application and the program MUST be deployable in one
  container image (FR-035) to any host that runs container images.
- **FR-029**: FR-018 to FR-022 apply to deploying the application's image as
  they apply to publishing the website's image: its host is described in the
  ontology before it is used; a deploy is a preview unless a person promotes
  it, naming who decides and why; it follows the website's own check; its
  deployment record carries the image's digest; and its credentials are read
  from the environment.
- **FR-030**: The application MUST run on the person's own computer from the
  same image (0046-distribution-platform FR-011), so that FR-017's local test
  covers it.

## Data

- **FR-048**: The website's source of truth MUST be the Eidolon in Git: the
  ontology, the specs and the content (0001-eidolon-architecture FR-005). Every
  lookup a page or the server makes over that data, such as a search, a list, a
  filter or a relation between records, MUST be answered from an in-memory
  index built from those sources when the generator or the server starts and
  built again when a source changes (FR-033), not from a database.
- **FR-049**: The data a website holds MUST be held at the lowest rung of this
  ladder that holds it:
  1. the Eidolon in Git and the in-memory index of FR-048, for everything that
     is a fact of the Eidolon (0001-eidolon-architecture FR-019);
  2. an embedded SQLite database file on the volume that survives replacing the
     container (0046-distribution-platform FR-009), for application state that
     is not a fact of the Eidolon, such as a session, a grant, an entitlement,
     a purchase or an access log;
  3. a hosted libSQL database, a SQLite-compatible service, when more than one
     container or host must write the same data;
  4. a PostgreSQL server.
  The `embedded-sql` kit of ws-host installs the tools for the second and third rungs (SQLite, DuckDB, the Turso command line, `litestream` for backing up the
  SQLite file, and clients, migrations and a formatter), and `ws-host workspace ensure` installs it by default.
- **FR-050**: Starting above the second rung, or moving to a higher rung, MUST
  be a `Decision` (0008-decision-records) that names the trigger and the
  measurement that shows it. A trigger is one of: more than one container or
  host must write the same data (third rung); the data no longer fits the
  memory or disk of one host, the database must decide access row by row, a
  restore to a point in time is required that the backup of
  0046-distribution-platform FR-013 cannot give, or sustained concurrent writes
  exceed what one writer can serve (fourth rung). Convenience or familiarity
  MUST NOT be a trigger.
- **FR-051**: A database MUST NOT be the only place a fact of the Eidolon
  lives. What a database holds that derives from the Eidolon, such as a search
  index, MUST be rebuildable from the sources at any time. A generated page
  MUST NOT read a database (FR-025).
- **FR-052**: Moving between rungs MUST change an adapter and nothing else: the
  application MUST reach its database through one interface it owns
  (0046-distribution-platform FR-005), and all its data MUST be exportable in
  an open format (0046-distribution-platform FR-008). A hosted libSQL database
  and a PostgreSQL server are infrastructure under 0046-distribution-platform
  FR-037, not a vendor capability.
- **FR-053**: The application's database MUST be reachable only by the
  application and never by the path that serves the generated files
  (0033-systems-and-data-policy FR-008).

## Out of scope

- Which destination hosts the website, which container host runs first,
  the vendor onboarding of each host, and the domain cutover, which are the
  decision authority's Decisions (FR-018, FR-019).
- The rules a crawler is given (robots and AI crawler rules), which are
  the decision authority's; the generator carries the previous website's
  rules unchanged.

## Edge cases
- A book announced at Review whose PDF is not built yet: it offers no
  preview until it is, per FR-056; its PDF is confidential, per FR-057.
- A preview image saved from the browser: it is a shuffle of tiles, not a
  readable page, per FR-056. A screen capture of the reader is not
  prevented; the watermark names its source.

- A book at Review that is announced: its page shows its public record
  and "forthcoming", never its manuscript or a download, per FR-003,
  FR-008 and 0015 FR-031.
- A work at Review held from announcement: it appears nowhere on the
  website, per FR-003.
- A patent family the previous website reached under an older slug: the
  older address redirects to `/patents/<slug>`, per FR-011.
- A register moved from the snapshot into the public root: the generator
  reads it from the public root and the snapshot entry is removed, per
  FR-013.
- An essay published on the founder's own website: the website shows it
  as a reference to that address, in the Journal's elsewhere department
  and on the author's profile, per FR-009 and FR-065.
- A working paper whose record names no research area: it is listed on
  the Journal's front under the holding heading and the check reports it,
  per FR-061.
- A shared service at ideation: its card on the products front says so,
  per FR-063, and it is never shown as operating.
- A venture whose register does not state its closure condition: its card
  says the condition is not stated, per FR-064.
- A request for the old toolbox address of a skill: it redirects
  permanently to the skill's address on the products front, per FR-068.
- A research pillar's address after the merge: it answers as before,
  within the Journal's section of the website, per FR-061 and FR-068.
- A work's page served from the vault with no item in the desk export:
  the Console's "What's left" says nothing is left on the desk, and its
  guides still show, per FR-069.
- The website served where no `eid` launcher is beside it, as the
  container image serves it: no Console and no control, per FR-069 and
  FR-070.
- The desk export is older than the vault's records: the Console shows
  when it was made and the command that refreshes it, per FR-069.
- A person hides the Console on one page and opens another: it stays
  hidden, per FR-070.
- A front whose pages report nothing: its Console's roll-up says every
  page is clear and its guides show, per FR-069.
- A guide's step on a front: its command is the line a person types, with
  the controls that copy it and run it on this computer, per FR-069.
- A step that is a decision, such as advancing a work: its line is shown
  to copy and no control runs it, per FR-069.
- A record command run from the Console: it runs as a dry run first and
  shows what it would change; a second request runs it for real, per
  FR-069.
- A line posted to the run address where no launcher is beside the
  website, the container host among them: it answers not found, per
  FR-069.
- The program started the container's way, from an exported model, beside
  a vault clone with its launcher on the person's computer: the pages carry
  the placeholder and the control, the Console is read from the vault at
  the request, and the works tree stays as the destination serves it, per
  FR-069 and FR-058.
- A work at Intake, not yet announced, on the Console's roll-up of a
  front: the Console names it, since it is rendered at the request on the
  editor's computer and is part of no page; the page itself does not, per
  FR-069 and FR-003.
- A request for a namespace address such as `/ontology/core`: it answers
  with the not-found page, and the ontology is read in the IF Console, per
  FR-012.
- A publish whose check fails: nothing is uploaded, per FR-020.
- A publish with no promotion stated: only a preview is made, and the
  domain keeps serving what it served, per FR-019.
- A request for a page of a person who has logged in: the cached page with
  that person's own parts added, served private, per FR-033 and FR-040.
- A source changes and the rendering of its page does not: the pages that
  depend on that page are not rendered again, per FR-033.
- A changed source makes the check fail while a server is running: the server
  keeps answering with the last state that passed and reports the problems at
  `/__eid/status`, per FR-034.
- A destination whose vendor service has no onboarding Decision: the
  publishing command refuses it, per FR-018.
- A browser without the script: every page reads in full and every list
  shows every item; filtering and the log-in dialog need the script, and the
  log-in still works as its own page, per FR-059 and FR-058.
- The application is down: the program's server still answers every public
  address, per FR-025.
- An anonymous request for an address that holds a private rendition: it
  answers as an address the website does not serve, per FR-027.
- A new surface of the application needs an address a generated page already
  uses: the generator refuses to write the website until the collision is
  resolved, per FR-026.
- A generated page needs to show that a reader is signed in: it cannot, since
  the application does not alter a generated page at request time, per
  FR-025.
- A page lists works by series or searches them: it is answered from the
  in-memory index, per FR-048.
- A reader's purchase is recorded: it is application state in the embedded
  database on the volume, not an ontology individual, per FR-049.
- A hosted libSQL database is proposed for a single container: refused, since
  the second rung holds the data, per FR-050.
- The application's search index is deleted: it is built again from the
  sources, per FR-051.
- A generated page needs a count from the application's database: it cannot,
  since a generated page does not read a database, per FR-051 and FR-025.
- The ontology no longer fits in the memory of one host: the fourth rung needs
  a `Decision` that names the measurement, per FR-050.
- The application moves from the embedded file to a hosted libSQL database:
  only its adapter changes and its data is exported and read back, per FR-052.

## Assumptions

- The previous website published only what the company had decided to
  make public, so its snapshot may be treated as Public (FR-013).
- Every host the application may run on offers a container runtime.
- A container host can run an image that renders the website into memory and
  answers a health address, so FR-035 needs no other service of the host.
- The Eidolon's ontology, specs and content fit in the memory of one host. If
  they stop fitting, the fourth-rung trigger of FR-050 applies.
- The application writes from one container at first, so one database file with
  one writer is enough until a trigger of FR-050 is met.

## Open questions

- **OQ-1**: When each register held in the snapshot moves into the public
  root's ontology and content, under which content kind, and whether the
  snapshot's own files then move into the public root, is not stated
  (0013-web-content-kinds OQ-1, OQ-2).
- **OQ-2**: Whether addresses the previous website published other than
  patent pages keep answering, beyond what 0024-persistent-addresses
  FR-001 counts as published, is not stated.
- **OQ-3**: Which addresses the application reserves beyond FR-036's, and how
  an anonymous visitor reaches its sign-in surface from a generated page, is
  not decided.
- **OQ-4**: How the website shows a reader that they are signed in, given
  FR-025, is not decided.
- **OQ-5**: Whether the distribution platform (0046-distribution-platform)
  ships in the website's image from the first publication or in a separate
  image is not decided.
- **OQ-6**: What `/__eid/status` shows at a container host, so that it never
  names a work that is neither Public nor announced (FR-003), is not decided.
- **OQ-7**: Which container host runs first, Cloudflare Containers, an AWS
  container service, Railway or Azure Container Apps, and the vendor
  onboarding Decision of each, are not decided; all are the decision
  authority's.
- **OQ-8**: How a consistent copy of the embedded database file is taken and
  restored for the backup test of 0046-distribution-platform FR-013 is not
  decided.
- **OQ-9**: Whether the in-memory index of FR-048 is queried with in-process
  SPARQL or with lookups written for each page is not decided.
- **OQ-11**: Whether a preview is shown only to a reader who signs in,
  and whether encrypted media (a DRM licence server) protects it against
  screen capture, is not decided; both need the application (FR-024).
- **OQ-12**: Whether a skill's address moves to the products front with a
  redirect from the toolbox address (FR-068), or the toolbox addresses
  stay as the skills' own, is not decided.
- **OQ-13**: The ventures register in the snapshot (FR-013) does not hold
  a venture's entity, operator, rights position or closure condition; until
  the register moves into the public root with them, a venture's card says
  they are not stated, per FR-064.
- **OQ-14**: Whether the ventures front, once software and services have
  left it, shows funds as its own showcase or under each venture they back
  is not decided.
- **OQ-15**: Whether a page of the vault's whole desk is served at a
  reserved address, beyond the home page's roll-up (FR-069), is not
  decided.
- **OQ-16**: Whether the desk export is made again while the website is
  served and the vault changes, or only when the person runs its command,
  is not decided; the vault's command line decides it.

## Key entities

- **The public website** — www.intellectualfrontiers.com, its pages
  rendered on the server from the Eidolon's website model, and an application
  beside them.
- **`eid-site`** — the Rust program that renders, serves and publishes the
  website (FR-032).
- **The website's model** — what the website may show, read from the vault
  and the public root and kept in the image (FR-001, FR-035).
- **A source graph** — for one cached page, the records, documents, files and
  pages its rendering read; the page is rendered again only when one of them
  changes (FR-033).
- **The image** — the container image that holds `eid-site` and the checked
  model, published to Cloudflare Containers, AWS, Railway or Azure Container
  Apps and run on the person's own computer for local verification
  (FR-035).
- **The application** — the distribution platform
  (0046-distribution-platform), which serves what the generated pages cannot.
- **A reserved address** — an address the application serves, which no
  generated page may use.
- **A showcase** — the index of one kind of work, presenting each item
  with its image, record and status.
- **The products front** — every intellectual product a reader can use:
  the Public skills, book companions and interactive tools, the software,
  the shared services, and the datasets, methods and landscape studies,
  each with its stage.
- **The Journal's front** — the website's one front for the firm's
  research: the current issue, the sections by research area, the
  departments as labels, the register of positions, the corrections page
  and the masthead.
- **A front** — one of the six items of the navigation, each a showcase
  of one kind of work or the Journal.
- **The Console** — the band shown only on the person's own computer,
  read from the vault's desk export: "What's left", what is left to do for
  a work or across a front, and "Starting something new", the guides for
  the work's or the front's kind.
- **A snapshot** — the previous website's published data, fixed, held in the
  vault until each register moves into the public root.
- **A publishing destination** — a container host the website's image is
  published to through one command, described in the ontology by its vendor service,
  strategy, configuration file and deployment record.
- **A deployment record** — the destination's file of every publish made
  to it.
- **The data ladder** — the four rungs a website's data is held at, lowest
  first: Git and the in-memory index, an embedded SQLite file, a hosted libSQL
  database, a PostgreSQL server (FR-049).
- **A trigger** — the measured condition that justifies a higher rung, named in
  the `Decision` that moves to it (FR-050).

## Success criteria

- **SC-001**: No generated file names a work that is neither Public nor
  announced, or shows a fact outside an announced work's public record.
- **SC-002**: No unit is the principal subject of any page but the one
  page about the company.
- **SC-003**: Every patent address the previous website published answers
  with the family's page or a permanent redirect to it.
- **SC-004**: Every address the previous website's sitemap lists is
  served, redirected, or named in the generator's report.
- **SC-005**: No generated file is an ontology file, and every namespace
  address answers not found.
- **SC-006**: Every publish is in its destination's deployment record, and
  every production publish names who decided and why.
- **SC-007**: No page is rendered again for a request, and no reserved
  address is also a page.
- **SC-008**: The server routes every address as FR-016 states.
- **SC-009**: For every address, the image and the person's own computer
  answer a person who has not logged in alike, given the same model.
- **SC-010**: After a source changes, no page whose source graph does not
  contain it is rendered again, and no page depending on a page whose
  rendering did not change is rendered again.
- **SC-011**: The image run on the person's own computer answers every
  address as the image at a container host does.
- **SC-012**: No generated page reads a database, and no database holds the
  only copy of an Eidolon fact.
- **SC-013**: Every database above the second rung has a `Decision` that names
  its trigger and the measurement.
- **SC-014**: Every page's navigation lists the six fronts and no other,
  and every replaced address redirects permanently to its front.
- **SC-015**: No research paper, pillar or note is reachable only from
  outside the Journal's front, and none changed its address in the merge.
- **SC-016**: No product is shown without its stage, and no shared service
  is labeled an AI Workforce that its record does not call one.
- **SC-017**: No model, no file of a model and no published page carries
  the Console, its control or the desk export.
- **SC-018**: No decision or setup command runs from a page, no line runs
  through a shell, and no line runs anywhere but on the person's own
  computer.

## Review & acceptance checklist

- [x] Every requirement is testable (MUST / MUST NOT), not aspirational
- [x] Only the mechanics the decision authority chose are named (the
      program's language, the container hosts, the data ladder's engines); the
      rest belongs to an implementation plan
- [x] Every open item is marked, not silently decided
- [x] Public-safe: no confidential information, no unverified number stated
      as settled fact

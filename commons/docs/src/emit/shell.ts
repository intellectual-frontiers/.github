// Spec: 0001-docs FR-036, FR-037, FR-040
/**
 * The chrome of a page, written as the documentation theme of Fumadocs writes it (MIT, Copyright (c) 2023 Fuma; its `spacious` layout, as its own documentation shows it on the day recorded in
 * `src/theme/fumadocs.provenance.json`): the grid, the side navigation with the name of the site and the selector of the sections, the search, the panel with its header and its outline, the
 * drawer and the popover of narrow screens, and the search dialog. The classes are the reference's, character for character, because the stylesheet `fumadocs.css` is what Tailwind CSS makes of
 * exactly the classes the pages use (FR-036); a change of a class here is a change of the look. Nothing here reads the site's model: the HTML writer passes what the chrome shows.
 *
 * @module
 */
import { GITHUB_PATH, ICONS, type IconName } from "./icons.ts";
import { escape } from "./util.ts";

/** An icon of the Lucide set, drawn in the page (the classes after `lucide` are the caller's). */
export function icon(name: IconName, classes = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${name}${classes === "" ? "" : ` ${classes}`}" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** The mark of GitHub, as a link's icon. */
const githubIcon = `<svg role="img" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${GITHUB_PATH}"/></svg>`;

/** The classes of the reference's buttons. */
export const BUTTON = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring";
const GHOST = `${BUTTON} hover:bg-fd-accent hover:text-fd-accent-foreground`;

/** A node of the side navigation. */
export type NavNode =
  | { readonly kind: "heading"; readonly title: string }
  | { readonly kind: "link"; readonly title: string; readonly href: string; readonly current: boolean; readonly open: boolean; readonly children: readonly NavNode[] }
  | { readonly kind: "folder"; readonly title: string; readonly open: boolean; readonly children: readonly NavNode[] };

/** One entry of the outline of a page. */
export interface TocItem {
  readonly id: string;
  readonly text: string;
  readonly level: number;
}

/** A section the selector offers. */
export interface SectionChoice {
  readonly label: string;
  readonly href: string;
  readonly current: boolean;
}

const ITEM = "relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start wrap-anywhere outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-fd-ring [&_svg]:size-4 [&_svg]:shrink-0";
const ITEM_ACTIVE = "bg-fd-primary/10 text-fd-primary";
const ITEM_IDLE = "text-fd-muted-foreground hover:text-fd-accent-foreground";
const FOLDER_ICON = "[&>[data-icon]]:size-3.5";
const CHEVRON = (open: boolean): string => icon("chevron-down", `ms-auto transition-transform${open ? "" : " -rotate-90 rtl:rotate-90"}`).replace("aria-hidden=\"true\"", "aria-hidden=\"true\" data-icon=\"true\"");

function navNode(n: NavNode): string {
  switch (n.kind) {
    case "heading":
      return `<p class="inline-flex items-center gap-2 mt-6 empty:mb-0 first:mt-0 mb-1.5 px-2.5 text-xs font-medium text-fd-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">${escape(n.title)}</p>`;
    case "link": {
      const state = n.current ? ` data-active="true" aria-current="page"` : ` data-active="false"`;
      const cls = `${ITEM} ${n.current ? ITEM_ACTIVE : ITEM_IDLE}`;
      if (n.children.length === 0) return `<a${state} href="${escape(n.href)}" class="${cls}">${escape(n.title)}</a>`;
      return `<div data-${n.open ? "open" : "closed"}=""><a${state} href="${escape(n.href)}" class="${cls} ${FOLDER_ICON}">${escape(n.title)}${CHEVRON(n.open)}</a>${panel(n.children, n.open)}</div>`;
    }
    case "folder":
      return `<div data-${n.open ? "open" : "closed"}=""><button type="button" aria-expanded="${n.open}" class="${ITEM} ${ITEM_IDLE} ${FOLDER_ICON}">${escape(n.title)}${CHEVRON(n.open)}</button>${panel(n.children, n.open)}</div>`;
  }
}

/** The children of a folder, with the rule that runs down their left. */
function panel(children: readonly NavNode[], open: boolean): string {
  return `<div${open ? ` data-open=""` : " hidden"} class="overflow-hidden relative flex flex-col ms-3 ps-1"><span class="absolute start-0 inset-y-1 w-px bg-fd-border"></span>${children.map(navNode).join("")}</div>`;
}

/** The scrolling list of the side navigation, with the lozenge that follows the pointer. */
function navList(nodes: readonly NavNode[]): string {
  return `<div role="presentation" class="relative flex flex-col"><div aria-hidden="true" class="absolute top-0 left-0 py-0.5 rounded-lg bg-fd-accent/60 bg-clip-content opacity-0 pointer-events-none transition-opacity duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:transition-[translate,width,height,opacity]"></div><div class="flex flex-col">${nodes.map(navNode).join("")}</div></div>`;
}

/** The selector of the sections (the reference's selector of root folders). */
function selector(sections: readonly SectionChoice[]): string {
  const now = sections.find((s) => s.current) ?? sections[0];
  const items = sections.map((s) =>
    `<a role="menuitem" href="${escape(s.href)}" class="flex w-full min-h-9 items-center gap-3 rounded-lg px-2.5 py-1.5 text-start outline-hidden transition-colors duration-100 hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0${s.current ? " text-fd-primary" : ""}"><span class="flex-1">${escape(s.label)}</span>${s.current ? icon("check") : ""}</a>`
  ).join("");
  return `<div class="flex flex-col rounded-xl border bg-fd-secondary/50 overflow-clip" data-sections><button type="button" tabindex="0" aria-haspopup="menu" aria-expanded="false" class="flex w-full h-10 items-center gap-3 ps-[calc(--spacing(2.5)-1px)] pe-2.5 text-start font-medium outline-hidden transition-colors hover:bg-fd-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring data-popup-open:bg-fd-accent [&_svg]:size-4 [&_svg]:shrink-0"><span class="flex-1 truncate">${escape(now?.label ?? "")}</span>${icon("chevrons-up-down", "size-3.5! text-fd-muted-foreground")}</button><div role="menu" hidden data-sections-menu class="flex flex-col max-h-(--available-height) overflow-y-auto rounded-2xl border bg-fd-popover text-sm text-fd-popover-foreground shadow-lg outline-hidden w-64 fixed z-50"><div class="flex flex-col p-1">${items}</div></div></div>`;
}

/** The button that opens the search, in the side navigation. */
const SEARCH_BUTTON = `<button type="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" data-search-full="" class="inline-flex items-center border bg-fd-secondary/50 p-1.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground h-10 gap-3 rounded-xl ps-[calc(--spacing(2.5)-1px)] pe-2 [&_svg]:shrink-0">${icon("search", "size-4")}Search<div class="ms-auto inline-flex gap-0.5"><kbd class="rounded-md border bg-fd-background px-1.5" data-mod>Ctrl</kbd><kbd class="rounded-md border bg-fd-background px-1.5">K</kbd></div></button>`;

/** The control of the theme: the reference's toggle, with the sun lit in the light theme and the moon in the dark (by the `dark` variant, so that no script sets its state). */
export const THEME_TOGGLE = `<button class="inline-flex items-center rounded-full border overflow-hidden *:rounded-full p-0" aria-label="Toggle Theme" title="Theme (t)" data-theme-toggle="">${
  icon("sun", "size-6.5 p-1.5 bg-fd-accent text-fd-accent-foreground dark:bg-transparent dark:text-fd-muted-foreground").replace('fill="none"', 'fill="currentColor"')
}${icon("moon", "size-6.5 p-1.5 text-fd-muted-foreground dark:bg-fd-accent dark:text-fd-accent-foreground").replace('fill="none"', 'fill="currentColor"')}</button>`;

/** The control of the width of the layout (FR-040), drawn like the toggle of the theme: the corners drawn in lit in the width of the reference, the corners drawn out lit in the full width (by the attribute the head's script sets on the page). */
export const WIDTH_TOGGLE = `<button type="button" class="inline-flex items-center rounded-full border overflow-hidden *:rounded-full p-0" aria-label="Full width" aria-pressed="false" title="Width (w)" data-width-toggle="">${
  icon("minimize", "size-6.5 p-1.5 bg-fd-accent text-fd-accent-foreground in-data-[width=full]:bg-transparent in-data-[width=full]:text-fd-muted-foreground")
}${icon("maximize", "size-6.5 p-1.5 text-fd-muted-foreground in-data-[width=full]:bg-fd-accent in-data-[width=full]:text-fd-accent-foreground")}</button>`;

/** The link to the repository. */
function github(url: string, classes: string): string {
  return `<a href="${escape(url)}" rel="noreferrer noopener" target="_blank" aria-label="github" data-active="false" class="${GHOST} p-1.5 [&_svg]:size-4.5 ${classes}">${githubIcon}</a>`;
}

/** The outline, as the reference writes it: its links indent by 12 pixels a level, and a band behind the links being read follows the reader. */
export function outlineLinks(toc: readonly TocItem[]): string {
  const link = (t: TocItem): string =>
    `<a data-active="false" href="#${escape(t.id)}" class="group prose relative py-1 pe-2 text-[0.8125rem]/5 scroll-m-4 text-fd-muted-foreground hover:text-fd-accent-foreground transition-colors wrap-anywhere data-[active=true]:text-fd-primary" style="padding-inline-start:${8 + Math.max(0, t.level - 2) * 12}px">${escape(t.text)}</a>`;
  return `<div class="relative flex flex-col"><div class="absolute inset-0 bg-linear-to-r from-fd-primary/10 [clip-path:inset(0_0_100%)] data-ready:transition-[clip-path] duration-300 ease-out"></div>${toc.map(link).join("")}</div>`;
}

const OUTLINE_SCROLLER = "relative min-h-0 text-sm overflow-x-clip overflow-y-auto overscroll-contain [scrollbar-width:none] mask-[linear-gradient(to_bottom,transparent,white_16px,white_calc(100%-16px),transparent)] py-3";

/** The parts of a page the chrome wraps. */
export interface ShellParts {
  /** The name of the site and its version, in the side navigation. */
  readonly name: string;
  /** The version's markup, or none. */
  readonly version: string;
  /** The address of the first page and of the repository. */
  readonly home: string;
  readonly repository: string;
  readonly sections: readonly SectionChoice[];
  readonly nav: readonly NavNode[];
  readonly toc: readonly TocItem[];
  /** The article: its title, description and body, the footer links and the neighbours. */
  readonly article: string;
  /** The title the header shows when the outline is out of sight. */
  readonly pageTitle: string;
}

/** The grid of the page and everything in it. */
export function shell(p: ShellParts): string {
  const hasToc = p.toc.length >= 2;
  const brand = `<a class="inline-flex items-center gap-2 min-w-0 me-auto text-[0.9375rem] font-semibold" href="${escape(p.home)}"><span class="font-medium">${escape(p.name)}${p.version}</span></a>`;
  const sidebar = `<aside id="nd-sidebar" data-collapsed="false" class="[grid-area:sidebar] flex min-h-0 overflow-clip text-sm md:layout:[--fd-sidebar-width:268px] max-md:hidden"><div class="flex flex-col shrink-0 w-(--fd-sidebar-width) transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"><div class="flex items-center gap-2 h-(--fd-header-height) my-2 ps-5.5 pe-3">${brand}<button type="button" aria-label="Collapse Sidebar" aria-controls="nd-sidebar" aria-expanded="true" data-collapsed="false" class="${GHOST} p-1.5 [&_svg]:size-4.5 size-8 text-fd-muted-foreground">${icon("panel-left")}</button></div><div class="flex flex-col gap-2 px-3 empty:hidden">${selector(p.sections)}${SEARCH_BUTTON}</div><div role="presentation" class="min-h-0 flex-1 mt-2"><nav aria-label="${escape(p.sections.find((s) => s.current)?.label ?? "Pages")}" data-nav tabindex="-1" class="size-full overscroll-contain px-3 pt-4 pb-8 mask-t-from-[calc(100%-16px)] mask-b-from-[calc(100%-32px)] base-ui-disable-scrollbar overflow-y-auto">${navList(p.nav)}</nav></div></div></aside>`;
  const subnav = `<header id="nd-subnav" class="sticky top-(--fd-banner-height,0px) z-30 [grid-area:header] flex items-center gap-2.5 h-(--fd-header-height) ps-4 pe-2.5 bg-fd-card md:hidden"><a href="${escape(p.home)}" class="inline-flex items-center font-semibold"><span>${escape(p.name)}${p.version}</span></a><div class="flex-1"></div><button type="button" aria-haspopup="dialog" aria-expanded="false" data-search="" aria-label="Open Search" class="${BUTTON} hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4.5 p-2">${icon("search")}</button><button type="button" aria-label="Open Sidebar" aria-expanded="false" aria-controls="nd-sidebar-mobile" data-drawer-open class="${BUTTON} hover:bg-fd-accent hover:text-fd-accent-foreground p-1.5 [&_svg]:size-4.5 p-2">${icon("panel-left")}</button></header>`;
  const popover = hasToc
    ? `<div class="sticky top-[calc(var(--fd-banner-height,0px)+var(--fd-header-height))] z-30 [grid-area:toc-popover] self-start md:hidden"><div class="max-md:layout:[--fd-toc-popover-height:--spacing(10)]" data-closed="" data-toc-popover><header role="none" class="bg-fd-card"><button type="button" tabindex="0" aria-expanded="false" class="flex w-full h-10 items-center gap-2.5 px-4 text-start text-sm text-fd-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring">${icon("text-align-start", "size-4.5 shrink-0")}<span class="flex min-w-0 overflow-hidden flex-1 transition-colors"><span class="truncate" data-toc-current>${escape(p.toc[0]?.text ?? "")}</span></span>${icon("chevron-down", "size-4 shrink-0 mx-0.5 transition-transform")}</button><div hidden class="overflow-hidden"><div class="flex flex-col px-4 max-h-[50vh]"><div class="${OUTLINE_SCROLLER}">${outlineLinks(p.toc)}</div></div></div></header></div><div class="absolute inset-x-2 top-full h-[calc(var(--fd-layout-height)-var(--fd-header-height)-100%)] rounded-t-2xl border-x border-t outline-8 outline-fd-card [clip-path:inset(0_-8px_-8px)] bg-origin-border bg-linear-to-b from-fd-background to-transparent to-[16px] pointer-events-none"></div></div>`
    : "";
  const header = `<header class="absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 h-(--fd-header-height) ps-6 pe-4 bg-linear-to-b from-fd-background to-transparent pointer-events-none *:pointer-events-auto max-md:hidden from-50%"><div class="flex items-center gap-1.5 min-w-0 transition-[opacity,visibility] duration-300 motion-reduce:transition-none invisible opacity-0 @max-5xl:visible @max-5xl:opacity-100 @max-5xl:transition-none">${
    hasToc
      ? `<button type="button" tabindex="0" aria-haspopup="dialog" aria-expanded="false" data-outline-open class="flex items-center gap-2 min-w-0 h-8 px-1.5 -mx-1.5 rounded-lg text-start text-sm transition-colors text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-accent-foreground">${icon("text-align-start", "size-4 shrink-0")}<span class="flex min-w-0 overflow-hidden text-fd-foreground"><span class="truncate" data-toc-current>${escape(p.pageTitle)}</span></span>${icon("chevron-down", "size-3.5 shrink-0 transition-transform")}</button>`
      : ""
  }</div><div class="flex items-center gap-1.5 rounded-lg bg-fd-background ms-auto">${WIDTH_TOGGLE}${THEME_TOGGLE}${github(p.repository, "text-fd-muted-foreground")}</div></header>`;
  const toc = hasToc
    ? `<div id="nd-toc" class="sticky top-0 flex flex-col shrink-0 w-(--fd-toc-width) h-full ps-16 pt-8 pb-4 overflow-clip *:min-w-[calc(var(--fd-toc-width)---spacing(16))] layout:[--fd-toc-width:--spacing(76)] transition-[width,padding,opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none max-md:hidden @max-5xl:invisible @max-5xl:w-0 @max-5xl:ps-0 @max-5xl:opacity-0 @max-5xl:transition-none"><h3 class="inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground">${icon("text-align-start", "size-4")}On this page</h3><div class="${OUTLINE_SCROLLER}" data-outline>${outlineLinks(p.toc)}</div></div>`
    : "";
  return `<div id="fd-spacious-layout" class="relative grid min-h-(--fd-layout-height) bg-fd-card transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none [--fd-layout-height:calc(100dvh-var(--fd-banner-height,0px))] [--fd-header-height:--spacing(14)] [--fd-page-width:760px] [--fd-sidebar-width:0px] [--fd-sidebar-col:var(--fd-sidebar-width)] [--fd-toc-width:0px] max-md:[--fd-docs-row-3:calc(var(--fd-banner-height,0px)+var(--fd-header-height)+var(--fd-toc-popover-height,0px))] md:h-(--fd-layout-height) md:overflow-clip print:h-auto print:overflow-visible" style="grid-template:&quot;sidebar header right&quot; auto &quot;sidebar toc-popover right&quot; var(--fd-toc-popover-height, 0px) &quot;sidebar main right&quot; 1fr / var(--fd-sidebar-col) minmax(0, 1fr) auto"><a href="#nd-page" class="inline-flex items-center justify-center p-2 text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground fixed top-2 start-2 z-50 rounded-lg px-3 shadow-lg not-focus-visible:sr-only">Skip to Content</a>${sidebar}${subnav}${popover}<main id="nd-page-panel" class="@container relative flex flex-col min-w-0 min-h-0 [grid-area:main] mx-2 bg-fd-background md:ms-0 md:my-2 md:overflow-clip md:rounded-2xl md:border md:shadow-sm print:overflow-visible">${header}<div class="flex flex-1 items-start px-4 md:min-h-0 md:pt-(--fd-header-height) md:px-[max(--spacing(6),calc((100%-var(--fd-page-width)-var(--fd-toc-width))/2))] md:overflow-y-auto md:overscroll-y-contain md:scrollbar-thin md:scrollbar-gutter-stable md:[--fd-docs-height:calc(var(--fd-layout-height)-var(--spacing)*4-2px-var(--fd-header-height))]" data-scroller>${p.article}${toc}</div></main></div>`;
}

/** The search dialog and its overlay (the reference's dialog; its results are written by the script in the same classes). */
export const SEARCH_DIALOG = `<div data-search-overlay hidden class="fixed inset-0 z-50 backdrop-blur-xs bg-fd-overlay" style="user-select:none"></div><div id="fd-search-dialog-content" role="dialog" aria-modal="true" aria-label="Search" tabindex="-1" hidden class="fixed left-1/2 top-4 md:top-[calc(50%-250px)] z-50 w-[calc(100%-1rem)] max-w-screen-sm -translate-x-1/2 rounded-xl border bg-fd-popover text-fd-popover-foreground shadow-2xl overflow-hidden focus-visible:outline-hidden *:not-first:border-t *:data-[empty=true]:border-t-0"><div class="flex flex-row items-center gap-2 p-3">${icon("search", "size-5 text-fd-muted-foreground")}<input data-fd-search-dialog-input="" role="combobox" aria-expanded="true" aria-label="Search" aria-autocomplete="list" aria-controls="fd-search-list" placeholder="Search" autocomplete="off" class="w-0 flex-1 bg-transparent text-lg placeholder:text-fd-muted-foreground focus-visible:outline-hidden"><button type="button" data-search-close class="inline-flex items-center justify-center rounded-md p-2 font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring border hover:bg-fd-accent hover:text-fd-accent-foreground gap-1 px-2 py-1.5 text-xs font-mono text-fd-muted-foreground">ESC<span class="sr-only">Close Search</span></button></div><div data-empty="true" class="overflow-hidden"><p role="status" class="truncate text-sm not-empty:p-3 not-empty:border-b"></p><div id="fd-search-list" class="w-full flex flex-col overflow-y-auto max-h-[460px] p-1" role="listbox" aria-label="Search"></div></div><div class="bg-fd-secondary/50 p-3 empty:hidden flex flex-row flex-wrap gap-2 items-center"><label class="text-xs text-fd-muted-foreground/80 me-2" for="fd-search-kind">Filter</label><select id="fd-search-kind" data-search-kind class="inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors duration-100 hover:bg-fd-accent hover:text-fd-accent-foreground gap-1 px-2 py-1.5 text-xs -m-1.5 me-auto bg-transparent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring"><option value="">All</option></select></div></div>`;

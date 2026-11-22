// The one script of commons' documentation (commons 0011-documentation FR-017, FR-034; docs 0001-docs FR-037, FR-040): the theme and the width of the layout (kept in
// this browser: the theme in its storage and the width in the cookie `ifc-docs-width`), the side navigation (its folders, its collapse, the lozenge that follows the pointer, the selector of
// the sections) and the drawer of narrow screens, the outline that follows the reader, tabs, copy buttons, the search ("/" or Ctrl K opens it, "t" switches the theme, "w" the width, "[" and "]"
// go to the previous and the next page; search.json is a file of the site), a filter above a table, and a click on a diagram to see it at full size. The classes in the strings below are the
// Fumadocs documentation theme's, which the stylesheet carries (docs 0001-docs FR-036).
(() => {
  "use strict";
  const doc = document.documentElement;
  const root = doc.dataset.root || "";
  const $ = (selector, from = document) => from.querySelector(selector);
  const $$ = (selector, from = document) => [...from.querySelectorAll(selector)];
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");

  // the theme: the reader's choice is kept in this browser's storage; until they choose, the system decides (the head's script has already set the class)
  const toggleTheme = () => {
    const dark = !doc.classList.contains("dark");
    doc.classList.toggle("dark", dark);
    doc.style.colorScheme = dark ? "dark" : "light";
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // storage may be unavailable: the choice then lasts for this page only
    }
  };
  for (const b of $$("[data-theme-toggle]")) b.addEventListener("click", toggleTheme);

  // the width (docs 0001-docs FR-040): the reference's, or the full width of the screen; the choice is a cookie of the site, which the head's script reads before the page is drawn
  const base = () => new URL(root || "./", location.href).pathname;
  const setWidth = (full) => {
    if (full) doc.dataset.width = "full";
    else delete doc.dataset.width;
    for (const b of $$("[data-width-toggle]")) {
      b.setAttribute("aria-pressed", String(full));
      b.setAttribute("aria-label", full ? "Reference width" : "Full width");
    }
    try {
      document.cookie = `ifc-docs-width=${full ? "full" : "default"}; Path=${base()}; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {
      // cookies may be blocked: the choice then lasts for this page only
    }
  };
  const toggleWidth = () => setWidth(doc.dataset.width !== "full");
  for (const b of $$("[data-width-toggle]")) {
    b.setAttribute("aria-pressed", String(doc.dataset.width === "full"));
    b.setAttribute("aria-label", doc.dataset.width === "full" ? "Reference width" : "Full width");
    b.addEventListener("click", toggleWidth);
  }

  // the key that opens the search is Ctrl K, and Command K on a Mac
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  for (const k of $$("[data-mod]")) k.textContent = mac ? "⌘" : "Ctrl";

  // a filter above a table: the rows whose text has every word typed stay, the others are hidden
  for (const box of $$("[data-table-filter]")) {
    const rows = [...(box.nextElementSibling?.querySelectorAll("tbody tr") ?? [])];
    box.addEventListener("input", () => {
      const words = box.value.toLowerCase().split(/\s+/).filter(Boolean);
      for (const row of rows) row.hidden = !words.every((w) => row.textContent.toLowerCase().includes(w));
    });
  }

  // tabs
  for (const tabs of $$("[data-tabs]")) {
    const buttons = $$('[role="tab"]', tabs).filter((b) => b.closest("[data-tabs]") === tabs);
    const panels = $$('[role="tabpanel"]', tabs).filter((p) => p.closest("[data-tabs]") === tabs);
    const select = (i, focus) => {
      buttons.forEach((b, j) => {
        b.setAttribute("aria-selected", String(i === j));
        b.tabIndex = i === j ? 0 : -1;
        if (i === j) b.setAttribute("data-active", "");
        else b.removeAttribute("data-active");
      });
      panels.forEach((p, j) => (p.hidden = i !== j));
      if (focus) buttons[i].focus();
    };
    buttons.forEach((b, i) => {
      b.addEventListener("click", () => select(i, false));
      b.addEventListener("keydown", (e) => {
        const to = e.key === "ArrowRight" ? (i + 1) % buttons.length : e.key === "ArrowLeft" ? (i + buttons.length - 1) % buttons.length : e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : -1;
        if (to >= 0) {
          e.preventDefault();
          select(to, true);
        }
      });
    });
  }

  // copy buttons: of a code block, of a heading's link and of the page's
  const flash = (button, done) => {
    button.setAttribute("data-checked", "");
    setTimeout(() => button.removeAttribute("data-checked"), 1500);
    return done;
  };
  const copy = async (text, button) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(button);
    } catch {
      // no clipboard: the text stays to be selected
    }
  };
  for (const b of $$("[data-copy]")) b.addEventListener("click", () => void copy($("code", b.closest("figure"))?.textContent ?? "", b));
  for (const b of $$("[data-anchor]")) b.addEventListener("click", () => void copy(`${location.origin}${location.pathname}#${b.closest("h2,h3,h4")?.id ?? ""}`, b));
  for (const b of $$("[data-copy-link]")) b.addEventListener("click", () => void copy(location.href.replace(/#.*$/, ""), b));

  // the side navigation: its folders open and close (the chevron of a page's folder toggles it, its name goes to the page)
  const toggleFolder = (holder, open) => {
    const trigger = holder.firstElementChild;
    const panel = trigger?.nextElementSibling;
    if (!panel) return;
    panel.hidden = !open;
    holder.removeAttribute(open ? "data-closed" : "data-open");
    holder.setAttribute(open ? "data-open" : "data-closed", "");
    trigger.setAttribute?.("aria-expanded", String(open));
    $("svg[data-icon]", trigger)?.classList.toggle("-rotate-90", !open);
  };
  for (const nav of $$("[data-nav]")) {
    nav.addEventListener("click", (e) => {
      const holder = e.target.closest("[data-open], [data-closed]");
      if (!holder || !nav.contains(holder)) return;
      const trigger = holder.firstElementChild;
      const onChevron = e.target.closest("svg[data-icon]") !== null;
      if (trigger?.tagName === "BUTTON" || (trigger?.tagName === "A" && onChevron && trigger.contains(e.target))) {
        e.preventDefault();
        toggleFolder(holder, holder.hasAttribute("data-closed"));
      }
    });
    // the lozenge behind the item under the pointer
    const lozenge = $("[aria-hidden='true'].absolute", nav);
    if (lozenge) {
      nav.addEventListener("pointerover", (e) => {
        const item = e.target.closest("a, button");
        if (!item || !nav.contains(item) || item.dataset.active === "true") {
          lozenge.style.opacity = "0";
          return;
        }
        const r = item.getBoundingClientRect();
        const c = lozenge.parentElement.getBoundingClientRect();
        lozenge.style.translate = `0 ${r.top - c.top - 2}px`;
        lozenge.style.width = `${r.width}px`;
        lozenge.style.height = `${r.height + 4}px`;
        lozenge.style.opacity = "1";
      });
      nav.addEventListener("pointerleave", () => (lozenge.style.opacity = "0"));
    }
  }
  // the page being read is in view in the side navigation
  $("#nd-sidebar [data-active='true']")?.scrollIntoView({ block: "center" });

  // the collapse of the side navigation, and the button that brings it back
  const layout = $("#fd-spacious-layout");
  const sidebar = $("#nd-sidebar");
  const collapse = (shut) => {
    if (!layout || !sidebar) return;
    sidebar.dataset.collapsed = String(shut);
    layout.style.setProperty("--fd-sidebar-col", shut ? "0px" : "var(--fd-sidebar-width)");
    sidebar.style.visibility = shut ? "hidden" : "";
    for (const b of $$("[aria-controls='nd-sidebar']")) b.setAttribute("aria-expanded", String(!shut));
    ensureReopen(shut);
  };
  const ensureReopen = (shut) => {
    let open = $("[data-sidebar-reopen]");
    if (shut && !open) {
      open = document.createElement("button");
      open.type = "button";
      open.setAttribute("data-sidebar-reopen", "");
      open.setAttribute("aria-label", "Open Sidebar");
      open.setAttribute("aria-controls", "nd-sidebar");
      open.className = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring hover:bg-fd-accent hover:text-fd-accent-foreground p-1.5 [&_svg]:size-4.5 size-8 text-fd-muted-foreground max-md:hidden";
      open.innerHTML = $("#nd-sidebar button[aria-label='Collapse Sidebar']").innerHTML;
      open.addEventListener("click", () => collapse(false));
      $("#nd-page-panel > header")?.prepend(open);
    }
    if (open) open.hidden = !shut;
  };
  $("#nd-sidebar button[aria-label='Collapse Sidebar']")?.addEventListener("click", () => collapse(true));

  // the selector of the sections: a menu under its button
  const picker = $("[data-sections]");
  if (picker) {
    const button = $("button", picker);
    const menu = $("[data-sections-menu]", picker);
    const close = () => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("data-popup-open");
    };
    button.addEventListener("click", () => {
      if (!menu.hidden) return close();
      const r = button.getBoundingClientRect();
      menu.style.left = `${r.left}px`;
      menu.style.top = `${r.bottom + 4}px`;
      menu.style.width = `${r.width}px`;
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("data-popup-open", "");
      $("a[role=menuitem]", menu)?.focus();
    });
    document.addEventListener("click", (e) => {
      if (!menu.hidden && !picker.contains(e.target)) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) {
        close();
        button.focus();
      }
    });
  }

  // the drawer of narrow screens: the side navigation, the sections and the controls, built from the page's own when it is first opened
  let drawer = null;
  const closeDrawer = () => {
    if (!drawer) return;
    drawer.remove();
    drawer = null;
    $("[data-drawer-scrim]")?.remove();
    $("[data-drawer-open]")?.setAttribute("aria-expanded", "false");
  };
  const openDrawer = () => {
    if (drawer || !sidebar) return;
    const scrim = document.createElement("div");
    scrim.setAttribute("data-drawer-scrim", "");
    scrim.className = "fixed inset-0 z-40 backdrop-blur-xs bg-fd-overlay";
    scrim.addEventListener("click", closeDrawer);
    drawer = document.createElement("aside");
    drawer.id = "nd-sidebar-mobile";
    drawer.dataset.state = "open";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Navigation");
    drawer.className = "fixed z-40 inset-e-0 inset-y-0 flex flex-col w-[85%] max-w-95 text-[0.9375rem] bg-fd-background border-s shadow-lg";
    const github = $("#nd-page-panel > header a[aria-label=github]");
    const top = document.createElement("div");
    top.className = "flex items-center gap-1.5 h-(--fd-header-height) ps-3.5 pe-2.5 text-fd-muted-foreground";
    top.innerHTML = `<div class="flex flex-1">${github ? github.outerHTML.replace("max-lg:hidden", "") : ""}</div>`;
    for (const t of ["[data-width-toggle]", "[data-theme-toggle]"]) {
      const source = $(t);
      if (source) top.append(source.cloneNode(true));
    }
    const shut = document.createElement("button");
    shut.type = "button";
    shut.setAttribute("aria-label", "Close Sidebar");
    shut.className = "inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors duration-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-fd-ring hover:bg-fd-accent hover:text-fd-accent-foreground p-1.5 [&_svg]:size-4.5";
    shut.innerHTML = $("#nd-sidebar button[aria-label='Collapse Sidebar']").innerHTML;
    shut.addEventListener("click", closeDrawer);
    top.append(shut);
    drawer.append(top);
    const sections = document.createElement("div");
    sections.className = "flex flex-col gap-2 px-3";
    const menu = $("[data-sections-menu] .flex", sidebar);
    if (menu) {
      sections.innerHTML = `<div class="flex flex-col rounded-xl border bg-fd-secondary/50 overflow-clip p-1">${menu.innerHTML}</div>`;
      for (const a of $$("a", sections)) a.setAttribute("role", "link");
    }
    drawer.append(sections);
    const list = document.createElement("div");
    list.className = "min-h-0 flex-1 mt-2";
    const nav = $("[data-nav]", sidebar).cloneNode(true);
    nav.removeAttribute("data-nav");
    nav.setAttribute("data-nav-drawer", "");
    list.append(nav);
    drawer.append(list);
    document.body.append(scrim, drawer);
    for (const b of $$("[data-theme-toggle]", drawer)) b.addEventListener("click", toggleTheme);
    for (const b of $$("[data-width-toggle]", drawer)) b.addEventListener("click", toggleWidth);
    nav.addEventListener("click", (e) => {
      const holder = e.target.closest("[data-open], [data-closed]");
      if (!holder || !nav.contains(holder)) return;
      const trigger = holder.firstElementChild;
      if (trigger?.tagName === "BUTTON" || (trigger?.tagName === "A" && e.target.closest("svg[data-icon]") !== null)) {
        e.preventDefault();
        toggleFolder(holder, holder.hasAttribute("data-closed"));
      }
    });
    $("[data-drawer-open]")?.setAttribute("aria-expanded", "true");
    shut.focus();
  };
  $("[data-drawer-open]")?.addEventListener("click", () => (drawer ? closeDrawer() : openDrawer()));

  // the outline: the band behind the headings being read follows the reader; the popover of narrow screens and the button of the header open it
  const scroller = $("[data-scroller]");
  const outlines = $$("#nd-toc [data-outline], [data-toc-popover] [class*='overflow-y-auto']").map((box) => ({ box, links: $$("a[href^='#']", box), band: $("div.absolute", box) }));
  const heads = () => {
    const first = outlines[0];
    if (!first) return [];
    return first.links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
  };
  const scrolling = () => (scroller && getComputedStyle(scroller).overflowY === "auto" ? scroller : null);
  const readHeading = () => {
    const items = heads();
    if (items.length === 0) return -1;
    const s = scrolling();
    const line = (s ? s.getBoundingClientRect().top : 0) + 96;
    let at = 0;
    items.forEach((h, i) => {
      if (h.getBoundingClientRect().top <= line) at = i;
    });
    const end = s ? s.scrollTop + s.clientHeight >= s.scrollHeight - 2 : innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    return end && items.length > 1 && s && s.scrollHeight > s.clientHeight ? items.length - 1 : at;
  };
  let lastRead = -2;
  const mark = () => {
    const at = readHeading();
    if (at === lastRead) return;
    lastRead = at;
    for (const { box, links, band } of outlines) {
      links.forEach((a, i) => a.setAttribute("data-active", String(i === at)));
      const a = links[at];
      if (band && a) {
        const top = a.offsetTop;
        const bottom = a.offsetTop + a.offsetHeight;
        band.style.clipPath = `inset(${top}px 0px ${band.parentElement.offsetHeight - bottom}px round 8px)`;
        band.setAttribute("data-ready", "");
      } else if (band) band.style.clipPath = "";
      if (a && box.scrollHeight > box.clientHeight) a.scrollIntoView({ block: "nearest" });
    }
    const text = links0(at);
    for (const t of $$("[data-toc-current]")) if (text) t.textContent = text;
  };
  const links0 = (at) => outlines[0]?.links[at]?.textContent ?? "";
  if (outlines.length > 0) {
    (scrolling() ?? window).addEventListener("scroll", mark, { passive: true });
    scroller?.addEventListener("scroll", mark, { passive: true });
    addEventListener("resize", mark);
    mark();
  }
  const popover = $("[data-toc-popover]");
  if (popover) {
    const button = $("header > button", popover);
    const content = button.nextElementSibling;
    button.addEventListener("click", () => {
      const open = content.hidden;
      content.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      popover.toggleAttribute("data-open", open);
      popover.toggleAttribute("data-closed", !open);
      $("svg:last-child", button)?.classList.toggle("rotate-180", open);
    });
    $$("a", content).forEach((a) => a.addEventListener("click", () => button.click()));
  }
  // on a wide screen whose panel is too narrow for the outline, the header's button shows it in a floating list
  const outlineOpen = $("[data-outline-open]");
  if (outlineOpen && outlines[0]) {
    let floating = null;
    const shutOutline = () => {
      floating?.remove();
      floating = null;
      outlineOpen.setAttribute("aria-expanded", "false");
    };
    outlineOpen.addEventListener("click", () => {
      if (floating) return shutOutline();
      floating = document.createElement("div");
      floating.className = "fixed z-40 flex flex-col max-h-[50vh] w-72 overflow-y-auto rounded-2xl border bg-fd-popover text-sm text-fd-popover-foreground shadow-lg p-2";
      const r = outlineOpen.getBoundingClientRect();
      floating.style.left = `${r.left}px`;
      floating.style.top = `${r.bottom + 4}px`;
      floating.innerHTML = outlines[0].box.innerHTML;
      floating.addEventListener("click", (e) => {
        if (e.target.closest("a")) shutOutline();
      });
      document.body.append(floating);
      outlineOpen.setAttribute("aria-expanded", "true");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && floating) shutOutline();
    });
  }

  // the search
  const overlay = $("[data-search-overlay]");
  const dialog = $("#fd-search-dialog-content");
  const input = $("[data-fd-search-dialog-input]");
  const list = $("#fd-search-list");
  const kind = $("[data-search-kind]");
  const holder = list?.parentElement;
  let index = null;
  let selected = 0;
  const load = async () => {
    if (index) return index;
    try {
      const r = await fetch(`${root}search.json`);
      index = (await r.json()).map(([title, url, where, kindOf]) => ({ title, url, where, kind: kindOf, group: kindOf.replace(/ of .*$/, "").replace(/\s*\(.*\)$/, "").trim(), key: title.toLowerCase() }));
    } catch {
      index = [];
    }
    return index;
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const OPTION = "cursor-default relative shrink-0 px-2.5 py-2 text-sm overflow-hidden rounded-lg";
  const SELECTED = " bg-fd-accent text-fd-accent-foreground";
  const render = async () => {
    const q = input.value.trim().toLowerCase();
    const all = await load();
    if (q === "") {
      list.innerHTML = "";
      holder.dataset.empty = "true";
      return;
    }
    const words = q.split(/\s+/);
    const only = kind?.value ?? "";
    const scored = [];
    for (const e of all) {
      if (only !== "" && e.group !== only) continue;
      const hay = `${e.key} ${e.where.toLowerCase()}`;
      if (!words.every((w) => hay.includes(w))) continue;
      const s = e.key === q ? 0 : e.key.startsWith(q) ? 1 : e.key.includes(q) ? 2 : 3;
      scored.push([s, e.title.length, e]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    selected = 0;
    holder.dataset.empty = "false";
    list.innerHTML = scored.slice(0, 40).map(([, , e], i) =>
      `<a role="option" aria-selected="${i === 0}" href="${esc(root + e.url)}" class="${i === 0 ? OPTION + SELECTED : OPTION}"><div class="inline-flex items-center text-fd-muted-foreground text-xs empty:hidden">${esc(e.kind)} · ${esc(e.where)}</div><div class="prose prose-sm min-w-0 font-medium text-inherit"><p class="min-w-0">${esc(e.title)}</p></div></a>`
    ).join("") || `<div class="${OPTION} text-fd-muted-foreground">Nothing found.</div>`;
  };
  const choose = (items, i) => {
    selected = i;
    items.forEach((a, j) => {
      a.setAttribute("aria-selected", String(j === i));
      for (const c of SELECTED.trim().split(" ")) a.classList.toggle(c, j === i);
    });
    items[i]?.scrollIntoView({ block: "nearest" });
  };
  let back = null;
  const openSearch = () => {
    if (!dialog || !dialog.hidden) return;
    back = document.activeElement;
    overlay.hidden = false;
    dialog.hidden = false;
    input.focus();
    input.select();
    void load().then((all) => {
      if (kind && kind.options.length === 1) {
        for (const k of [...new Set(all.map((e) => e.group))].sort()) kind.add(new Option(k, k));
      }
    });
  };
  const closeSearch = () => {
    if (!dialog || dialog.hidden) return;
    overlay.hidden = true;
    dialog.hidden = true;
    back?.focus?.();
  };
  kind?.addEventListener("change", () => void render());
  for (const b of $$("[data-search-full], [data-search]")) b.addEventListener("click", openSearch);
  overlay?.addEventListener("click", closeSearch);
  $("[data-search-close]")?.addEventListener("click", closeSearch);
  document.addEventListener("keydown", (e) => {
    const searching = dialog && !dialog.hidden;
    if (e.key === "Escape" && searching) {
      closeSearch();
    } else if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing() && !searching)) {
      e.preventDefault();
      searching ? closeSearch() : openSearch();
    } else if (!typing() && !searching && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === "t") toggleTheme();
      else if (e.key === "w") toggleWidth();
      else if (e.key === "[" || e.key === "]") {
        // the previous and the next page of the side navigation
        const links = $$("#nd-sidebar a[data-active]");
        const at = links.findIndex((a) => a.dataset.active === "true");
        const go = links[at + (e.key === "]" ? 1 : -1)];
        if (at >= 0 && go) location.href = go.href;
      }
    }
  });
  input?.addEventListener("input", render);
  input?.addEventListener("keydown", (e) => {
    const items = $$("a", list);
    if (items.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      choose(items, (selected + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      location.href = items[selected].href;
    }
  });

  // diagrams: drawn when the site is built; a click shows one at full size, or fits it again
  for (const wrap of $$("[data-diagram]")) {
    wrap.title = "Click to see the diagram at full size, or to fit it again";
    wrap.addEventListener("click", () => wrap.classList.toggle("expanded"));
  }
})();

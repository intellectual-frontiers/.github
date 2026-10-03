/*
 * Frontiers Console behaviour. One classic script, no dependencies, no build step; load it with
 * <script src="js/console.js" defer>. Every element works without script as far as plain HTML can
 * (the sidebar tree, details-based menus and accordions, anchors in the table of contents); script adds
 * what HTML can't: the drawer, tabs, scroll-spy, search, sorting, copy buttons.
 *
 *   <fc-shell>      layout state: mobile drawer, desktop collapse (remembered)
 *   <fc-toc>        table of contents: built from headings if empty, with scroll-spy
 *   <fc-tabs>       accessible tabs with roving focus; `sync="key"` keeps tabs with the same key in step
 *   <fc-codeblock>  copy button for the .fc-code block inside it
 *   <fc-search>     command-palette search over a JSON index (`src` or an inline application/json script)
 *   <fc-table>      sortable, filterable table (`filter="#input-id"`, `count="#element-id"`)
 *   <fc-terminal>   append-only run log; .write(text, kind), .clear(), `status` attribute
 *   FcToast.show()  transient notifications
 */
(() => {
  "use strict";

  const define = (name, ctor) => { if (!customElements.get(name)) customElements.define(name, ctor); };
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable: state is per-page-view */ } },
  };
  const slug = (text) => text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 64) || "section";
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

  /* ───────────────────────── fc-shell ───────────────────────── */
  class FcShell extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      if (store.get("fc-sidebar-collapsed") === "1") this.setAttribute("data-sidebar-collapsed", "");
      if (!this.querySelector(".fc-backdrop")) {
        const backdrop = document.createElement("div");
        backdrop.className = "fc-backdrop";
        backdrop.setAttribute("aria-hidden", "true");
        this.append(backdrop);
      }
      this.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest("[data-fc-sidebar-toggle]")) this.toggleDrawer(target.closest("[data-fc-sidebar-toggle]"));
        else if (target.closest("[data-fc-sidebar-collapse]")) this.toggleCollapsed();
        else if (target.closest(".fc-backdrop")) this.closeDrawer();
        else if (this.hasAttribute("data-sidebar-open") && target.closest(".fc-sidebar a[href]")) this.closeDrawer(false);
      });
      this.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.hasAttribute("data-sidebar-open")) { event.stopPropagation(); this.closeDrawer(); }
      });
      matchMedia("(min-width: 64rem)").addEventListener("change", (event) => { if (event.matches) this.closeDrawer(false); });
      this.#sync();
    }
    get layout() { return this.getAttribute("data-layout") || "docs"; }
    set layout(value) { this.setAttribute("data-layout", value); }
    toggleDrawer(opener) { this.hasAttribute("data-sidebar-open") ? this.closeDrawer() : this.openDrawer(opener); }
    openDrawer(opener) {
      // the button that was activated, not document.activeElement: Safari does not focus buttons on click
      this._opener = opener || document.activeElement;
      this.setAttribute("data-sidebar-open", "");
      this.#sync();
      this.querySelector(".fc-sidebar")?.querySelector(FOCUSABLE)?.focus();
    }
    closeDrawer(restoreFocus = true) {
      if (!this.hasAttribute("data-sidebar-open")) return;
      this.removeAttribute("data-sidebar-open");
      this.#sync();
      if (restoreFocus && this._opener instanceof HTMLElement) this._opener.focus();
    }
    toggleCollapsed() {
      const collapsed = this.toggleAttribute("data-sidebar-collapsed");
      store.set("fc-sidebar-collapsed", collapsed ? "1" : "0");
      this.#sync();
      this.querySelector(collapsed ? ".fc-sidebar-expand" : "[data-fc-sidebar-collapse]")?.focus();
    }
    #sync() {
      const open = this.hasAttribute("data-sidebar-open");
      for (const button of this.querySelectorAll("[data-fc-sidebar-toggle]")) button.setAttribute("aria-expanded", String(open));
      const collapsed = this.hasAttribute("data-sidebar-collapsed");
      for (const button of this.querySelectorAll("[data-fc-sidebar-collapse], .fc-sidebar-expand")) button.setAttribute("aria-expanded", String(!collapsed));
    }
  }
  define("fc-shell", FcShell);

  /* ───────────────────────── fc-toc ───────────────────────── */
  class FcToc extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      const scope = document.querySelector(this.getAttribute("scope") || "main") || document;
      const depth = Number(this.getAttribute("depth")) || 3;
      const selector = Array.from({ length: depth - 1 }, (_, i) => `h${i + 2}`).join(",");
      this._headings = Array.from(scope.querySelectorAll(selector));
      if (!this.querySelector("a")) this.#build();
      this._links = new Map(Array.from(this.querySelectorAll("a[href^='#']")).map((a) => [decodeURIComponent(a.getAttribute("href").slice(1)), a]));
      this._visible = new Set();
      if ("IntersectionObserver" in window) {
        this._observer = new IntersectionObserver((entries) => {
          for (const entry of entries) entry.isIntersecting ? this._visible.add(entry.target) : this._visible.delete(entry.target);
          this.#mark();
        }, { rootMargin: "-72px 0px -65% 0px" });
        for (const heading of this._headings) if (this._links.has(heading.id)) this._observer.observe(heading);
      }
      addEventListener("hashchange", () => this.mark(decodeURIComponent(location.hash.slice(1))));
    }
    disconnectedCallback() { this._observer?.disconnect(); }
    #build() {
      const list = document.createElement("ol");
      for (const heading of this._headings) {
        if (!heading.id) {
          // generated ids must be unique: two "Overview" headings become overview and overview-2
          const base = slug(heading.textContent);
          let id = base, n = 2;
          while (document.getElementById(id)) id = `${base}-${n++}`;
          heading.id = id;
        }
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${heading.id}`;
        link.dataset.depth = heading.tagName.slice(1);
        link.textContent = heading.textContent.replace(/#\s*$/, "").trim();
        item.append(link);
        list.append(item);
      }
      this.replaceChildren(list);
    }
    #mark() {
      const first = this._headings.find((heading) => this._visible.has(heading));
      if (first) this.mark(first.id);
    }
    /** Set the current entry by heading id. */
    mark(id) {
      for (const [key, link] of this._links) key === id ? link.setAttribute("aria-current", "true") : link.removeAttribute("aria-current");
    }
  }
  define("fc-toc", FcToc);

  /* ───────────────────────── fc-tabs ───────────────────────── */
  let tabsId = 0;
  class FcTabs extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      this._list = this.querySelector('[role="tablist"]');
      this._tabs = Array.from(this.querySelectorAll('[role="tab"]'));
      const panels = Array.from(this.querySelectorAll(':scope > [role="tabpanel"]'));
      const base = `fc-tabs-${++tabsId}`;
      this._tabs.forEach((tab, i) => {
        const panel = panels[i];
        if (!panel) return;
        tab.id ||= `${base}-tab-${i}`;
        panel.id ||= `${base}-panel-${i}`;
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("aria-labelledby", tab.id);
        tab._panel = panel;
      });
      this._list?.addEventListener("click", (event) => {
        const tab = event.target.closest?.('[role="tab"]');
        if (tab) this.select(tab, true);
      });
      this._list?.addEventListener("keydown", (event) => {
        const index = this._tabs.indexOf(document.activeElement);
        if (index < 0) return;
        const last = this._tabs.length - 1;
        const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        this._tabs[next].focus();
        this.select(this._tabs[next], true);
      });
      this.select(this._tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || this._tabs[0], false);
      const key = this.getAttribute("sync");
      if (key) {
        const saved = store.get(`fc-tabs:${key}`);
        const match = this._tabs.find((tab) => tab.textContent.trim() === saved);
        if (match) this.select(match, false);
        this._onSync = (event) => {
          if (event.detail.key !== key || event.detail.source === this) return;
          const other = this._tabs.find((tab) => tab.textContent.trim() === event.detail.label);
          if (other) this.select(other, false);
        };
        document.addEventListener("fc-tabs-sync", this._onSync);
      }
    }
    disconnectedCallback() { if (this._onSync) document.removeEventListener("fc-tabs-sync", this._onSync); }
    select(tab, user) {
      if (!tab) return;
      for (const t of this._tabs) {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        if (t._panel) t._panel.hidden = !on;
      }
      const key = this.getAttribute("sync");
      if (user && key) {
        const label = tab.textContent.trim();
        store.set(`fc-tabs:${key}`, label);
        document.dispatchEvent(new CustomEvent("fc-tabs-sync", { detail: { key, label, source: this } }));
      }
    }
  }
  define("fc-tabs", FcTabs);

  /* ───────────────────────── fc-codeblock ───────────────────────── */
  class FcCodeblock extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      const figure = this.querySelector(".fc-code");
      const pre = figure?.querySelector("pre");
      if (!figure || !pre) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fc-code__copy";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code to clipboard");
      button.addEventListener("click", async () => {
        const text = pre.innerText.replace(/\n$/, "");
        let ok = false;
        try {
          // the async clipboard API can wait forever on a permission prompt (file:// pages, some embedded views)
          await Promise.race([navigator.clipboard.writeText(text), new Promise((_, reject) => setTimeout(reject, 1000))]);
          ok = true;
        } catch {
          const area = document.createElement("textarea");
          area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
          document.body.append(area); area.select();
          try { ok = document.execCommand("copy"); } catch { ok = false; }
          area.remove();
        }
        button.textContent = ok ? "Copied" : "Press Ctrl+C";
        button.toggleAttribute("data-copied", ok);
        this.dispatchEvent(new CustomEvent("fc-copy", { bubbles: true, detail: { text, ok } }));
        setTimeout(() => { button.textContent = "Copy"; button.removeAttribute("data-copied"); }, 1600);
      });
      figure.append(button);
    }
  }
  define("fc-codeblock", FcCodeblock);

  /* ───────────────────────── fc-search ───────────────────────── */
  let searchId = 0;
  class FcSearch extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      const id = `fc-search-${++searchId}`;
      const label = this.getAttribute("label") || "Search";
      this._items = [];
      this._active = -1;

      this._trigger = document.createElement("button");
      this._trigger.type = "button";
      this._trigger.className = "fc-search-trigger";
      this._trigger.innerHTML = `<span>${this.getAttribute("placeholder") || "Search…"}</span><kbd class="fc-kbd">Ctrl K</kbd>`;
      this._trigger.setAttribute("aria-haspopup", "dialog");

      this._dialog = document.createElement("dialog");
      this._dialog.className = "fc-search-dialog";
      this._dialog.setAttribute("aria-label", label);
      this._input = document.createElement("input");
      Object.assign(this._input, { type: "search", className: "fc-search-input", placeholder: this.getAttribute("placeholder") || "Search…", autocomplete: "off", spellcheck: false });
      this._input.setAttribute("role", "combobox");
      this._input.setAttribute("aria-label", label);
      this._input.setAttribute("aria-expanded", "true");
      this._input.setAttribute("aria-controls", `${id}-list`);
      this._input.setAttribute("aria-autocomplete", "list");
      this._list = document.createElement("div");
      this._list.className = "fc-search-results";
      this._list.id = `${id}-list`;
      this._list.setAttribute("role", "listbox");
      const foot = document.createElement("div");
      foot.className = "fc-search-foot";
      foot.innerHTML = '<span><kbd class="fc-kbd">↑</kbd> <kbd class="fc-kbd">↓</kbd> to move</span><span><kbd class="fc-kbd">Enter</kbd> to open</span><span><kbd class="fc-kbd">Esc</kbd> to close</span>';
      this._dialog.append(this._input, this._list, foot);
      this._script = this.querySelector('script[type="application/json"]');
      this.replaceChildren(this._trigger, this._dialog);

      this._trigger.addEventListener("click", () => this.open());
      this._dialog.addEventListener("click", (event) => { if (event.target === this._dialog) this.close(); });
      this._input.addEventListener("input", () => this.#render());
      this._input.addEventListener("keydown", (event) => this.#key(event));
      this._list.addEventListener("click", (event) => {
        const row = event.target.closest?.("[role='option']");
        if (row) this.#choose(Number(row.dataset.index));
      });
      this._onKey = (event) => {
        const typing = /^(input|textarea|select)$/i.test(event.target?.tagName || "") || event.target?.isContentEditable;
        if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") || (event.key === "/" && !typing)) {
          event.preventDefault();
          this.open();
        }
      };
      document.addEventListener("keydown", this._onKey);
    }
    disconnectedCallback() { document.removeEventListener("keydown", this._onKey); }

    async #load() {
      if (this._loaded) return;
      this._loaded = true;
      try {
        const src = this.getAttribute("src");
        const data = src ? await (await fetch(src)).json() : JSON.parse(this._script?.textContent || "[]");
        this._index = Array.isArray(data) ? data : data.items || [];
      } catch { this._index = []; this._failed = true; }
    }
    async open() {
      await this.#load();
      if (!this._dialog.open) this._dialog.showModal();
      this._input.value = "";
      this.#render();
      this._input.focus();
    }
    close() { this._dialog.close(); this._trigger.focus(); }
    #score(item, terms) {
      const title = item.title.toLowerCase(), rest = `${item.description || ""} ${(item.keywords || []).join(" ")} ${item.section || ""}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (title === term) score += 10;
        else if (title.startsWith(term)) score += 6;
        else if (title.includes(term)) score += 4;
        else if (rest.includes(term)) score += 1;
        else return 0;
      }
      // among equals the shorter title is the closer match; the penalty is always below one point
      return score - Math.min(title.length, 100) / 1000;
    }
    #render() {
      const terms = this._input.value.toLowerCase().split(/\s+/).filter(Boolean);
      const pool = this._index || [];
      this._items = (terms.length
        ? pool.map((item) => [this.#score(item, terms), item]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).map(([, item]) => item)
        : pool).slice(0, 8);
      this._list.replaceChildren();
      if (!this._items.length) {
        const empty = document.createElement("p");
        empty.className = "fc-search-empty";
        empty.textContent = this._failed ? "The search index could not be loaded." : "No results.";
        this._list.append(empty);
      }
      this._items.forEach((item, i) => {
        const row = document.createElement("a");
        row.className = "fc-search-result";
        row.href = item.href;
        row.id = `${this._list.id}-${i}`;
        row.dataset.index = String(i);
        row.setAttribute("role", "option");
        row.tabIndex = -1;
        const parts = [];
        if (item.section) { const s = document.createElement("small"); s.textContent = item.section; parts.push(s); }
        const title = document.createElement("strong"); title.textContent = item.title; parts.push(title);
        if (item.description) { const d = document.createElement("span"); d.textContent = item.description; parts.push(d); }
        row.append(...parts);
        row.addEventListener("click", (event) => { event.preventDefault(); this.#choose(i); });
        this._list.append(row);
      });
      this.#activate(this._items.length ? 0 : -1);
    }
    #activate(index) {
      this._active = index;
      Array.from(this._list.querySelectorAll("[role='option']")).forEach((row, i) => {
        row.setAttribute("aria-selected", String(i === index));
        if (i === index) { this._input.setAttribute("aria-activedescendant", row.id); row.scrollIntoView({ block: "nearest" }); }
      });
      if (index < 0) this._input.removeAttribute("aria-activedescendant");
    }
    #key(event) {
      const n = this._items.length;
      if (event.key === "ArrowDown") { event.preventDefault(); this.#activate(n ? (this._active + 1) % n : -1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); this.#activate(n ? (this._active - 1 + n) % n : -1); }
      else if (event.key === "Enter") { event.preventDefault(); if (this._active >= 0) this.#choose(this._active); }
    }
    #choose(index) {
      const item = this._items[index];
      if (!item) return;
      const proceed = this.dispatchEvent(new CustomEvent("fc-search-select", { bubbles: true, cancelable: true, detail: { item } }));
      if (proceed) location.assign(item.href);
      else this._dialog.close();
    }
  }
  define("fc-search", FcSearch);

  /* ───────────────────────── fc-table ───────────────────────── */
  class FcTable extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      this._table = this.querySelector("table");
      this._body = this._table?.tBodies[0];
      if (!this._body) return;
      this._sorted = null;
      this._headers = Array.from(this._table.querySelectorAll("th[data-sort]"));
      for (const th of this._headers) {
        const button = document.createElement("button");
        button.type = "button";
        button.append(...th.childNodes);
        th.append(button);
        button.addEventListener("click", () => this.sort(th));
      }
      this._filterInput = document.querySelector(this.getAttribute("filter") || "null");
      this._filterInput?.addEventListener("input", () => this.filter(this._filterInput.value));
      this._count = document.querySelector(this.getAttribute("count") || "null");
      const empty = document.createElement("tbody");
      empty.hidden = true;
      empty.innerHTML = `<tr><td class="fc-table__empty" colspan="${this._table.rows[0]?.cells.length || 1}">No matching rows.</td></tr>`;
      this._empty = empty;
      this._table.append(empty);
      this.#count();
    }
    sort(th, direction) {
      const index = th.cellIndex;
      const asc = direction ? direction === "ascending" : th.getAttribute("aria-sort") !== "ascending";
      const numeric = th.dataset.sort === "number";
      const cell = (row) => (row.cells[index]?.dataset.value ?? row.cells[index]?.textContent ?? "").trim();
      const rows = Array.from(this._body.rows).sort((a, b) => {
        const [x, y] = [cell(a), cell(b)];
        const result = numeric ? Number(x) - Number(y) : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
        return asc ? result : -result;
      });
      this._body.append(...rows);
      for (const header of this._headers) header.removeAttribute("aria-sort");
      th.setAttribute("aria-sort", asc ? "ascending" : "descending");
      this.dispatchEvent(new CustomEvent("fc-table-sort", { bubbles: true, detail: { column: index, direction: asc ? "ascending" : "descending" } }));
    }
    filter(query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      for (const row of this._body.rows) row.hidden = !terms.every((term) => row.textContent.toLowerCase().includes(term));
      this.#count();
    }
    #count() {
      const rows = Array.from(this._body.rows);
      const shown = rows.filter((row) => !row.hidden).length;
      this._empty.hidden = shown > 0;
      if (this._count) this._count.textContent = `${shown} of ${rows.length}`;
    }
  }
  define("fc-table", FcTable);

  /* ───────────────────────── fc-terminal ───────────────────────── */
  class FcTerminal extends HTMLElement {
    static observedAttributes = ["status", "title"];
    connectedCallback() {
      if (this._init) return;
      this._init = true;
      const initial = this.querySelector("pre")?.textContent ?? "";
      this._bar = document.createElement("div");
      this._bar.className = "fc-terminal__bar";
      this._title = document.createElement("span");
      this._status = document.createElement("span");
      this._status.setAttribute("aria-live", "polite");
      this._bar.append(this._title, this._status);
      this._log = document.createElement("pre");
      this._log.className = "fc-terminal__log";
      this._log.setAttribute("role", "log");
      this._log.tabIndex = 0;
      this._log.setAttribute("aria-label", this.getAttribute("title") || "Output");
      this.replaceChildren(this._bar, this._log);
      if (initial) this.write(initial.replace(/\n$/, "") + "\n");
      this.#labels();
    }
    attributeChangedCallback() { if (this._init) this.#labels(); }
    #labels() {
      this._title.textContent = this.getAttribute("title") || "";
      this._status.textContent = this.getAttribute("status") || "";
    }
    /** Append text; `kind` is "err", "ok" or "dim". Keeps the view pinned to the end if it already was. */
    write(text, kind) {
      const stick = this._log.scrollHeight - this._log.scrollTop - this._log.clientHeight < 24;
      const span = document.createElement("span");
      if (kind) span.className = `fc-t-${kind}`;
      span.textContent = text;
      this._log.append(span);
      if (stick) this._log.scrollTop = this._log.scrollHeight;
    }
    clear() { this._log.replaceChildren(); }
    get text() { return this._log.textContent; }
  }
  define("fc-terminal", FcTerminal);

  /* ───────────────────────── FcToast ───────────────────────── */
  window.FcToast = {
    show(message, { type = "info", timeout = 4000 } = {}) {
      let region = document.querySelector(".fc-toast-region");
      if (!region) {
        region = document.createElement("div");
        region.className = "fc-toast-region";
        region.setAttribute("role", "region");
        region.setAttribute("aria-live", "polite");
        region.setAttribute("aria-label", "Notifications");
        document.body.append(region);
      }
      const toast = document.createElement("div");
      toast.className = "fc-toast";
      toast.dataset.type = type;
      toast.setAttribute("role", type === "error" ? "alert" : "status");
      toast.textContent = message;
      region.append(toast);
      if (timeout > 0) setTimeout(() => toast.remove(), timeout);
      return toast;
    },
  };

  /* ───────────────────────── details menus ───────────────────────── */
  document.addEventListener("click", (event) => {
    for (const menu of document.querySelectorAll("details.fc-menu[open]")) if (!menu.contains(event.target)) menu.removeAttribute("open");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const menu = document.querySelector("details.fc-menu[open]");
    if (menu) { menu.removeAttribute("open"); menu.querySelector("summary")?.focus(); }
  });
})();

// The one script of commons' documentation (commons 0011-documentation FR-017, FR-034): the theme, the menu on narrow screens, tabs, copy buttons, the
// table of contents following the reader, the search ("/" opens it, "t" switches the theme, "[" and "]" go to the previous and next page; search.json is a file of the site), and Mermaid where a page has a
// diagram. A page reads whole without it; nothing here asks another host for anything.
(() => {
  "use strict";
  const root = document.documentElement.dataset.root || "";

  // the theme: the reader's system decides until they choose, and the choice is kept in this browser only
  const scheme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const toggleTheme = () => {
    const next = scheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage may be unavailable: the choice then lasts for this page only
    }
  };
  document.querySelector(".theme-button")?.addEventListener("click", toggleTheme);

  // the menu
  const menu = document.querySelector(".menu-button");
  if (menu) {
    menu.addEventListener("click", () => {
      const open = document.body.classList.toggle("menu-open");
      menu.setAttribute("aria-expanded", String(open));
    });
  }

  // tabs
  for (const tabs of document.querySelectorAll("[data-tabs]")) {
    const buttons = [...tabs.querySelectorAll(":scope > .tab-list > button")];
    const panels = [...tabs.querySelectorAll(":scope > .tab-panel")];
    const select = (i) => {
      buttons.forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
      panels.forEach((p, j) => (p.hidden = i !== j));
    };
    buttons.forEach((b, i) => b.addEventListener("click", () => select(i)));
  }

  // copy buttons
  for (const pre of document.querySelectorAll("figure.code pre, pre.sig")) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "copy";
    b.textContent = "Copy";
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector("code")?.textContent ?? "");
        b.textContent = "Copied";
      } catch {
        b.textContent = "Select and copy";
      }
      setTimeout(() => (b.textContent = "Copy"), 1500);
    });
    pre.appendChild(b);
  }

  // the table of contents
  const links = [...document.querySelectorAll(".toc a")];
  if (links.length > 0 && "IntersectionObserver" in window) {
    const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
      const first = [...byId.keys()].find((id) => seen.has(id));
      if (first) links.forEach((a) => a.classList.toggle("active", byId.get(first) === a));
    }, { rootMargin: "-56px 0px -60% 0px" });
    for (const id of byId.keys()) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
  }

  // the search
  const dialog = document.querySelector("dialog.search");
  const input = dialog?.querySelector("input");
  const list = dialog?.querySelector(".results");
  const kind = dialog?.querySelector(".search-kind");
  let index = null;
  let selected = 0;
  const load = async () => {
    if (index) return index;
    try {
      const r = await fetch(`${root}search.json`);
      index = (await r.json()).map(([title, url, where, kind]) => ({ title, url, where, kind, group: kind.replace(/ of .*$/, "").replace(/\s*\(.*\)$/, "").trim(), key: title.toLowerCase() }));
    } catch {
      index = [];
    }
    return index;
  };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const render = async () => {
    const q = input.value.trim().toLowerCase();
    const all = await load();
    if (q === "") {
      list.innerHTML = "";
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
    list.innerHTML = scored.slice(0, 40).map(([, , e], i) =>
      `<li><a href="${esc(root + e.url)}"${i === 0 ? ' class="selected"' : ""}><span class="r-title">${esc(e.title)}</span><span class="r-where">${esc(e.kind)} · ${esc(e.where)}</span></a></li>`
    ).join("") || '<li class="r-none"><span class="r-where">Nothing found.</span></li>';
  };
  const open = () => {
    if (!dialog) return;
    dialog.showModal();
    input.select();
    void load().then((all) => {
      if (kind && kind.options.length === 1) {
        for (const k of [...new Set(all.map((e) => e.group))].sort()) kind.add(new Option(k, k));
      }
    });
  };
  kind?.addEventListener("change", () => void render());
  document.querySelector(".search-button")?.addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
    if (e.key === "/" && !typing && !dialog?.open) {
      e.preventDefault();
      open();
    } else if (e.key === "t" && !typing && !dialog?.open && !e.metaKey && !e.ctrlKey && !e.altKey) {
      toggleTheme();
    } else if ((e.key === "[" || e.key === "]") && !typing && !dialog?.open) {
      // the previous and the next page of the side navigation
      const links = [...document.querySelectorAll(".sidebar a")];
      const at = links.findIndex((a) => a.classList.contains("current"));
      const go = links[at + (e.key === "]" ? 1 : -1)];
      if (at >= 0 && go) location.href = go.href;
    }
  });
  input?.addEventListener("input", render);
  input?.addEventListener("keydown", (e) => {
    const items = [...list.querySelectorAll("a")];
    if (items.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      selected = (selected + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
      items.forEach((a, i) => a.classList.toggle("selected", i === selected));
      items[selected].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      location.href = items[selected].href;
    }
  });
  dialog?.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  // diagrams
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "strict",
      fontFamily: getComputedStyle(document.body).fontFamily,
      themeVariables: scheme() === "dark"
        ? { background: "#0a0a0a", primaryColor: "#171717", primaryBorderColor: "#525252", primaryTextColor: "#ededed", lineColor: "#8a8a8a", secondaryColor: "#1c1c1c", tertiaryColor: "#0a0a0a", fontSize: "14px" }
        : { background: "#ffffff", primaryColor: "#fafafa", primaryBorderColor: "#a3a3a3", primaryTextColor: "#171717", lineColor: "#737373", secondaryColor: "#f5f5f5", tertiaryColor: "#ffffff", fontSize: "14px" },
    });
    void window.mermaid.run({ querySelector: "pre.mermaid" });
    for (const wrap of document.querySelectorAll(".mermaid-wrap")) {
      wrap.title = "Click to see the diagram at full size, or to fit it again";
      wrap.addEventListener("click", () => wrap.classList.toggle("expanded"));
    }
  }
})();

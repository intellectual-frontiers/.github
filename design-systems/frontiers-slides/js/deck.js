/*
 * frontiers-slides' viewer (spec FR-010): shows one slide at a time, scaled to the window. Keys: Right, Down, Space
 * or Page Down for the next slide; Left, Up or Page Up for the previous; Home and End; N for the speaker notes;
 * P for every slide in order, as printed. The slide shown is in the URL's hash (#3), so a link opens on it.
 * Without this script a deck is still every slide in order, which is how it prints.
 */
(() => {
  "use strict";
  const root = document.documentElement;
  const slides = [...document.querySelectorAll(".slide")];
  if (!slides.length) return;
  const panel = document.createElement("aside");
  panel.id = "deck-notes";
  panel.setAttribute("aria-label", "Speaker notes");
  document.body.append(panel);
  let current = Math.min(Math.max(parseInt(location.hash.slice(1), 10) || 1, 1), slides.length) - 1;

  function fit() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    root.style.setProperty("--slide-scale", scale);
    root.style.setProperty("--slide-left", `${(window.innerWidth - 1920 * scale) / 2}px`);
    root.style.setProperty("--slide-top", `${(window.innerHeight - 1080 * scale) / 2}px`);
  }
  function show(i) {
    current = Math.min(Math.max(i, 0), slides.length - 1);
    slides.forEach((s, n) => s.setAttribute("aria-current", String(n === current)));
    const notes = slides[current].querySelector(".notes");
    panel.innerHTML = notes ? notes.innerHTML : "<p>No notes for this slide.</p>";
    history.replaceState(null, "", `#${current + 1}`);
  }
  const keys = {
    ArrowRight: 1, ArrowDown: 1, PageDown: 1, " ": 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1,
  };
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key in keys) { show(current + keys[e.key]); e.preventDefault(); }
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(slides.length - 1);
    else if (e.key === "n" || e.key === "N") root.classList.toggle("notes");
    else if (e.key === "p" || e.key === "P") root.classList.toggle("present");
  });
  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", () => show((parseInt(location.hash.slice(1), 10) || 1) - 1));
  root.classList.add("deck");
  if (!new URLSearchParams(location.search).has("print")) root.classList.add("present");
  fit();
  show(current);
})();

// Spec: 0001-docs FR-001
/**
 * Two small functions the HTML writers share: text made safe for HTML and the relative address from one page of the site to another.
 *
 * @module
 */

/** Text made safe for HTML. */
export function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The relative address from one page of the site to another.
 *
 * @param from - the path of the page the link is on
 * @param to - the path of the page it goes to
 */
export function relative(from: string, to: string): string {
  const a = from.split("/").slice(0, -1);
  const b = to.split("/");
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  const up = a.length - i;
  return `${"../".repeat(up)}${b.slice(i).join("/")}` || "index.html";
}

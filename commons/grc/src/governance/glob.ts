// Spec: 0002-grc-governance FR-007
/**
 * A small glob for the ids and paths a document names: `*` is any run of characters but `/`, `**` any run at all, `?` one character but `/`. Pure, so governance needs no package for it.
 *
 * @module
 */

/** Whether `text` matches `glob`. */
export function globMatches(glob: string, text: string): boolean {
  let source = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i);
    if (c === "*" && glob.charAt(i + 1) === "*") {
      source += ".*";
      i++;
    } else if (c === "*") source += "[^/]*";
    else if (c === "?") source += "[^/]";
    else source += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`).test(text);
}

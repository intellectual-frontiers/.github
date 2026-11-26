// Spec: 0004-scripts FR-004
/**
 * The helper of the script renderers: a template tag that keeps the backslashes of the script as written, so that `\${` is a literal `${` of the script and `${x}` an interpolation of the renderer. Pure.
 *
 * @module
 */

/** Join a template as written (raw), turning `\${` into `${`. */
export function script(strings: TemplateStringsArray, ...values: readonly string[]): string {
  let out = "";
  for (const [i, s] of strings.raw.entries()) out += s.replaceAll("\\${", "${") + (values[i] ?? "");
  return out;
}

/** What a script may say between single quotes: the renderer refuses anything that could end the quote. */
export function quoted(value: string): string {
  if (!/^[A-Za-z0-9._:/@=+,%-]*$/.test(value)) throw new Error(`a value of a script is outside the safe alphabet: ${value.slice(0, 32)}`);
  return `'${value}'`;
}

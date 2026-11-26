/**
 * Tars written entry by entry for the tests of this package, so that a path can be twice, a type can be a link and a mode can be executable; every name and byte in them is made up.
 *
 * @module
 */
import { concat, tarHeader } from "@intellectual-frontiers/formats/archive";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const pad = (n: number): Uint8Array => new Uint8Array((512 - (n % 512)) % 512);

/** One entry as written: a file by default, or a folder, a symbolic link or a hard link; `link` is what a link names. */
export type RawEntry =
  | { readonly kind?: "file"; readonly path: string; readonly data?: Uint8Array; readonly executable?: boolean }
  | { readonly kind: "dir"; readonly path: string }
  | { readonly kind: "symlink"; readonly path: string; readonly link: string }
  | { readonly kind: "hardlink"; readonly path: string; readonly link: string };

/** A tar of the entries in the order given, with the two blocks of zeros at its end. */
export function rawTar(entries: readonly RawEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const e of entries) {
    const body = e.kind === undefined || e.kind === "file" ? (e.data ?? new Uint8Array()) : new Uint8Array();
    const header = tarHeader(e.path, body.length, e.kind === "dir");
    if (header === undefined) throw new Error(`no header for ${e.path}`);
    switch (e.kind) {
      case "symlink":
      case "hardlink":
        header[156] = (e.kind === "symlink" ? "2" : "1").charCodeAt(0);
        header.set(text(e.link), 157);
        break;
      case "dir":
      case "file":
      case undefined:
        if (e.kind === undefined || e.kind === "file") header.set(text((e.executable === true ? "0000755" : "0000644") + "\0"), 100);
        break;
    }
    header.fill(0x20, 148, 156);
    let sum = 0;
    for (const b of header) sum += b;
    header.set(text(`${sum.toString(8).padStart(6, "0")}\0 `), 148);
    parts.push(header, body, pad(body.length));
  }
  parts.push(new Uint8Array(1024));
  return concat(parts);
}

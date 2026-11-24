// Spec: 0002-anyfs-onedrive-store FR-007
/**
 * The names OneDrive keeps, and the path of an item: a segment may not hold a character of `" * : < > ? / \ |`, may not begin with a space nor end with a space or a dot, and may not be a name of a device (`CON`,
 * `PRN`, `AUX`, `NUL`, `COM0` to `COM9`, `LPT0` to `LPT9`, with or without an extension), `.lock`, `desktop.ini`, `_vti_`, or begin with `~$`. A path of the store is mapped to the address Graph takes for an item below a
 * drive (`/me/drive/root:/a/b`), each segment written as a URL part.
 *
 * @example
 * ```ts
 * import { segmentProblem } from "./names.ts";
 * segmentProblem("report.txt"); // undefined
 * segmentProblem("a:b"); // "a character of \" * : < > ? / \\ | is not in a name of OneDrive"
 * ```
 *
 * @module
 */

const FORBIDDEN = /["*:<>?/\\|]/u;
const DEVICE = /^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\..*)?$/iu;
const RESERVED = new Set([".lock", "desktop.ini", "_vti_"]);

/** Why a segment is not a name of OneDrive, or nothing where it is one. */
export function segmentProblem(segment: string): string | undefined {
  if (segment === "" || segment === "." || segment === "..") return "an empty segment and . and .. are not names";
  if (FORBIDDEN.test(segment)) return `a character of " * : < > ? / \\ | is not in a name of OneDrive`;
  if (segment.startsWith(" ") || segment.endsWith(" ") || segment.endsWith(".")) return "a name of OneDrive does not begin with a space or end with a space or a dot";
  if (DEVICE.test(segment)) return `${segment} is the name of a device`;
  if (RESERVED.has(segment.toLowerCase()) || segment.toLowerCase().startsWith("_vti_") || segment.startsWith("~$")) return `${segment} is a name OneDrive keeps for itself`;
  return undefined;
}

/** The reason a path is not one OneDrive keeps, or nothing where it is. */
export function pathProblem(path: string): string | undefined {
  for (const s of path.split("/")) {
    const why = segmentProblem(s);
    if (why !== undefined) return why;
  }
  return undefined;
}

/** A segment as a part of a URL. */
export const urlPart = (segment: string): string => encodeURIComponent(segment).replaceAll("'", "%27");

/** The part of an address that names a drive: `me/drive` for the signed-in account, `drives/ID` for another. */
export const driveRoot = (drive: string): string => (drive === "me" ? "/me/drive" : `/drives/${urlPart(drive)}`);

/** The address of an item (a file or a folder) below a drive, by the segments of its path from the root of the drive; the root of the drive where there are none. */
export function itemAddress(drive: string, segments: readonly string[]): string {
  return segments.length === 0 ? `${driveRoot(drive)}/root` : `${driveRoot(drive)}/root:/${segments.map(urlPart).join("/")}`;
}

/** The address of the content of a file: the item and `:/content`. */
export const contentAddress = (drive: string, segments: readonly string[]): string => `${itemAddress(drive, segments)}:/content`;

/** The address of the children of a folder. */
export const childrenAddress = (drive: string, segments: readonly string[]): string => (segments.length === 0 ? `${driveRoot(drive)}/root/children` : `${itemAddress(drive, segments)}:/children`);

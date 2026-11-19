// Spec: 0047-arcactl-init FR-003
/**
 * Changing a person's file safely (commons data 0047-arcactl-init FR-003): a change is planned first, as a value that says what the file is now, what it would be and the difference, and is applied
 * only where the person agreed. Applying it writes a temporary file beside the target and renames it over, so that a failure leaves the old file; keeps the file's mode (a new file gets the mode asked
 * for, `0600` for a password file); keeps a copy of what the file was the first time it is changed; and, where the file is a symbolic link (a dotfile manager's), writes through it to the file it
 * points at and says so. Where there is nothing to change it writes nothing.
 *
 * @module
 */
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { err, ok, type Result } from "@intellectual-frontiers/commons/ts/kernel";
import { type BlockError, type Style, withBlock, withoutBlock } from "./blocks.ts";

/** What a planned change does to a file. */
export type Action = "create" | "update" | "unchanged" | "remove";

/** A change to one file, planned and not made. */
export interface Change {
  /** The path the person named. */
  readonly path: string;
  /** The file that is written: the path, or where a symbolic link leads. */
  readonly target: string;
  readonly through: boolean;
  readonly action: Action;
  /** What the file is now, where it is there. */
  readonly before: string | undefined;
  readonly after: string;
  /** The mode a new file is made with. */
  readonly mode: number;
}

/** What is wrong with a change. */
export type FileError = { readonly kind: "block"; readonly path: string; readonly error: BlockError } | { readonly kind: "unreadable"; readonly path: string; readonly why: string };

/** What is wanted of a block: put in with a body, or taken out. */
export type Want = { readonly body: string } | "absent";

/**
 * Plans the change of one file for a block.
 *
 * @param path - the file
 * @param name - the block's name
 * @param style - the file's comment mark
 * @param want - the body to put in, or `absent` to take the block out
 * @param mode - the mode of a file that is made new
 * @returns the change, or why it cannot be planned
 */
export function planBlock(path: string, name: string, style: Style, want: Want, mode = 0o644): Result<Change, FileError> {
  let target = path;
  let through = false;
  let before: string | undefined;
  try {
    if (existsSync(path) || lstatSync(path, { throwIfNoEntry: false }) !== undefined) {
      if (lstatSync(path).isSymbolicLink()) {
        target = realpathSync(path);
        through = true;
      }
      if (statSync(target).isDirectory()) return err({ kind: "unreadable", path, why: "it is a directory" });
      before = readFileSync(target, "utf8");
    }
  } catch (thrown) {
    return err({ kind: "unreadable", path, why: thrown instanceof Error ? thrown.message : String(thrown) });
  }
  const text = before ?? "";
  const next = want === "absent" ? withoutBlock(text, name, style) : withBlock(text, name, style, want.body);
  if (next.kind === "err") return err({ kind: "block", path, error: next.error });
  const action: Action = before === undefined ? (want === "absent" || next.value === "" ? "unchanged" : "create") : next.value === before ? "unchanged" : "update";
  return ok({ path, target, through, action, before, after: next.value, mode });
}

/**
 * Plans the change of a file that `arcactl` owns whole (its state, its cache): the file is the text, or is made.
 *
 * @param path - the file
 * @param text - what the file is to hold
 * @param mode - the mode of a file that is made new
 * @returns the change
 */
export function planWhole(path: string, text: string, mode = 0o644): Result<Change, FileError> {
  let target = path;
  let through = false;
  let before: string | undefined;
  try {
    if (lstatSync(path, { throwIfNoEntry: false }) !== undefined) {
      if (lstatSync(path).isSymbolicLink()) {
        target = realpathSync(path);
        through = true;
      }
      if (statSync(target).isDirectory()) return err({ kind: "unreadable", path, why: "it is a directory" });
      before = readFileSync(target, "utf8");
    }
  } catch (thrown) {
    return err({ kind: "unreadable", path, why: thrown instanceof Error ? thrown.message : String(thrown) });
  }
  return ok({ path, target, through, action: before === undefined ? "create" : before === text ? "unchanged" : "update", before, after: text, mode });
}

/** Plans removing a file that `arcactl` owns whole: nothing where it is not there. A directory is refused. */
export function planRemoveFile(path: string): Result<Change, FileError> {
  try {
    const st = lstatSync(path, { throwIfNoEntry: false });
    if (st === undefined) return ok({ path, target: path, through: false, action: "unchanged", before: undefined, after: "", mode: 0o644 });
    if (st.isDirectory()) return err({ kind: "unreadable", path, why: "it is a directory" });
    return ok({ path, target: path, through: false, action: "remove", before: st.isSymbolicLink() ? "" : readFileSync(path, "utf8"), after: "", mode: st.mode & 0o7777 });
  } catch (thrown) {
    return err({ kind: "unreadable", path, why: thrown instanceof Error ? thrown.message : String(thrown) });
  }
}

/** The difference between two texts as lines, `-` for a line that goes and `+` for one that comes (a line common to both is left out, with a line of context kept around a change). */
export function diffOf(before: string | undefined, after: string): string {
  const a = before === undefined || before === "" ? [] : before.split(/\r?\n/);
  const b = after === "" ? [] : after.split(/\r?\n/);
  if (a.at(-1) === "") a.pop();
  if (b.at(-1) === "") b.pop();
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? (lcs[i + 1]![j + 1] as number) + 1 : Math.max(lcs[i + 1]![j] as number, lcs[i]![j + 1] as number);
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (j < m && (i === n || (lcs[i]![j + 1] as number) >= (lcs[i + 1]![j] as number))) out.push(`+ ${b[j++]}`);
    else out.push(`- ${a[i++]}`);
  }
  const keep = out.map((l, k) => l[0] !== " " || out[k - 1]?.[0] !== " " && out[k - 1] !== undefined || out[k + 1]?.[0] !== " " && out[k + 1] !== undefined);
  return out.filter((_, k) => keep[k]).join("\n");
}

/** What applying did. */
export interface Applied {
  readonly path: string;
  readonly action: Action;
  /** Where the copy of the file as it was is, where this made one. */
  readonly backup?: string;
}

/**
 * Makes a change: writes the file whole, by rename, keeping its mode, and keeps a copy the first time.
 *
 * @param change - the planned change
 * @returns what was done
 */
export function applyChange(change: Change): Applied {
  if (change.action === "unchanged") return { path: change.path, action: "unchanged" };
  if (change.action === "remove") {
    unlinkSync(change.path);
    return { path: change.path, action: "remove" };
  }
  mkdirSync(dirname(change.target), { recursive: true });
  let backup: string | undefined;
  let mode = change.mode;
  if (change.before !== undefined) {
    mode = statSync(change.target).mode & 0o7777;
    const copy = `${change.target}.arcactl-bak`;
    if (!existsSync(copy)) {
      writeFileSync(copy, change.before, { mode });
      backup = copy;
    }
  }
  const temp = join(dirname(change.target), `.${basename(change.target)}.arcactl-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(temp, change.after, { mode });
    chmodSync(temp, mode);
    renameSync(temp, change.target);
  } catch (thrown) {
    try {
      unlinkSync(temp);
    } catch {
      // nothing was made
    }
    throw thrown;
  }
  return { path: change.path, action: change.action, ...(backup === undefined ? {} : { backup }) };
}

/** Whether a password file's mode is one that libpq will use: it ignores a file that the group or others can read. */
export const pgpassModeOk = (mode: number): boolean => (mode & 0o077) === 0;

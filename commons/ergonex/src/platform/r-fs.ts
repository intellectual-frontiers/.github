// Spec: 0002-workspace-model FR-005
/**
 * The runtime's `fs`, by the package name of commons (commons 0027-commons-libraries FR-004): what this library uses of it, each name as the runtime's namespace gives it.
 *
 * @module
 */
import { fs } from "@intellectual-frontiers/commons/ts/runtime";
/** `fs.chmod`. */
export const chmod = fs.chmod;
/** `fs.exists`. */
export const exists = fs.exists;
/** `fs.existsSync`. */
export const existsSync = fs.existsSync;
/** `fs.listDirs`. */
export const listDirs = fs.listDirs;
/** `fs.lstat`. */
export const lstat = fs.lstat;
/** `fs.lstatSync`. */
export const lstatSync = fs.lstatSync;
/** `fs.makeTempDir`. */
export const makeTempDir = fs.makeTempDir;
/** `fs.mkdir`. */
export const mkdir = fs.mkdir;
/** `fs.readDirSync`. */
export const readDirSync = fs.readDirSync;
/** `fs.readFile`. */
export const readFile = fs.readFile;
/** `fs.readFileSync`. */
export const readFileSync = fs.readFileSync;
/** `fs.readTextFile`. */
export const readTextFile = fs.readTextFile;
/** `fs.readTextFileSync`. */
export const readTextFileSync = fs.readTextFileSync;
/** `fs.readTextOr`. */
export const readTextOr = fs.readTextOr;
/** `fs.realPath`. */
export const realPath = fs.realPath;
/** `fs.remove`. */
export const remove = fs.remove;
/** `fs.rename`. */
export const rename = fs.rename;
/** `fs.sha256File`. */
export const sha256File = fs.sha256File;
/** `fs.statSync`. */
export const statSync = fs.statSync;
/** `fs.symlink`. */
export const symlink = fs.symlink;
/** `fs.walkFiles`. */
export const walkFiles = fs.walkFiles;
/** `fs.withTempDir`. */
export const withTempDir = fs.withTempDir;
/** `fs.writeFile`. */
export const writeFile = fs.writeFile;
/** `fs.writeTextFile`. */
export const writeTextFile = fs.writeTextFile;

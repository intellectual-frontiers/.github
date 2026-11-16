/**
 * The API of each area, read through the TypeScript 7.1 programmatic API (commons 0011-documentation FR-010): every export of the area's
 * entry points, an alias followed to what it names, a namespace (`export * as fs`) walked into, with its kinds, the source file it is
 * declared in, its signature as the checker prints it (or, for a type or an interface, as its source writes it), the members of an
 * interface, and its TSDoc. It uses `typescript/async`, whose channel to the compiler runs under Bun and under Node; the compiler is the
 * one the package's `package.json` pins. The program is the repository's: its modules resolve from its own `node_modules`, and Node's
 * types are the first `@types/node` found in the repository's root, in a package's folder, or beside the generator.
 *
 * @limits
 * A type in a signature is printed as text and is not yet a link to its page. A signature is the checker's own printing, with no
 * truncation, so the computed types of SQL Aide's models can be thousands of characters long; the page folds them. Positions in the
 * source are read as the compiler gives them and checked against the declaration's name; where they do not match, the checker's printing
 * is shown instead of the source.
 *
 * @module
 */
import { API } from "typescript/async";
import { fs, path } from "@intellectual-frontiers/ifc-ts/runtime";
import { type DocComment, docOf, type DocTag, moduleComment } from "../tsdoc.ts";

/** What an export is. */
export type ExportKind = "function" | "const" | "class" | "interface" | "type" | "namespace" | "enum";

/** A member of an interface or a class: its name, its type and its TSDoc. */
export interface ApiMember {
  /** Its name. */
  readonly name: string;
  /** Its type, as the checker prints it. */
  readonly type: string;
  /** What its TSDoc says. */
  readonly doc: string;
  /** Whether it may be left out. */
  readonly optional: boolean;
}

/** An export of an area. */
export interface ApiExport {
  /** Its name, with its namespace before a dot where it is a namespace's (`fs.readTextFile`). */
  readonly name: string;
  /** What it is: more than one where a type and a value share the name. */
  readonly kinds: readonly ExportKind[];
  /** The file it is declared in, from the checkout's root. */
  readonly file: string;
  /** Its signature. */
  readonly signature: string;
  /** Its TSDoc. */
  readonly doc: DocComment;
  /** Whether it has any TSDoc at all. */
  readonly documented: boolean;
  /** The members of an interface or a class. */
  readonly members: readonly ApiMember[];
  /** The name it is declared with, where it is exported under another (`export { a as b }`). */
  readonly declared?: string;
}

/** The API of an area: its exports, in the order its entry points export them. */
export interface AreaApi {
  /** The area. */
  readonly slug: string;
  /** Its exports. */
  readonly exports: readonly ApiExport[];
}

/** An area to read: its name and its entry points, from the checkout's root. */
export interface AreaEntry {
  /** Its name in the site's addresses. */
  readonly slug: string;
  /** Its entry points, from the checkout's root. */
  readonly entryPoints: readonly string[];
}

// The flags of a symbol, as TypeScript numbers them.
const FUNCTION = 16;
const CLASS = 32;
const INTERFACE = 64;
const ENUM = 384;
const VALUE_MODULE = 512;
const TYPE_ALIAS = 524288;
const ALIAS = 2097152;
const VARIABLE = 3;
const OPTIONAL = 16777216;
// A type printed whole: TypeFormatFlags.NoTruncation.
const NO_TRUNCATION = 1;

/** The kinds of a symbol, by its flags. */
export function kindsOf(flags: number): ExportKind[] {
  const out: ExportKind[] = [];
  if (flags & FUNCTION) out.push("function");
  if (flags & CLASS) out.push("class");
  if (flags & INTERFACE) out.push("interface");
  if (flags & TYPE_ALIAS) out.push("type");
  if (flags & ENUM) out.push("enum");
  if (flags & VALUE_MODULE) out.push("namespace");
  if (flags & VARIABLE && !(flags & (FUNCTION | CLASS))) out.push("const");
  return out;
}

/**
 * A function's type as a declaration: `<T>(a: A) => R` becomes `function name<T>(a: A): R`; anything else is kept, after the name.
 *
 * @param name - the function's name
 * @param type - its type as the checker prints it
 */
export function functionSignature(name: string, type: string): string {
  let depth = 0;
  let arrow = -1;
  for (let i = 0; i < type.length; i++) {
    const c = type[i];
    if (c === "(" || c === "<" || c === "{" || c === "[") depth++;
    else if ((c === ")" || c === ">" || c === "}" || c === "]") && type[i - 1] !== "=") depth--;
    else if (c === "=" && type[i + 1] === ">" && depth === 0) {
      arrow = i;
      break;
    }
  }
  if (arrow < 0 || !/^[<(]/.test(type)) return `function ${name}: ${type}`;
  return `function ${name}${type.slice(0, arrow).trimEnd()}: ${type.slice(arrow + 2).trimStart()}`;
}

/** A declaration's source text without the comments and blank lines before it, nor `export` and `declare`. */
export function declarationText(source: string): string {
  let s = source;
  for (;;) {
    const t = s.replace(/^\s+/, "");
    if (t.startsWith("/*")) s = t.slice(t.indexOf("*/") + 2);
    else if (t.startsWith("//")) s = t.slice(t.indexOf("\n") + 1 || t.length);
    else {
      s = t;
      break;
    }
  }
  return s.replace(/^export\s+(default\s+)?/, "").replace(/^declare\s+/, "").trimEnd();
}

/** The head of an interface or a class: its source up to the brace that opens its body. */
function headOf(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "<" || c === "(") depth++;
    else if (c === ">" || c === ")") depth--;
    else if (c === "{" && depth === 0) return text.slice(0, i).trimEnd();
  }
  return text;
}

/** A tag as `tsdoc.ts` reads it, from the checker's tag. */
function tagOf(t: { readonly name: string; readonly text?: readonly { readonly text: string }[] | string | undefined }): DocTag {
  const text = typeof t.text === "string" ? t.text : (t.text ?? []).map((p) => p.text).join("");
  return { name: t.name, text };
}

/**
 * The folders of types a program of the repository reads: the first that hold `@types/node`, from the repository's root, the folders
 * given, and the generator's own.
 *
 * @param root - the repository's root
 * @param dirs - more folders, from the root (the packages')
 */
export function typeRootsOf(root: string, dirs: readonly string[] = []): string[] {
  const own = path.join(path.dirname(path.dirname(path.fromFileUrl(import.meta.url))), "node_modules/@types");
  const candidates = [path.join(root, "node_modules/@types"), ...dirs.map((d) => path.join(root, d, "node_modules/@types")), own];
  return [...new Set(candidates)].filter((d) => fs.existsSync(path.join(d, "node")));
}

/**
 * The API of each area, read in one program of all their entry points.
 *
 * @param root - the repository's root
 * @param areas - the areas
 * @param dirs - the folders, from the root, whose `node_modules/@types` may hold Node's types (the packages')
 */
export async function readApi(root: string, areas: readonly AreaEntry[], dirs: readonly string[] = []): Promise<AreaApi[]> {
  const abs = (rel: string): string => path.join(root, rel);
  const relOf = (file: string): string => path.relative(root, file).split(path.sep).join("/");
  const api = new API({ cwd: root });
  const entries = areas.flatMap((a) => a.entryPoints.map(abs));
  const typeRoots = typeRootsOf(root, dirs).slice(0, 1);
  const program = await api.createProgram(entries, {
    strict: true,
    target: 99,
    module: 199,
    moduleResolution: 99,
    allowImportingTsExtensions: true,
    noEmit: true,
    types: typeRoots.length === 0 ? [] : ["node"],
    typeRoots,
  });
  const checker = program.getProject().checker;
  const texts = new Map<string, string>();
  const textOf = (file: string): string => {
    const t = texts.get(file) ?? fs.readTextFileSync(file);
    texts.set(file, t);
    return t;
  };
  type Sym = Awaited<ReturnType<typeof checker.getExportsOfModule>>[number];

  const sourceOf = async (s: Sym): Promise<{ file: string; text: string | undefined }> => {
    const d = s.declarations[0];
    if (d === undefined) return { file: "", text: undefined };
    const file = String(d.path);
    const node = await d.resolve();
    const full = textOf(file);
    const pos = node !== undefined && "pos" in node && typeof node.pos === "number" ? node.pos : -1;
    const end = node !== undefined && "end" in node && typeof node.end === "number" ? node.end : -1;
    const text = pos >= 0 && end > pos ? declarationText(full.slice(pos, end)) : undefined;
    return { file, text: text !== undefined && text.includes(s.name) ? text : undefined };
  };

  const docOfSymbol = async (s: Sym): Promise<{ doc: DocComment; documented: boolean }> => {
    const summary = await checker.getDocumentationCommentOfSymbol(s);
    const tags = (await checker.getJsDocTagsOfSymbol(s)).map(tagOf);
    return { doc: docOf(summary, tags), documented: summary.trim() !== "" || tags.length > 0 };
  };

  const membersOf = async (s: Sym): Promise<ApiMember[]> => {
    const declared = await checker.getDeclaredTypeOfSymbol(s);
    const props = await checker.getPropertiesOfType(declared);
    const out: ApiMember[] = [];
    for (const p of props) {
      if (p.name.startsWith("__#") || p.name.startsWith("#")) continue;
      const optional = (p.flags & OPTIONAL) !== 0;
      const type = await checker.typeToString(await checker.getTypeOfSymbol(p), undefined, NO_TRUNCATION);
      out.push({
        name: p.name,
        type: optional ? type.replace(/ \| undefined$/, "") : type,
        doc: (await checker.getDocumentationCommentOfSymbol(p)).trim(),
        optional,
      });
    }
    return out;
  };

  const exportOf = async (name: string, s: Sym): Promise<ApiExport | undefined> => {
    const target = s.flags & ALIAS ? await checker.getAliasedSymbol(s) : s;
    const kinds = kindsOf(target.flags);
    if (kinds.length === 0) return undefined;
    const { file, text } = await sourceOf(target);
    const { doc, documented } = await docOfSymbol(target);
    let signature: string;
    let members: ApiMember[] = [];
    const typeText = async (): Promise<string> => checker.typeToString(await checker.getTypeOfSymbol(target), undefined, NO_TRUNCATION);
    if (kinds.includes("function")) signature = functionSignature(name.split(".").pop() ?? name, await typeText());
    else if (kinds.includes("interface") || kinds.includes("class")) {
      signature = text === undefined ? `${kinds.includes("class") ? "class" : "interface"} ${name}` : headOf(text);
      members = await membersOf(target);
      if (kinds.includes("const")) signature = `${signature}\nconst ${name}: ${await typeText()}`;
    } else if (kinds.includes("type")) {
      signature = text ?? `type ${name}`;
      if (kinds.includes("const")) signature = `${signature}\nconst ${name}: ${await typeText()}`;
    } else if (kinds.includes("const")) signature = `const ${name.split(".").pop() ?? name}: ${await typeText()}`;
    else signature = text ?? name;
    const declared = target.name !== (name.split(".").pop() ?? name) ? { declared: target.name } : {};
    return { name, kinds, file: relOf(file), signature, doc, documented, members, ...declared };
  };

  const out: AreaApi[] = [];
  for (const area of areas) {
    const exports: ApiExport[] = [];
    for (const entry of area.entryPoints) {
      const sf = await program.getSourceFile(abs(entry));
      const mod = sf === undefined ? undefined : await checker.getSymbolAtLocation(sf);
      if (mod === undefined) continue;
      for (const s of await checker.getExportsOfModule(mod)) {
        const target = s.flags & ALIAS ? await checker.getAliasedSymbol(s) : s;
        if (target.flags & VALUE_MODULE && target.declarations[0]?.path !== undefined && String(target.declarations[0].path).endsWith(".ts")) {
          const nsFile = String(target.declarations[0].path);
          const inner = await checker.getExportsOfModule(target);
          const doc = moduleComment(textOf(nsFile)) ?? docOf("", []);
          exports.push({ name: s.name, kinds: ["namespace"], file: relOf(nsFile), signature: `namespace ${s.name}`, doc, documented: doc.isModule, members: [] });
          for (const i of inner) {
            const e = await exportOf(`${s.name}.${i.name}`, i);
            if (e !== undefined) exports.push(e);
          }
          continue;
        }
        const e = await exportOf(s.name, s);
        if (e !== undefined) exports.push(e);
      }
    }
    const seen = new Set<string>();
    out.push({ slug: area.slug, exports: exports.filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true))) });
  }
  await api.close();
  return out;
}

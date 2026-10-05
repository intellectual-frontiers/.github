// The patterns in files that name a resource (0041-command-line FR-064 `presentation.references`, 0043-if-console FR-041). A command line
// declares each as a regular expression, a template for the argument of the noun's `show` command, and the globs of the files it applies
// to; this finds the matches in a file's text and holds no pattern, file name or field of its own.
import type { ReferenceDecl } from './presentation';

export interface ReferenceMatch {
  decl: ReferenceDecl;
  /** The argument of the noun's `show` command, from the template. */
  value: string;
  /** The text matched. */
  text: string;
  line: number;
  start: number;
  end: number;
}

/** A path glob as a regular expression: `**` crosses directories, `*` and `?` do not, `{a,b}` is a choice. */
export function globRegex(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i] ?? '';
    if (glob.startsWith('**/', i)) { out += '(?:.*/)?'; i += 2; continue; }
    if (glob.startsWith('**', i)) { out += '.*'; i += 1; continue; }
    if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else if (c === '{') out += '(?:';
    else if (c === '}') out += ')';
    else if (c === ',' && out.includes('(?:')) out += '|';
    else out += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/** Whether a path (relative to the repository, with `/`) is one of a reference's files. */
export const appliesTo = (decl: ReferenceDecl, relative: string): boolean => decl.files.some((g) => globRegex(g).test(relative));

/** The pattern as a JavaScript regular expression, or null where it is not one (a check of the command line already says so). */
export function compile(decl: ReferenceDecl): RegExp | null {
  try { return new RegExp(decl.pattern, 'g'); } catch { return null; }
}

/** The template `$1/$2` filled from a match's groups; `$$` is a dollar sign. */
export function fill(template: string, groups: string[]): string {
  return template.replace(/\$(\$|\d+)/g, (_m, d: string) => (d === '$' ? '$' : groups[Number(d)] ?? ''));
}

/** A register of a thousand rows is a thousand references; finding them reads the text once and calls no launcher. */
export const MAX_MATCHES = 5000;

export function findReferences(decls: ReferenceDecl[], text: string): ReferenceMatch[] {
  const out: ReferenceMatch[] = [];
  const lines = text.split(/\r?\n/);
  for (const decl of decls) {
    const re = compile(decl);
    if (!re) continue;
    for (let n = 0; n < lines.length && out.length < MAX_MATCHES; n += 1) {
      const line = lines[n] ?? '';
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        if (m[0] === '') { re.lastIndex += 1; continue; }
        out.push({ decl, value: fill(decl.value, [...m]), text: m[0], line: n, start: m.index, end: m.index + m[0].length });
        if (out.length >= MAX_MATCHES) break;
      }
    }
  }
  return out.sort((a, b) => a.line - b.line || a.start - b.start);
}

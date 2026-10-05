// Language features in the files a command line's references name (0041-command-line FR-064 `presentation.references`, 0043-if-console FR-041):
// a hover that shows the resource's words, its key facts and its actions as links; Go to Definition, to the path and line the resource gives;
// a CodeLens above the reference with its `lens` fields and a Run for the resource's check; and a document link that opens the resource's
// page. Each runs only the launcher's `show` command, only in a trusted workspace, and the extension holds no pattern, file name or field
// of its own: the references and the fields they name are the command line's.
import * as path from 'path';
import * as vscode from 'vscode';
import { escapeMarkdown as esc } from '../model/markdown';
import { display } from '../model/rows';
import type { ReferenceDecl } from '../model/presentation';
import { appliesTo, findReferences, type ReferenceMatch } from '../model/references';
import { actionsOf, type Action, type Doc } from '../model/wire';
import type { Handles } from '../services/handles';
import type { Repository } from '../services/repository';
import { link, markdown } from './tooltips';
import { t } from '../l10n';

/** What the features need of the extension. */
export interface LanguageHost {
  readonly handles: Handles;
  trusted(): boolean;
  repoForUri(uri: vscode.Uri): Repository | null;
}

interface Found { repo: Repository; matches: ReferenceMatch[] }

const dot = '  ·  ';
const MAX_ACTIONS = 3;

export class ReferenceLanguage implements vscode.Disposable {
  private registrations: vscode.Disposable[] = [];
  private cache: { key: string; found: Found } | null = null;

  constructor(private readonly host: LanguageHost) {}

  /** Provide the features in the files each repository's references name, and in no others. */
  register(repos: Repository[]): void {
    this.dispose();
    for (const repo of repos) {
      if (repo.state !== 'ready' || !repo.list || !repo.list.presentation.references.length) continue;
      const globs = [...new Set(repo.list.presentation.references.flatMap((r) => r.files))];
      const selector = globs.map((g): vscode.DocumentFilter => ({ scheme: 'file', pattern: new vscode.RelativePattern(repo.folder, g) }));
      const r = this.registrations;
      r.push(vscode.languages.registerHoverProvider(selector, { provideHover: (d, p) => this.hover(d, p) }));
      r.push(vscode.languages.registerDefinitionProvider(selector, { provideDefinition: (d, p) => this.definition(d, p) }));
      r.push(vscode.languages.registerCodeLensProvider(selector, { provideCodeLenses: (d) => this.lenses(d), resolveCodeLens: (l) => this.resolve(l) }));
      r.push(vscode.languages.registerDocumentLinkProvider(selector, { provideDocumentLinks: (d) => this.links(d), resolveDocumentLink: (l) => this.resolveLink(l) }));
    }
  }

  dispose(): void {
    for (const r of this.registrations) r.dispose();
    this.registrations = [];
    this.cache = null;
  }

  /** The references in a document, for the repository its file belongs to; none where the workspace is not trusted. */
  find(document: vscode.TextDocument): Found | null {
    if (!this.host.trusted()) return null;
    const repo = this.host.repoForUri(document.uri);
    if (!repo || repo.state !== 'ready' || !repo.list) return null;
    const key = `${document.uri.toString()}@${document.version}`;
    if (this.cache?.key === key) return this.cache.found;
    const relative = path.relative(repo.root, document.uri.fsPath).split(path.sep).join('/');
    const decls = repo.list.presentation.references.filter((d) => appliesTo(d, relative));
    const found: Found = { repo, matches: decls.length ? findReferences(decls, document.getText()) : [] };
    this.cache = { key, found };
    return found;
  }

  private at(document: vscode.TextDocument, position: vscode.Position): { repo: Repository; match: ReferenceMatch } | null {
    const found = this.find(document);
    const match = found?.matches.find((m) => m.line === position.line && position.character >= m.start && position.character <= m.end);
    return found && match ? { repo: found.repo, match } : null;
  }

  private rangeOf(m: ReferenceMatch): vscode.Range { return new vscode.Range(m.line, m.start, m.line, m.end); }

  private factsOf(decl: ReferenceDecl, shown: Doc): string[] {
    return decl.facts.map((f) => ({ f, v: display(shown.data[f]) })).filter((x) => x.v !== '').map((x) => `- **${esc(x.f)}:** ${esc(x.v, 240)}`);
  }

  async hover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    const hit = this.at(document, position);
    if (!hit) return undefined;
    const { repo, match } = hit;
    const shown = await repo.show(match.decl.noun, match.value);
    if (!shown) return undefined;
    const noun = repo.nounDecl(match.decl.noun);
    const md = markdown();
    md.appendMarkdown(`$(${noun?.icon ?? 'symbol-misc'}) **${esc(match.value)}**${dot}${esc(noun?.title ?? match.decl.noun)}\n\n`);
    // The actions come first, so that a long text never pushes them out of the hover's height.
    const links = [link(this.host.handles, '$(go-to-file) Open', { kind: 'open', repoKey: repo.key, noun: match.decl.noun, id: match.value }, 'Open this resource')];
    for (const a of actionsOf(shown).filter((x) => x.enabled).slice(0, MAX_ACTIONS)) {
      links.push(link(this.host.handles, `$(${a.category === 'check' ? 'play' : 'debug-start'}) ${esc(a.label)}`, { kind: 'action', repoKey: repo.key, action: a }, a.cli ?? a.label));
    }
    md.appendMarkdown(`${links.join(dot)}\n\n`);
    const text = match.decl.text ? display(shown.data[match.decl.text], 600) : '';
    if (text) md.appendMarkdown(`${esc(text, 600)}\n\n`);
    const facts = this.factsOf(match.decl, shown);
    if (facts.length) md.appendMarkdown(`${facts.join('\n')}\n\n`);
    return new vscode.Hover(md, this.rangeOf(match));
  }

  async definition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location | undefined> {
    const hit = this.at(document, position);
    if (!hit || hit.match.decl.definition.length < 1) return undefined;
    const { repo, match } = hit;
    const shown = await repo.show(match.decl.noun, match.value);
    if (!shown) return undefined;
    const [pathField, lineField] = match.decl.definition;
    const file = display(shown.data[pathField ?? '']);
    if (!file) return undefined;
    const abs = path.resolve(repo.root, file);
    const rel = path.relative(repo.root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
    const line = Number(display(shown.data[lineField ?? '']));
    return new vscode.Location(vscode.Uri.file(abs), new vscode.Position(Number.isFinite(line) && line > 0 ? line - 1 : 0, 0));
  }

  lenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const found = this.find(document);
    if (!found) return [];
    const seen = new Set<string>();
    const out: vscode.CodeLens[] = [];
    for (const m of found.matches) {
      const key = `${m.line}:${m.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const lens = new vscode.CodeLens(new vscode.Range(m.line, 0, m.line, 0));
      this.pending.set(lens, { repo: found.repo, match: m });
      out.push(lens);
    }
    return out;
  }

  private readonly pending = new WeakMap<vscode.CodeLens, { repo: Repository; match: ReferenceMatch }>();

  /** The lens's words (its `lens` fields), then a Run for the resource's check where it has one; resolved only for a lens the person can see.
   * With a Run the lens runs that check (through the one path every command takes); without it, it opens the resource. */
  async resolve(lens: vscode.CodeLens): Promise<vscode.CodeLens | undefined> {
    const held = this.pending.get(lens);
    if (!held) return undefined;
    const { repo, match } = held;
    const shown = await repo.show(match.decl.noun, match.value);
    if (!shown) return undefined;
    const noun = repo.nounDecl(match.decl.noun);
    const words = match.decl.lens.map((f) => display(shown.data[f])).filter(Boolean).join(' \u00b7 ') || match.value;
    const check: Action | undefined = actionsOf(shown).find((a) => a.enabled && a.category === 'check');
    const icon = noun?.icon ?? 'symbol-misc';
    lens.command = check
      ? { title: `$(${icon}) ${words} \u00b7 $(play) Run`, command: 'if-console.followLink', arguments: [this.host.handles.issue({ kind: 'action', repoKey: repo.key, action: check })], tooltip: check.cli ?? check.label }
      : { title: `$(${icon}) ${words}`, command: 'if-console.followLink', arguments: [this.host.handles.issue({ kind: 'open', repoKey: repo.key, noun: match.decl.noun, id: match.value })], tooltip: t('Open this resource') };
    return lens;
  }

  /** A link for each reference, its target made only when the editor asks for it (a register has a thousand and few are followed). */
  links(document: vscode.TextDocument): vscode.DocumentLink[] {
    const found = this.find(document);
    if (!found) return [];
    return found.matches.map((m) => {
      const l = new vscode.DocumentLink(this.rangeOf(m));
      l.tooltip = `Open ${m.value}`;
      this.linked.set(l, { repo: found.repo, match: m });
      return l;
    });
  }

  private readonly linked = new WeakMap<vscode.DocumentLink, { repo: Repository; match: ReferenceMatch }>();

  resolveLink(l: vscode.DocumentLink): vscode.DocumentLink | undefined {
    const held = this.linked.get(l);
    if (!held) return undefined;
    const handle = this.host.handles.issue({ kind: 'open', repoKey: held.repo.key, noun: held.match.decl.noun, id: held.match.value });
    l.target = vscode.Uri.parse(`command:if-console.followLink?${encodeURIComponent(JSON.stringify([handle]))}`);
    return l;
  }
}

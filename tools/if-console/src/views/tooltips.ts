// The rich tooltips (0043-if-console FR-038): Markdown with codicons, the key facts of a row as a list and command links for its actions.
// What a launcher returned is only ever inserted escaped (model/markdown.ts), and each link runs the one command `if-console.followLink` with a
// handle the extension issued, so that a tooltip can lead to nothing the extension did not offer.
import * as vscode from 'vscode';
import type { Suggestion } from '../model/home';
import { commandLink, codeBlock, escapeMarkdown as esc } from '../model/markdown';
import type { Status } from '../model/presentation';
import type { Row } from '../model/rows';
import { lookOf } from '../model/status';
import type { Finding } from '../model/wire';
import type { Handles, Payload } from '../services/handles';

/** The only commands a tooltip's links may run. */
export const LINK_COMMANDS = ['if-console.followLink', 'if-console.showHome'];

export function markdown(): vscode.MarkdownString {
  const md = new vscode.MarkdownString('', true);
  md.isTrusted = { enabledCommands: LINK_COMMANDS };
  md.supportHtml = false;
  return md;
}

export const link = (handles: Handles, label: string, payload: Payload, title: string): string => commandLink(label, 'if-console.followLink', [handles.issue(payload)], title);

const dot = '  ·  ';

export function suggestionTooltip(s: Suggestion, repoKey: string, handles: Handles): vscode.MarkdownString {
  const look = lookOf(s.status);
  const md = markdown();
  md.appendMarkdown(`$(${look.icon}) **${esc(s.label)}**\n\n`);
  if (s.why) md.appendMarkdown(`${esc(s.why, 800)}\n\n`);
  if (s.commandLine) md.appendMarkdown(`The exact command line:${codeBlock(s.commandLine)}`);
  if (s.yourself) md.appendMarkdown(`$(account) **What you do yourself:** ${esc(s.yourself, 800)}\n\n`);
  const links: string[] = [];
  if (s.run) links.push(link(handles, `$(play) ${esc(s.runLabel || 'Run')}`, { kind: 'run', repoKey, run: s.run }, s.commandLine ?? s.runLabel));
  if (s.commandLine) links.push(link(handles, '$(copy) Copy command line', { kind: 'copy', text: s.commandLine }, 'Put the command line on the clipboard'));
  if (links.length) md.appendMarkdown(links.join(dot));
  return md;
}

export function rowTooltip(row: Row, noun: string, repoKey: string, handles: Handles, opens: boolean): vscode.MarkdownString {
  const md = markdown();
  const icon = row.status ? lookOf(row.status).icon : 'symbol-misc';
  md.appendMarkdown(`$(${icon}) **${esc(row.label)}**${row.statusValue ? `${dot}${esc(row.statusValue)}` : ''}\n\n`);
  md.appendMarkdown(`${esc(noun)}${row.description ? `${dot}${esc(row.description)}` : ''}\n\n`);
  if (row.facts.length) md.appendMarkdown(`${row.facts.map((f) => `- **${esc(f.key)}:** ${esc(f.value, 500)}`).join('\n')}\n\n`);
  if (row.badge) md.appendMarkdown(`$(symbol-number) ${esc(row.badge)}\n\n`);
  const links: string[] = [];
  if (opens) links.push(link(handles, '$(go-to-file) Open', { kind: 'open', repoKey, noun: row.noun, id: row.id }, 'Open this resource'));
  if (opens) links.push(link(handles, '$(play) Actions…', { kind: 'primary', repoKey, noun: row.noun, id: row.id }, 'Choose one of its actions'));
  links.push(link(handles, '$(sparkle) Copy context', { kind: 'context', repoKey, noun: row.noun, id: row.id }, 'Copy what an AI agent needs to know about it'));
  md.appendMarkdown(links.join(dot));
  return md;
}

export function sectionTooltip(name: string, status: Status, summary: string, line: string, repoKey: string, handles: Handles): vscode.MarkdownString {
  const md = markdown();
  md.appendMarkdown(`$(${lookOf(status).icon}) **check ${esc(name)}**${dot}${esc(summary)}\n\n`);
  md.appendMarkdown(`The exact command line:${codeBlock(line)}`);
  md.appendMarkdown([link(handles, '$(play) Run', { kind: 'run', repoKey, run: { kind: 'section', section: name } }, line),
    link(handles, '$(copy) Copy command line', { kind: 'copy', text: line }, 'Put the command line on the clipboard')].join(dot));
  return md;
}

export function findingTooltip(f: Finding): vscode.MarkdownString {
  const md = markdown();
  md.appendMarkdown(`$(${lookOf(f.level === 'error' ? 'error' : f.level === 'warning' ? 'warning' : 'info').icon}) **${esc(f.message, 800)}**\n\n`);
  if (f.where) md.appendMarkdown(`$(file) ${esc(f.where)}\n\n`);
  if (f.next) md.appendMarkdown(`$(lightbulb) ${esc(f.next, 800)}`);
  return md;
}

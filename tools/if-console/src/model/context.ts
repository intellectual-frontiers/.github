// `context` for an agent and the help report (0043-if-console FR-018). Both are assembled from what the launcher returns, with
// secrets removed, and neither is sent anywhere: the person pastes the result themselves.
import type { Doc } from './wire';

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g, '[removed]'],
  [/\b(sk-[A-Za-z0-9_-]{16,})\b/g, '[removed]'],
  [/\b(AKIA[0-9A-Z]{16})\b/g, '[removed]'],
  [/\b(xox[abprs]-[A-Za-z0-9-]{10,})\b/g, '[removed]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[removed]'],
  [/(["']?(?:[A-Za-z0-9_-]*(?:token|secret|password|passwd|api[_-]?key|credential)[A-Za-z0-9_-]*)["']?\s*[:=]\s*)(["']?)[^\s"',}]+\2/gi, '$1[removed]'],
  [/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g, '$1 [removed] $2'],
];

export function redact(text: string, home?: string): string {
  let out = String(text);
  for (const [re, to] of SECRET_PATTERNS) out = out.replace(re, to);
  if (home && home.length > 1) out = out.split(home).join('~');
  return out;
}

export interface HelpReportInput {
  program: string;
  orchestrator: string;
  audience: string;
  contextDoc: Doc | null;
  doctorDoc: Doc | null;
  home?: string;
}

/** The report of FR-057: `context` together with `doctor`, with secrets removed. */
export function helpReport({ program, orchestrator, audience, contextDoc, doctorDoc, home }: HelpReportInput): string {
  const json = (d: Doc | null): string => JSON.stringify(d ? d.data : null, null, 2);
  const parts = [
    `# Help request for ${orchestrator}`, '',
    `Command line: ${program}`, `Audience stated by the command line: ${audience}`, '',
    '## doctor', '', '```json', json(doctorDoc), '```', '',
    '## context', '', '```json', json(contextDoc), '```', '',
  ];
  return redact(parts.join('\n'), home);
}

// Rich tooltips are Markdown (0043-if-console FR-038): codicons, key facts and command links. What a launcher returned is data and is
// never trusted as Markdown, so every value goes through `escapeMarkdown`, and the only command links in a tooltip are the ones built here
// with `commandLink`, so that nothing a launcher says can become a link that runs a command.

const SPECIAL = /[\\`*_{}[\]()#+\-.!|<>~$&:"'=@^%]/g;

/** Text as inert Markdown: every character with a meaning in Markdown, in a codicon (`$(name)`), or in a link is escaped. */
export function escapeMarkdown(text: string, max = 600): string {
  const cut = text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return cut.replace(/\r?\n/g, ' ').replace(SPECIAL, '\\$&');
}

/** A link that runs one of the extension's own commands, with arguments the extension built. */
export function commandLink(label: string, command: string, args: unknown[] = [], title = ''): string {
  const query = args.length ? `?${encodeURIComponent(JSON.stringify(args))}` : '';
  return `[${label}](command:${command}${query}${title ? ` "${escapeMarkdown(title)}"` : ''})`;
}

/** A fenced code block, safe against the text closing it. */
export function codeBlock(text: string): string {
  return `\n\`\`\`sh\n${text.replace(/```/g, "'''")}\n\`\`\`\n`;
}

/** Every `command:` target in a Markdown string, for a test that no data became a link. */
export function commandTargets(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(command:([^?)\s]+)/g)].map((m) => m[1] ?? '');
}

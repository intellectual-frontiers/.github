// MCP registration (0043-if-console FR-022): where VS Code lets an extension register an MCP server, register for each trusted repository
// whose command list includes `mcp serve` one standard-input-and-output server: the repository's launcher with the arguments `mcp serve`,
// the repository's root as its working directory, labelled with the orchestrator's name. The server's tools, resources and refusals are the
// launcher's; this changes nothing about them. Where VS Code cannot, say so and do nothing.
import * as vscode from 'vscode';
import type { Log } from './log';
import type { Repository } from './repository';

export const PROVIDER_ID = 'if-console.servers';

export function supported(): boolean {
  // Older VS Code has neither; the manifest's engine allows it, so this is looked for at run time.
  const lm = vscode.lm as Partial<typeof vscode.lm> | undefined;
  return typeof lm?.registerMcpServerDefinitionProvider === 'function' && typeof vscode.McpStdioServerDefinition === 'function';
}

/** The servers for these repositories: only a trusted, ready one whose list has `mcp serve`. */
export function definitions(repos: Repository[]): vscode.McpStdioServerDefinition[] {
  const out: vscode.McpStdioServerDefinition[] = [];
  for (const repo of repos) {
    if (repo.state !== 'ready' || !repo.trusted() || !repo.has('mcp serve')) continue;
    const def = new vscode.McpStdioServerDefinition(repo.displayName, repo.launcher.file, ['mcp', 'serve'], {}, '1');
    def.cwd = vscode.Uri.file(repo.root);
    out.push(def);
  }
  return out;
}

export class McpRegistration implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  disposable: vscode.Disposable | null = null;

  constructor(private readonly log: Log, private readonly repos: () => Repository[]) {}

  start(): boolean {
    if (!supported()) {
      this.log.info('This version of VS Code cannot register an MCP server from an extension, so none is registered. Nothing else changes.');
      return false;
    }
    this.disposable = vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
      onDidChangeMcpServerDefinitions: this.emitter.event,
      provideMcpServerDefinitions: () => Promise.resolve(definitions(this.repos())),
      resolveMcpServerDefinition: (server) => Promise.resolve(server),
    });
    return true;
  }

  changed(): void { this.emitter.fire(); }

  dispose(): void { this.disposable?.dispose(); this.emitter.dispose(); }
}

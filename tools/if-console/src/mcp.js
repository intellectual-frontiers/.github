'use strict';
// MCP registration (0043-if-console FR-022): where VS Code lets an extension register an MCP server, register for each trusted
// repository whose command list includes `mcp serve` one standard-input-and-output server: the repository's launcher with the
// arguments `mcp serve`, the repository's root as its working directory, labelled with the orchestrator's name. The server's
// tools, resources and refusals are the launcher's; this changes nothing about them. Where VS Code cannot, say so and do nothing.
const vscode = require('vscode');

const PROVIDER_ID = 'if-console.servers';

function supported() {
  return !!(vscode.lm && typeof vscode.lm.registerMcpServerDefinitionProvider === 'function' && typeof vscode.McpStdioServerDefinition === 'function');
}

// The servers for these repositories: only a trusted, ready one whose list has `mcp serve`.
function definitions(repos) {
  const out = [];
  for (const repo of repos) {
    if (repo.state !== 'ready' || !repo.trusted() || !repo.has('mcp serve')) continue;
    const def = new vscode.McpStdioServerDefinition(repo.displayName, repo.launcher.file, ['mcp', 'serve'], {}, '1');
    def.cwd = vscode.Uri.file(repo.root);
    out.push(def);
  }
  return out;
}

class McpRegistration {
  constructor(output, reposFn) {
    this.output = output;
    this.reposFn = reposFn;
    this.emitter = new vscode.EventEmitter();
    this.disposable = null;
    this.said = false;
  }
  start() {
    if (!supported()) {
      this.output.appendLine('This version of VS Code cannot register an MCP server from an extension, so none is registered. Nothing else changes.');
      return false;
    }
    this.disposable = vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
      onDidChangeMcpServerDefinitions: this.emitter.event,
      provideMcpServerDefinitions: async () => definitions(this.reposFn()),
      resolveMcpServerDefinition: async (server) => server,
    });
    return true;
  }
  changed() { this.emitter.fire(); }
  dispose() { if (this.disposable) this.disposable.dispose(); this.emitter.dispose(); }
}

module.exports = { McpRegistration, definitions, supported, PROVIDER_ID };

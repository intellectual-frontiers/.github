// What a repository's launcher said about itself is kept (see registry.ts) until it could have changed: the launcher is a file at the
// repository's root, and a person who edits or replaces it, or rebuilds the tool it starts, changes what `command list` answers. One file
// system watcher for each repository's launcher tells the extension to ask that repository again. The declaration, `.if-console.env`, is
// watched across the whole window by the extension itself, because a change there can add or remove a repository.
import * as path from 'path';
import * as vscode from 'vscode';
import type { Repository } from './repository';

export class RepositoryWatchers implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];

  constructor(private readonly onChange: (repo: Repository) => Promise<void>) {}

  /** Watch these repositories' launchers, and no others. */
  set(repos: Repository[]): void {
    this.dispose();
    for (const repo of repos) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(repo.folder, path.basename(repo.launcher.file)));
      const changed = (): void => { void this.onChange(repo); };
      watcher.onDidChange(changed);
      watcher.onDidCreate(changed);
      watcher.onDidDelete(changed);
      this.watchers.push(watcher);
    }
  }

  get count(): number { return this.watchers.length; }

  dispose(): void {
    for (const w of this.watchers) w.dispose();
    this.watchers = [];
  }
}

export const watchRepositories = (onChange: (repo: Repository) => Promise<void>): RepositoryWatchers => new RepositoryWatchers(onChange);

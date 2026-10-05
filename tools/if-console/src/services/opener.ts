// The one service that opens a resource (0043-if-console FR-036, FR-038): a click on a row, a link in a tooltip, a document link in a spec and
// a command's own result all come here, and here they become the command line that shows the resource and a renderer that draws it. Today the
// renderer is the launcher's own `--html` rendering in a webview; the resource panel of FR-042 replaces the renderer and nothing else.
import { argvFromFields } from '../model/forms';
import type { CommandDetail } from '../model/wire';
import type { Log } from './log';
import type { Repository } from './repository';

/** Draws a resource: given the command line that shows it, puts it in front of the person. */
export interface Renderer {
  render(repo: Repository, title: string, argv: string[]): Promise<void>;
}

export interface Target { command: string; fields: Record<string, unknown> }

export class ResourceOpener {
  constructor(private renderer: Renderer, private readonly log: Log, private readonly fail: (e: unknown) => void) {}

  /** The renderer the panel of FR-042 supplies in place of the page. */
  use(renderer: Renderer): void { this.renderer = renderer; }

  /** A link's resource: the command it names, with the values it carries. */
  async open(repo: Repository, link: Target): Promise<void> {
    try {
      const detail = await repo.detail(link.command);
      await this.argv(repo, detail, argvFromFields(detail, link.fields));
    } catch (e) { this.fail(e); }
  }

  /** A noun's resource by its id: its `show` command with the id as its argument. */
  async openRow(repo: Repository, noun: string, id: string): Promise<boolean> {
    if (!repo.has(`${noun} show`)) { this.log.info(`${noun} has no "show" command, so ${id} cannot be opened.`); return false; }
    try {
      const detail = await repo.detail(`${noun} show`);
      const arg = detail.arguments[0];
      if (!arg) return false;
      await this.argv(repo, detail, argvFromFields(detail, { [arg.name]: id }));
      return true;
    } catch (e) { this.fail(e); return false; }
  }

  /** The command line is already decided (a form's, or a result's): show what it gives. */
  async argv(repo: Repository, detail: CommandDetail, argv: string[]): Promise<void> {
    this.log.info(`opening ${detail.id}`);
    await this.renderer.render(repo, `${repo.name}: ${argv.join(' ')}`, argv);
  }
}

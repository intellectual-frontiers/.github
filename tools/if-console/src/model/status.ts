// The look of each status (0043-if-console FR-038): a codicon and a theme color for each word of the fixed vocabulary of 0041-command-line
// FR-064. The command line names the status; the editor chooses what it looks like, and uses the colors the Testing view uses, so that a
// theme's own contrast rules apply in light, dark and high-contrast.
import { t } from '../l10n';
import type { Status } from './presentation';

export interface StatusLook { icon: string; color: string; word: string }

export const STATUS_LOOK: Record<Status, StatusLook> = {
  ok: { icon: 'pass', color: 'testing.iconPassed', word: t('ok') },
  warning: { icon: 'warning', color: 'list.warningForeground', word: t('needs a look') },
  error: { icon: 'error', color: 'testing.iconFailed', word: t('needs fixing') },
  pending: { icon: 'circle-outline', color: 'testing.iconQueued', word: t('waiting for you') },
  skipped: { icon: 'circle-slash', color: 'testing.iconSkipped', word: t('skipped') },
  info: { icon: 'info', color: 'notificationsInfoIcon.foreground', word: t('for your information') },
  muted: { icon: 'circle-small-filled', color: 'disabledForeground', word: t('inactive') },
};

export const lookOf = (status: Status): StatusLook => STATUS_LOOK[status];

/** How bad a status is, for sorting what needs a person: the worst first. */
export const SEVERITY: Record<Status, number> = { error: 0, warning: 1, pending: 2, info: 3, skipped: 4, muted: 5, ok: 6 };

/** The codicon of each command category (0041 FR-015): what a button, a quick pick item and a tree row show for it. */
export const CATEGORY_ICON: Record<string, string> = { read: 'eye', check: 'checklist', record: 'note', build: 'tools', generate: 'sync', decision: 'law', setup: 'gear' };

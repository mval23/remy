import { emptyInterview, type InterviewState } from '../interview/types';
import { emptyBody, type BodyProfile } from '../planning/energy';
import { normalizePlanState, type PlanState } from './planState';

/**
 * A backup file: everything Remy keeps about one person, as JSON.
 * Lets someone move to a new device, or keep a copy, without signing in.
 */
export interface Backup {
  app: 'remy';
  /** 2 added the device-only health details; version 1 files still restore. */
  version: 2;
  exportedAt: number;
  interview: InterviewState;
  plan: PlanState;
  health: BodyProfile;
}

export const makeBackup = (interview: InterviewState, plan: PlanState, health: BodyProfile = emptyBody(), at = Date.now()): Backup => ({ app: 'remy', version: 2, exportedAt: at, interview, plan, health });

export function backupFileName(at = Date.now()): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `remy-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Read a backup file's text. Fills in fields added since the backup was made. */
export function readBackup(text: string): { ok: true; backup: Backup } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file isn’t a Remy backup. Choose the .json file Remy saved.' };
  }
  if (!isObject(data) || data.app !== 'remy') return { ok: false, reason: 'That file isn’t a Remy backup. Choose the .json file Remy saved.' };
  if (typeof data.version !== 'number' || data.version > 2) return { ok: false, reason: 'This backup comes from a newer version of Remy. Reload the app to update it, then try again.' };
  if (!isObject(data.interview) || !isObject(data.interview.answers)) return { ok: false, reason: 'This backup is missing your interview answers, so it can’t be restored.' };
  if (data.plan !== undefined && data.plan !== null && !isObject(data.plan)) return { ok: false, reason: 'This backup’s meal plan is damaged, so it can’t be restored.' };
  return {
    ok: true,
    backup: {
      app: 'remy',
      version: 2,
      exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : 0,
      interview: { ...emptyInterview(), ...(data.interview as Partial<InterviewState>) },
      plan: normalizePlanState(data.plan as Partial<PlanState> | null),
      health: { ...emptyBody(), ...(isObject(data.health) ? (data.health as Partial<BodyProfile>) : {}) },
    },
  };
}

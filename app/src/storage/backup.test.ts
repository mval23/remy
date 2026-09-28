import { describe, expect, it } from 'vitest';
import { fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { backupFileName, makeBackup, readBackup } from './backup';
import { emptyPlanState } from './planState';

describe('backup files', () => {
  it('round-trips a profile and plan', () => {
    const interview = fillWithSamples(emptyInterview());
    const plan = { ...emptyPlanState(), hungry: true };
    const r = readBackup(JSON.stringify(makeBackup(interview, plan, 42)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.backup.interview).toEqual(interview);
      expect(r.backup.plan).toEqual(plan);
      expect(r.backup.exportedAt).toBe(42);
    }
  });

  it('fills in fields added after an older backup was made', () => {
    const old = { app: 'remy', version: 1, interview: { answers: { goal: 'Eat better' } }, plan: { hungry: true } };
    const r = readBackup(JSON.stringify(old));
    expect(r.ok && r.backup.plan.learned).toEqual([]);
    expect(r.ok && r.backup.interview.skipped).toEqual({});
  });

  it('explains what’s wrong with a file that isn’t a backup', () => {
    expect(readBackup('not json')).toMatchObject({ ok: false });
    expect(readBackup('{"hello":1}')).toMatchObject({ ok: false, reason: expect.stringContaining('isn’t a Remy backup') });
    expect(readBackup('{"app":"remy","version":2,"interview":{"answers":{}}}')).toMatchObject({ ok: false, reason: expect.stringContaining('newer version') });
    expect(readBackup('{"app":"remy","version":1}')).toMatchObject({ ok: false, reason: expect.stringContaining('interview') });
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date(2026, 8, 7).getTime())).toBe('remy-backup-2026-09-07.json');
  });
});

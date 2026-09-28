import { describe, expect, it } from 'vitest';
import { fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { backupFileName, makeBackup, readBackup } from './backup';
import { emptyPlanState } from './planState';

describe('backup files', () => {
  it('round-trips a profile and plan', () => {
    const interview = fillWithSamples(emptyInterview());
    const plan = { ...emptyPlanState(), hungry: true, units: 'metric' as const };
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

  it('converts AI recipes from before Remy went metric, once', () => {
    const recipe = { id: 'ai_1', name: 'x', short: 'x', slot: 'Lunch', e: '🍗', serves: 2, fridge: 3, freezer: 0, foods: {}, ing: [['thighs', 1]], why: [], steps: [], reheat: '', tasks: [{ t: 'Roast', l: 'oven', m: 20, temp: 400 }], kcal: 1, pro: 1, prod: 0, plate: '' };
    const old = { app: 'remy', version: 1, interview: { answers: {} }, plan: { aiRecipes: { ai_1: recipe } } };
    const r = readBackup(JSON.stringify(old));
    if (!r.ok) throw new Error(r.reason);
    expect(r.backup.plan.aiRecipes.ai_1.ing).toEqual([['thighs', 450]]);
    expect(r.backup.plan.aiRecipes.ai_1.tasks[0].temp).toBe(200);
    expect(r.backup.plan.units).toBe('metric');
    const again = readBackup(JSON.stringify(makeBackup(r.backup.interview, r.backup.plan)));
    expect(again.ok && again.backup.plan.aiRecipes.ai_1.ing).toEqual([['thighs', 450]]);
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

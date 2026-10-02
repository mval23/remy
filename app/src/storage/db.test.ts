import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { emptyBody } from '../planning/energy';
import { deleteEverything, loadHealth, loadInterview, loadStamps, saveHealth, saveInterview } from './db';

describe('on-device storage', () => {
  it('starts empty, saves, reloads and deletes', async () => {
    expect(await loadInterview()).toEqual(emptyInterview());
    const s = fillWithSamples(emptyInterview(), 'taste');
    await saveInterview(s);
    expect(await loadInterview()).toEqual(s);
    await deleteEverything();
    expect(await loadInterview()).toEqual(emptyInterview());
  });

  it('keeps the estimate details in their own row, with no sync change time, and deletes them with everything', async () => {
    expect(await loadHealth()).toEqual(emptyBody());
    const before = await loadStamps();
    const b = { ...emptyBody(), consent: true, ageYears: 34, heightCm: 165, weightKg: 78, sex: 'female' as const, pal: 1.35 };
    await saveHealth(b);
    expect(await loadHealth()).toEqual(b);
    expect(await loadStamps()).toEqual(before);
    await deleteEverything();
    expect(await loadHealth()).toEqual(emptyBody());
  });
});

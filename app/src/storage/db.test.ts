import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fillWithSamples } from '../interview/engine';
import { emptyInterview } from '../interview/types';
import { deleteEverything, loadInterview, saveInterview } from './db';

describe('on-device storage', () => {
  it('starts empty, saves, reloads and deletes', async () => {
    expect(await loadInterview()).toEqual(emptyInterview());
    const s = fillWithSamples(emptyInterview(), 'taste');
    await saveInterview(s);
    expect(await loadInterview()).toEqual(s);
    await deleteEverything();
    expect(await loadInterview()).toEqual(emptyInterview());
  });
});

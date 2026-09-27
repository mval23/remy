import Dexie, { type Table } from 'dexie';
import { emptyInterview, type InterviewState } from '../interview/types';

/**
 * On-device storage (IndexedDB, through Dexie).
 * Data stays in this browser. Cloud sync comes in a later phase.
 */
interface Row {
  id: string;
  value: unknown;
}

class RemyDB extends Dexie {
  kv!: Table<Row, string>;
  constructor() {
    super('remy');
    this.version(1).stores({ kv: 'id' });
  }
}

export const db = new RemyDB();

const INTERVIEW = 'interview';

export async function loadInterview(): Promise<InterviewState> {
  try {
    const row = await db.kv.get(INTERVIEW);
    return row ? { ...emptyInterview(), ...(row.value as InterviewState) } : emptyInterview();
  } catch {
    // Storage can be blocked (private windows, strict settings). The app still works for this visit.
    return emptyInterview();
  }
}

export async function saveInterview(state: InterviewState): Promise<void> {
  try {
    await db.kv.put({ id: INTERVIEW, value: state });
  } catch {
    /* see loadInterview */
  }
}

export async function deleteEverything(): Promise<void> {
  try {
    await db.kv.clear();
  } catch {
    /* see loadInterview */
  }
}

import { beforeEach } from 'vitest';
import { applyRemoved, applySlots } from './planning/data/recipes';

// Tests run against the full recipe library as written, whatever the owner deleted or moved on the menu page
// (removed.json, slots.json):
// now, for plans built when a test file loads, and before each test.
const reset = () => {
  applyRemoved([]);
  applySlots({});
};
reset();
beforeEach(reset);

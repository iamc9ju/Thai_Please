import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuestsService } from '../dist/quests/quests.service.js';

// Run after `build`: exercise the actual compiled module-relative policy lookup.
// Construction loads and validates the JSON; no database or provider call occurs.
test('compiled QuestsService can load its packaged policy', () => {
  assert.doesNotThrow(() => new QuestsService({}, {}, {}));
});

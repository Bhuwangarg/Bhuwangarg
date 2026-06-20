// Basic smoke tests for the report aggregation and provider. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchChallans } from '../src/providers/mock.js';

test('mock provider returns deterministic challans for a vehicle', async () => {
  const a = await fetchChallans('RJ14PA1234');
  const b = await fetchChallans('RJ14PA1234');
  assert.deepEqual(a, b, 'same vehicle should yield identical data');
  assert.ok(Array.isArray(a));
  for (const c of a) {
    assert.ok(c.id && c.date && typeof c.amount === 'number');
    assert.match(c.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('different vehicles produce different data', async () => {
  const a = await fetchChallans('RJ14PA1234');
  const b = await fetchChallans('HR55AA9090');
  assert.notDeepEqual(a, b);
});

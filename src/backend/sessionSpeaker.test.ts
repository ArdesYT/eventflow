import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolConnection } from 'mariadb';
import { resolveSessionSpeakerId } from './sessionSpeaker';

function speakerCatalog(ids: number[]) {
  const queries: { sql: string; values: number[] }[] = [];
  const conn = {
    query: async (sql: string, values: number[]) => {
      queries.push({ sql, values });
      assert.match(sql, /^SELECT /, 'Session writes must not create or modify speakers');
      return ids.includes(values[0]) ? [{ id: values[0] }] : [];
    },
  } as Pick<PoolConnection, 'query'>;
  return { conn, queries };
}

test('a session selects an existing speaker without modifying the catalog', async () => {
  const { conn, queries } = speakerCatalog([12]);
  assert.equal(await resolveSessionSpeakerId(conn, 12), 12);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].values, [12]);
});

test('an unknown speaker is rejected instead of creating or choosing a fallback', async () => {
  const { conn, queries } = speakerCatalog([1]);
  await assert.rejects(resolveSessionSpeakerId(conn, 99), /INVALID_SPEAKER/);
  assert.equal(queries.length, 1);
});

test('missing, custom, fractional and invalid speaker IDs never query or mutate the catalog', async () => {
  const { conn, queries } = speakerCatalog([1]);
  for (const id of [undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(resolveSessionSpeakerId(conn, id), /INVALID_SPEAKER/);
  }
  assert.equal(queries.length, 0);
});

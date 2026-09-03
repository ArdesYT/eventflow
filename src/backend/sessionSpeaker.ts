import type { PoolConnection } from 'mariadb';

/** Előadás mentése csak meglévő előadót választhat; a katalógust a speakers API kezeli. */
export async function resolveSessionSpeakerId(
  conn: Pick<PoolConnection, 'query'>,
  speakerId: number | undefined,
): Promise<number> {
  const id = Number(speakerId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('INVALID_SPEAKER');
  const rows = await conn.query('SELECT id FROM speakers WHERE id = ?', [id]);
  if (!rows.length) throw new Error('INVALID_SPEAKER');
  return Number(rows[0].id);
}

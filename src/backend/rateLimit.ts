/**
 * =============================================================================
 * rateLimit.ts — Egyszerű memória-alapú rate limiter
 * =============================================================================
 *
 * IP + útvonal kulcson számolja a kéréseket egy időablakon belül.
 * Jelenleg főleg auth végpontokon használjuk (brute-force védelem).
 *
 * Korlát: egy processz memóriájában él — több szerver/instance esetén
 * nem osztozik (production-ban Redis ajánlott helyette).
 * =============================================================================
 */

import type { Request, Response, NextFunction } from 'express';

/** Egy IP+path páros számlálója és ablak vége. */
interface Bucket {
  count: number;   // eddigi kérések száma ebben az ablakban
  resetAt: number; // timestamp (ms) — utána új ablak indul
}

/** Globális tároló: kulcs = "ip:path" */
const buckets = new Map<string, Bucket>();

/**
 * Rate limiter middleware factory.
 *
 * @param maxRequests — max kérés az ablakon belül
 * @param windowMs — ablak hossza milliszekundumban (pl. 15 * 60 * 1000 = 15 perc)
 *
 * 429 Too Many Requests ha túllépi a limitet.
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    // Új ablak, ha még nincs bucket vagy lejárt az előző
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > maxRequests) {
      res.status(429).json({ message: 'Túl sok kérés. Próbálja újra később.' });
      return;
    }
    next();
  };
}

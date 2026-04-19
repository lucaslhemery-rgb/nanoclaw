/**
 * Rate-limiter for outbound messages.
 * Deduplicates identical messages per JID within a time window
 * to prevent error spam (e.g. repeated 401s flooding Telegram).
 */

import { logger } from './logger.js';

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // cleanup stale entries every 10 min

interface DedupEntry {
  count: number;
  firstSeen: number;
  lastSeen: number;
}

// Key: `${jid}::${message}` → entry
const seen = new Map<string, DedupEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of seen) {
      if (now - entry.lastSeen > WINDOW_MS * 2) {
        seen.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

/**
 * Check if a message should be sent or suppressed.
 * Returns { send: true } if the message should go through,
 * or { send: false, suppressed: number } if it's a duplicate.
 *
 * When the window expires and a new identical message arrives,
 * it sends with a suppression summary appended.
 */
export function shouldSend(
  jid: string,
  message: string,
): { send: true; suffix?: string } | { send: false } {
  ensureCleanup();

  const key = `${jid}::${message}`;
  const now = Date.now();
  const entry = seen.get(key);

  if (!entry || now - entry.firstSeen > WINDOW_MS) {
    // New message or window expired
    const suppressedCount = entry?.count ?? 0;
    seen.set(key, { count: 1, firstSeen: now, lastSeen: now });

    if (suppressedCount > 1) {
      // Window just expired: let this one through with a summary
      const suffix = `\n\n_(${suppressedCount - 1} message(s) identique(s) supprimé(s) dans les 5 dernières min)_`;
      logger.info(
        { jid, suppressed: suppressedCount - 1 },
        'Dedup window expired, flushing summary',
      );
      return { send: true, suffix };
    }
    return { send: true };
  }

  // Duplicate within window
  entry.count++;
  entry.lastSeen = now;
  logger.debug(
    { jid, count: entry.count },
    'Message deduplicated (suppressed)',
  );
  return { send: false };
}

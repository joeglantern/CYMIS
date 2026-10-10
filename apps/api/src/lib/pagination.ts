import { z } from 'zod';
import { BadRequestError } from './errors.js';

// Ids are UUIDv7, which sort by time, so the cursor is simply the last id seen.
// It is wrapped in base64url so clients treat it as opaque.

const CursorPayload = z.object({ id: z.uuid() });

export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    const parsed = CursorPayload.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
    return parsed.id;
  } catch {
    throw new BadRequestError('The page cursor is not valid', 'bad_cursor');
  }
}

/**
 * Takes rows fetched with `take: limit + 1` and splits off the extra row to
 * decide whether there is a next page.
 */
export function pageOf<T extends { id: string }>(rows: T[], limit: number): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(last.id) : null };
}

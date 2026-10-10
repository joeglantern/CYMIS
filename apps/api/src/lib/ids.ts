import { v7 } from 'uuid';

/** Time ordered UUID. Sorting by id is the same as sorting by creation time. */
export function newId(): string {
  return v7();
}

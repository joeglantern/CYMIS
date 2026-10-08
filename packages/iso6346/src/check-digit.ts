// ISO 6346 container numbers: 3 letter owner code, 1 letter category
// (U, J or Z), 6 digit serial, 1 check digit. Example: CSQU 305438 3.

export const CATEGORY_IDENTIFIERS = ['U', 'J', 'Z'] as const;
export type CategoryIdentifier = (typeof CATEGORY_IDENTIFIERS)[number];

/** Strict shape of a full container number, after normalising. */
export const CONTAINER_NUMBER_PATTERN = /^[A-Z]{3}[UJZ]\d{7}$/;

/**
 * Letter values from the standard. Counting starts at A = 10 and skips every
 * multiple of 11 (11, 22, 33), so B = 12, K = 21, L = 23, U = 32, V = 34, Z = 38.
 */
export const LETTER_VALUES: Readonly<Record<string, number>> = (() => {
  const values: Record<string, number> = {};
  let value = 10;
  for (let code = 65; code <= 90; code++) {
    if (value % 11 === 0) value++;
    values[String.fromCharCode(code)] = value;
    value++;
  }
  return Object.freeze(values);
})();

/** Uppercases and removes everything that is not a letter or digit. */
export function normalise(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function charValue(ch: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  const v = LETTER_VALUES[ch];
  if (v === undefined) throw new Error(`Invalid character "${ch}" in container number`);
  return v;
}

/**
 * Check digit for the first 10 characters (owner code, category, serial).
 * Returns 0 to 9. A remainder of 10 maps to 0, as the standard says.
 */
export function computeCheckDigit(first10: string): number {
  const s = normalise(first10);
  if (!/^[A-Z]{4}\d{6}$/.test(s)) {
    throw new Error('Expected 4 letters followed by 6 digits');
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += charValue(s[i] as string) * 2 ** i;
  }
  return (sum % 11) % 10;
}

/** True when the input is a well formed container number with a correct check digit. */
export function isValidContainerNumber(input: string): boolean {
  const s = normalise(input);
  if (!CONTAINER_NUMBER_PATTERN.test(s)) return false;
  return computeCheckDigit(s.slice(0, 10)) === Number(s[10]);
}

export interface ContainerNumberParts {
  ownerCode: string;
  category: CategoryIdentifier;
  serial: string;
  checkDigit: number;
}

/** Splits a well formed number into its parts. Does not check the digit. */
export function parseContainerNumber(input: string): ContainerNumberParts | null {
  const s = normalise(input);
  if (!CONTAINER_NUMBER_PATTERN.test(s)) return null;
  return {
    ownerCode: s.slice(0, 3),
    category: s[3] as CategoryIdentifier,
    serial: s.slice(4, 10),
    checkDigit: Number(s[10]),
  };
}

/** "CSQU3054383" becomes "CSQU 305438 3". Returns the input unchanged if it is not well formed. */
export function formatContainerNumber(input: string): string {
  const s = normalise(input);
  if (!CONTAINER_NUMBER_PATTERN.test(s)) return input;
  return `${s.slice(0, 4)} ${s.slice(4, 10)} ${s.slice(10)}`;
}

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; value: string; reason: 'format' | 'category' | 'check_digit'; expectedCheckDigit?: number };

/** Full validation with a reason, for showing the crew what is wrong. */
export function validateContainerNumber(input: string): ValidationResult {
  const s = normalise(input);
  if (!/^[A-Z]{4}\d{7}$/.test(s)) return { ok: false, value: s, reason: 'format' };
  if (!CATEGORY_IDENTIFIERS.includes(s[3] as CategoryIdentifier)) {
    return { ok: false, value: s, reason: 'category' };
  }
  const expected = computeCheckDigit(s.slice(0, 10));
  if (expected !== Number(s[10])) {
    return { ok: false, value: s, reason: 'check_digit', expectedCheckDigit: expected };
  }
  return { ok: true, value: s };
}

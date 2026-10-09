// Cleans raw OCR text into a container number candidate.
//
// Steps, as in the system plan:
// 1. Strip spaces and punctuation, join lines (owner code and serial are often
//    read as two lines).
// 2. Look for 4 letters + 7 digits, with the 4th letter U, J or Z.
// 3. Fix common confusions by position (letters that look like digits and the
//    other way round).
// 4. Check the digit. Only a passing check digit is safe to auto-accept.

import { CATEGORY_IDENTIFIERS, isValidContainerNumber, type CategoryIdentifier } from './check-digit.js';

/** In the letter part, digits that are usually misread letters. */
const DIGIT_TO_LETTER: Readonly<Record<string, string>> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '5': 'S',
  '6': 'G',
  '8': 'B',
};

/** In the digit part, letters that are usually misread digits. */
const LETTER_TO_DIGIT: Readonly<Record<string, string>> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  G: '6',
  B: '8',
};

export interface OcrCandidate {
  /** Cleaned 11 character number. */
  value: string;
  /** True if any character had to be swapped to make the pattern fit. */
  corrected: boolean;
  /** True if the check digit passes. */
  valid: boolean;
}

function fixWindow(window: string): { value: string; corrected: boolean } | null {
  let corrected = false;
  let out = '';
  for (let i = 0; i < 11; i++) {
    const ch = window[i] as string;
    if (i < 4) {
      if (ch >= 'A' && ch <= 'Z') {
        out += ch;
      } else {
        const fixed = DIGIT_TO_LETTER[ch];
        if (!fixed) return null;
        out += fixed;
        corrected = true;
      }
    } else {
      if (ch >= '0' && ch <= '9') {
        out += ch;
      } else {
        const fixed = LETTER_TO_DIGIT[ch];
        if (!fixed) return null;
        out += fixed;
        corrected = true;
      }
    }
  }
  if (!CATEGORY_IDENTIFIERS.includes(out[3] as CategoryIdentifier)) return null;
  return { value: out, corrected };
}

/**
 * Every 11 character window in the text that can be made to fit the pattern,
 * best first: valid before invalid, uncorrected before corrected.
 */
export function extractCandidates(rawText: string): OcrCandidate[] {
  const text = rawText.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const seen = new Set<string>();
  const results: OcrCandidate[] = [];

  for (let start = 0; start + 11 <= text.length; start++) {
    const fixed = fixWindow(text.slice(start, start + 11));
    if (!fixed || seen.has(fixed.value)) continue;
    seen.add(fixed.value);
    results.push({ ...fixed, valid: isValidContainerNumber(fixed.value) });
  }

  return results.sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? -1 : 1;
    if (a.corrected !== b.corrected) return a.corrected ? 1 : -1;
    return 0;
  });
}

/** The single best candidate, or null if nothing in the text fits. */
export function cleanOcrText(rawText: string): OcrCandidate | null {
  return extractCandidates(rawText)[0] ?? null;
}

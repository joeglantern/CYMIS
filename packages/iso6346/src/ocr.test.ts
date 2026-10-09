import { describe, expect, it } from 'vitest';
import { cleanOcrText, extractCandidates } from './ocr.js';

describe('cleanOcrText', () => {
  it('reads a clean number', () => {
    expect(cleanOcrText('CSQU3054383')).toEqual({ value: 'CSQU3054383', corrected: false, valid: true });
  });

  it('joins owner code and serial read on two lines', () => {
    expect(cleanOcrText('CSQU\n305438 3')).toMatchObject({ value: 'CSQU3054383', valid: true });
  });

  it('strips spaces, dashes and dots', () => {
    expect(cleanOcrText('CSQU - 305.438 - 3')).toMatchObject({ value: 'CSQU3054383', valid: true });
  });

  it('fixes digits read in the letter part', () => {
    // 0 read instead of O in OOLU
    expect(cleanOcrText('0OLU1548228')).toEqual({ value: 'OOLU1548228', corrected: true, valid: true });
  });

  it('fixes letters read in the digit part', () => {
    // O for 0, I for 1, S for 5, B for 8
    expect(cleanOcrText('CSQU3O54383')).toMatchObject({ value: 'CSQU3054383', corrected: true, valid: true });
    expect(cleanOcrText('MSKU9O7O323')).toMatchObject({ value: 'MSKU9070323', corrected: true, valid: true });
    expect(cleanOcrText('GESUS200O4B')).toMatchObject({ value: 'GESU5200048', corrected: true, valid: true });
  });

  it('finds the number inside other text on the door', () => {
    const text = 'MAX GROSS 30480 KG\nCSQU 305438 3\n22G1';
    expect(cleanOcrText(text)).toMatchObject({ value: 'CSQU3054383', valid: true });
  });

  it('returns an invalid candidate when the check digit fails', () => {
    expect(cleanOcrText('CSQU3054389')).toEqual({ value: 'CSQU3054389', corrected: false, valid: false });
  });

  it('returns null when nothing fits', () => {
    expect(cleanOcrText('')).toBeNull();
    expect(cleanOcrText('HELLO WORLD')).toBeNull();
    expect(cleanOcrText('ABCD1234567')).toBeNull(); // D is not a valid category
  });
});

describe('extractCandidates', () => {
  it('puts valid candidates first', () => {
    const list = extractCandidates('XCSQU3054383');
    expect(list[0]).toMatchObject({ value: 'CSQU3054383', valid: true });
  });

  it('does not return duplicates', () => {
    const list = extractCandidates('CSQU3054383 CSQU3054383');
    expect(list.filter((c) => c.value === 'CSQU3054383')).toHaveLength(1);
  });
});

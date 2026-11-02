import { describe, expect, it } from 'vitest';
import { Boundary, boundaryProblem, CreateSectionBody, UpdateSectionBody } from './facilities.js';

const square = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 1 },
  { lat: 1, lng: 1 },
  { lat: 1, lng: 0 },
];

describe('boundaryProblem', () => {
  it('accepts a triangle, a square and an odd shape', () => {
    expect(boundaryProblem(square.slice(0, 3))).toBeNull();
    expect(boundaryProblem(square)).toBeNull();
    const notch = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 4 },
      { lat: 4, lng: 4 },
      { lat: 2, lng: 2 },
      { lat: 4, lng: 0 },
    ];
    expect(boundaryProblem(notch)).toBeNull();
  });

  it('refuses too few corners', () => {
    expect(boundaryProblem([])).toMatch(/at least 3/);
    expect(boundaryProblem(square.slice(0, 2))).toMatch(/at least 3/);
  });

  it('refuses too many corners, and takes exactly 50', () => {
    const ring = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ lat: Math.sin((i / n) * 2 * Math.PI), lng: Math.cos((i / n) * 2 * Math.PI) }));
    expect(boundaryProblem(ring(50))).toBeNull();
    expect(boundaryProblem(ring(51))).toMatch(/at most 50/);
  });

  it('refuses a repeated corner, including closing the ring on the first', () => {
    expect(boundaryProblem([...square, square[0]!])).toMatch(/same place/);
  });

  it('refuses crossing edges', () => {
    const bowTie = [square[0]!, square[2]!, square[1]!, square[3]!];
    expect(boundaryProblem(bowTie)).toMatch(/cross/);
  });

  it('refuses an edge that touches another edge', () => {
    const touching = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 4 },
      { lat: 2, lng: 2 },
      { lat: 0, lng: 2 },
      { lat: -2, lng: 1 },
    ];
    expect(boundaryProblem(touching)).toMatch(/cross/);
  });

  it('refuses corners in a straight line', () => {
    expect(boundaryProblem([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }])).toMatch(/straight line/);
  });
});

describe('Boundary', () => {
  it('passes a good shape through', () => {
    expect(Boundary.parse(square)).toEqual(square);
  });

  it('refuses out of range values', () => {
    expect(Boundary.safeParse([{ lat: 91, lng: 0 }, ...square.slice(1)]).success).toBe(false);
    expect(Boundary.safeParse([{ lat: 0, lng: -181 }, ...square.slice(1)]).success).toBe(false);
    expect(Boundary.safeParse([{ lat: Number.NaN, lng: 0 }, ...square.slice(1)]).success).toBe(false);
  });

  it('takes the limits themselves', () => {
    expect(Boundary.safeParse([{ lat: 90, lng: 180 }, { lat: -90, lng: 180 }, { lat: 0, lng: -180 }]).success).toBe(true);
  });
});

describe('section bodies', () => {
  const base = { facilityId: '01a19b7f-4f1a-757d-91e9-35e132a653ee', code: 'b1', name: 'Block 1', kind: 'YARD_BLOCK' };

  it('an old client that sends no yard or shape still works', () => {
    const parsed = CreateSectionBody.parse(base);
    expect(parsed.yardId).toBeUndefined();
    expect(parsed.boundary).toBeUndefined();
    expect(parsed.locationCodes).toEqual([]);
  });

  it('null clears a yard or a shape', () => {
    expect(UpdateSectionBody.parse({ yardId: null, boundary: null })).toEqual({ yardId: null, boundary: null });
  });

  it('refuses a bad shape in a section body', () => {
    expect(UpdateSectionBody.safeParse({ boundary: square.slice(0, 2) }).success).toBe(false);
  });
});

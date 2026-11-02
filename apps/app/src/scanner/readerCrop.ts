/**
 * How much of each photo the browser reader looks at, as fractions of its
 * width and height, centred. The scan frame promises most of the screen, so
 * this nearly reaches the edges and only trims the rim, where text is rarely
 * sharp. Timed on sample images: at this size a read still fits inside one
 * scan tick on a desktop, and numbers near the top and bottom are read.
 * The phone's own reader (ML Kit) always reads the whole photo.
 */
export const READER_CROP = { width: 0.96, height: 0.92 } as const;

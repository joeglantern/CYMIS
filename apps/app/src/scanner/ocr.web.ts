// Text reading in the browser, so auto scan also works in the web app (on a
// tablet or a phone's browser) with no app install. Uses Tesseract, loaded
// only when the scanner first needs it. Slower than the phone's on-device
// reader, so the rim of each frame is trimmed (see readerCrop.ts) and it is cleaned up first.

import type { Worker as TessWorker } from 'tesseract.js';
import { READER_CROP } from './readerCrop';

export const ocrAvailable = typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof document !== 'undefined';

let worker: Promise<TessWorker> | null = null;

function getWorker(): Promise<TessWorker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const w = await createWorker('eng');
      await w.setParameters({
        // Container numbers only use capitals and digits.
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      return w;
    })().catch((err) => {
      worker = null;
      throw err;
    });
  }
  return worker;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read the frame'));
    img.src = uri;
  });
}

/** The frame without its rim, in grey with the contrast pushed up. */
function prepare(img: HTMLImageElement, invert: boolean): HTMLCanvasElement {
  const sw = img.width * READER_CROP.width;
  const sh = img.height * READER_CROP.height;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  const scale = Math.min(1, 1400 / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.filter = `grayscale(1) contrast(1.6)${invert ? ' invert(1)' : ''}`;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function readText(uri: string): Promise<string | null> {
  if (!ocrAvailable) return null;
  try {
    const [w, img] = await Promise.all([getWorker(), loadImage(uri)]);
    const first = await w.recognize(prepare(img, false));
    const text = first.data.text ?? '';
    // White paint on a dark box reads better flipped.
    if (/[A-Z]{3}[UJZ]\s*\d/.test(text.replace(/\s+/g, ' '))) return text;
    const second = await w.recognize(prepare(img, true));
    return `${text}\n${second.data.text ?? ''}`;
  } catch {
    return null;
  }
}

export const nativeOcr = false;

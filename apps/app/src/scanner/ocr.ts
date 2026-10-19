import { webReader } from './WebReader';

// Reading numbers on the phone. A development or store build uses Google ML
// Kit on the device: fast, and it works with no signal. Expo Go has no ML Kit,
// so frames go to a hidden reader instead (see WebReader.tsx).

type Recognize = (path: string) => Promise<{ text: string; blocks: { text: string; lines: { text: string }[] }[] }>;

let recognize: Recognize | null = null;
try {
  // Loaded lazily: requiring it in Expo Go would throw at start up.
  recognize = require('@infinitered/react-native-mlkit-text-recognition').recognizeText as Recognize;
} catch {
  recognize = null;
}

/** True when the phone has its own reader. Otherwise the hidden reader is used. */
export const nativeOcr = recognize !== null;

/** Auto scan is always on: native reader, or the hidden one once it is ready. */
export const ocrAvailable = true;

/**
 * All the text in a photo, lines joined. Door numbers are often split over
 * two or three lines (owner code, serial, check digit), so joining them lets
 * the ISO 6346 clean up find the full number across the breaks.
 */
export async function readText(uri: string): Promise<string | null> {
  if (!recognize) return webReader.read(uri);
  try {
    const res = await recognize(uri);
    const lines = res.blocks.flatMap((b) => b.lines.map((l) => l.text));
    return [res.text, lines.join(' ')].join('\n');
  } catch {
    return null;
  }
}

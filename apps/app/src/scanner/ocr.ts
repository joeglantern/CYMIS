// On-device text recognition with Google ML Kit, so reading works with no
// signal. It needs a development or store build; in Expo Go the native
// module is missing and the scanner falls back to typing.

type Recognize = (path: string) => Promise<{ text: string; blocks: { text: string; lines: { text: string }[] }[] }>;

let recognize: Recognize | null = null;
try {
  // Loaded lazily: requiring it in Expo Go would throw at start up.
  recognize = require('@infinitered/react-native-mlkit-text-recognition').recognizeText as Recognize;
} catch {
  recognize = null;
}

export const ocrAvailable = recognize !== null;

/**
 * All the text in a photo, lines joined. Door numbers are often split over
 * two or three lines (owner code, serial, check digit), so joining them lets
 * the ISO 6346 clean up find the full number across the breaks.
 */
export async function readText(uri: string): Promise<string | null> {
  if (!recognize) return null;
  try {
    const res = await recognize(uri);
    const lines = res.blocks.flatMap((b) => b.lines.map((l) => l.text));
    return [res.text, lines.join(' ')].join('\n');
  } catch {
    return null;
  }
}

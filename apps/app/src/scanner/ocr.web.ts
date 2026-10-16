// Browsers have no on-device text recognition we can count on. On the web
// the scanner takes the photo and the crew types the number; the server's
// second read still checks it.
export const ocrAvailable = false;

export async function readText(_uri: string): Promise<string | null> {
  return null;
}

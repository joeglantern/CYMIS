// Browser version: the photo is a blob URL from the camera. It is uploaded as
// is with fetch, since the browser already gives us a JPEG.

export interface KeptPhoto {
  uri: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export async function keepPhoto(sourceUri: string, _photoId: string, width: number, height: number): Promise<KeptPhoto> {
  const blob = await (await fetch(sourceUri)).blob();
  return { uri: sourceUri, sizeBytes: blob.size, width, height };
}

export async function uploadPhoto(uri: string, url: string, headers: Record<string, string>): Promise<void> {
  const blob = await (await fetch(uri)).blob();
  const res = await fetch(url, { method: 'PUT', headers, body: blob });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
}

export function deletePhoto(uri: string) {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}

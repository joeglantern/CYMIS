import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Door photos are shrunk to 1600 px on the long side and kept in the app's
// own folder until they upload, so clearing the cache never loses one.

const folder = () => {
  const dir = new Directory(Paths.document, 'scan-photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

export interface KeptPhoto {
  uri: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export async function keepPhoto(sourceUri: string, photoId: string, width: number, height: number): Promise<KeptPhoto> {
  const longSide = Math.max(width, height);
  const ctx = ImageManipulator.manipulate(sourceUri);
  if (longSide > 1600) {
    if (width >= height) ctx.resize({ width: 1600 });
    else ctx.resize({ height: 1600 });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  const target = new File(folder(), `${photoId}.jpg`);
  const tmp = new File(saved.uri);
  if (target.exists) target.delete();
  await tmp.move(target);
  return { uri: target.uri, sizeBytes: target.size, width: saved.width, height: saved.height };
}

export async function uploadPhoto(uri: string, url: string, headers: Record<string, string>): Promise<void> {
  const file = new File(uri);
  if (!file.exists) throw new Error('The photo file is missing on this phone.');
  const res = await file.upload(url, { httpMethod: 'PUT', headers, mimeType: 'image/jpeg' });
  if (res.status < 200 || res.status >= 300) throw new Error(`Upload failed with status ${res.status}`);
}

export function deletePhoto(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

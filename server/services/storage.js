import fs from 'node:fs/promises';
import cloudinary, { cloudinaryEnabled } from '../config/cloudinary.js';
import { HttpError } from '../middleware/error.js';

// Mimetype headers are client-supplied, so also check the file's magic bytes.
async function assertRealImage(filePath) {
  const fh = await fs.open(filePath, 'r');
  const buf = Buffer.alloc(12);
  await fh.read(buf, 0, 12, 0);
  await fh.close();
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  if (!(jpeg || png || webp)) throw new HttpError(400, 'File is not a valid jpeg, png or webp image');
}

export async function saveImage(file) {
  await assertRealImage(file.path);
  if (cloudinaryEnabled) {
    const r = await cloudinary.uploader.upload(file.path, { folder: 'findit' });
    // Local copy is temporary: processItem embeds from it, then deletes it.
    return { imageUrl: r.secure_url, imageLocalPath: file.path };
  }
  const base = process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
  return { imageUrl: `${base}/uploads/${file.filename}`, imageLocalPath: file.path };
}

export const removeLocal = (p) => (p ? fs.unlink(p).catch(() => {}) : Promise.resolve());

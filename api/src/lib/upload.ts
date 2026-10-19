import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { badRequest } from './http';

export const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads');

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_ITEM = 8;
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
  },
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_ITEM },
  fileFilter: (_req, file, callback) => {
    const isImage = file.mimetype.startsWith('image/') && ALLOWED_EXTENSIONS.has(path.extname(file.originalname).toLowerCase());
    if (!isImage) return callback(badRequest('Only JPG, PNG, GIF and WebP images are allowed.'));
    callback(null, true);
  },
});

export const uploadedPath = (file: Express.Multer.File): string => `/uploads/${file.filename}`;

export const removeUploads = async (urls: string[]): Promise<void> => {
  await Promise.all(
    urls
      .filter(url => url.startsWith('/uploads/'))
      .map(url => fs.rm(path.join(UPLOAD_DIR, path.basename(url)), { force: true }))
  );
};

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT, // Для Cloudflare R2 или MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // Нужно для MinIO/R2
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'list-uploads';

/**
 * Загружает файл в S3
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Формируем URL (для R2 может быть кастомный домен)
  const baseUrl = process.env.S3_PUBLIC_URL || `https://${BUCKET_NAME}.s3.${process.env.S3_REGION || 'auto'}.amazonaws.com`;
  const url = `${baseUrl}/${key}`;

  return { url, key };
}

/**
 * Удаляет файл из S3
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Генерирует уникальный ключ для файла
 */
export function generateFileKey(userId: bigint, fileType: string, originalName: string): string {
  const timestamp = Date.now();
  const ext = originalName.split('.').pop() || 'bin';
  return `uploads/${userId}/${fileType}/${timestamp}.${ext}`;
}

/**
 * Проверяет тип файла (разрешённые типы)
 */
export function isAllowedFileType(mimeType: string): boolean {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
  ];
  return allowedTypes.includes(mimeType);
}

/**
 * Проверяет размер файла (макс 50MB)
 */
export function isAllowedFileSize(size: number): boolean {
  const maxSize = 50 * 1024 * 1024; // 50MB
  return size <= maxSize;
}

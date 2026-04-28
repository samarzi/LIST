import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { uploadFile, generateFileKey, isAllowedFileType, isAllowedFileSize } from '../services/storage';

const router = Router();

// Настройка multer для обработки multipart/form-data
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

/**
 * Загрузка файла
 * POST /api/upload
 * Body: multipart/form-data с полем 'file'
 */
router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  // Проверка типа файла
  if (!isAllowedFileType(file.mimetype)) {
    return res.status(400).json({ error: 'Неподдерживаемый тип файла' });
  }

  // Проверка размера файла
  if (!isAllowedFileSize(file.size)) {
    return res.status(400).json({ error: 'Файл слишком большой (максимум 50MB)' });
  }

  try {
    // Определяем тип файла для организации в S3
    const fileType = file.mimetype.startsWith('image/') ? 'images' : 
                     file.mimetype.startsWith('video/') ? 'videos' : 'documents';

    // Генерируем уникальный ключ
    const key = generateFileKey(userId, fileType, file.originalname);

    // Загружаем в S3
    const result = await uploadFile(key, file.buffer, file.mimetype);

    return res.json({
      success: true,
      url: result.url,
      key: result.key,
      mimeType: file.mimetype,
      size: file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Ошибка при загрузке файла' });
  }
});

/**
 * Загрузка нескольких файлов
 * POST /api/upload/multiple
 * Body: multipart/form-data с полем 'files' (массив)
 */
router.post('/multiple', requireAuth, upload.array('files', 10), async (req: Request, res: Response) => {
  const userId = BigInt(req.user!.userId);
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Файлы не загружены' });
  }

  if (files.length > 6) {
    return res.status(400).json({ error: 'Максимум 6 файлов за раз' });
  }

  try {
    const uploadPromises = files.map(async (file) => {
      // Проверка типа файла
      if (!isAllowedFileType(file.mimetype)) {
        throw new Error(`Неподдерживаемый тип файла: ${file.originalname}`);
      }

      // Проверка размера файла
      if (!isAllowedFileSize(file.size)) {
        throw new Error(`Файл слишком большой: ${file.originalname}`);
      }

      const fileType = file.mimetype.startsWith('image/') ? 'images' : 
                       file.mimetype.startsWith('video/') ? 'videos' : 'documents';
      const key = generateFileKey(userId, fileType, file.originalname);

      return uploadFile(key, file.buffer, file.mimetype);
    });

    const results = await Promise.all(uploadPromises);

    return res.json({
      success: true,
      files: results.map(r => ({
        url: r.url,
        key: r.key,
      })),
    });
  } catch (error: any) {
    console.error('Multiple upload error:', error);
    return res.status(500).json({ error: error.message || 'Ошибка при загрузке файлов' });
  }
});

export default router;

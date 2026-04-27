import 'dotenv/config';

// Настройка тестовой среды
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

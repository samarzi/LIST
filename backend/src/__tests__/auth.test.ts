import request from 'supertest';
import express from 'express';
import authRouter from '../routes/auth';

describe('Auth API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth/telegram', () => {
    it('should return 400 if initData is missing', async () => {
      const response = await request(app)
        .post('/api/auth/telegram')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 if initData is invalid', async () => {
      const response = await request(app)
        .post('/api/auth/telegram')
        .send({ initData: 'invalid' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});

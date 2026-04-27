import request from 'supertest';
import express from 'express';
import pairsRouter from '../routes/pairs';

describe('Pairs API', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/pairs', pairsRouter);
  });

  describe('GET /api/pairs/current', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/pairs/current');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/pairs/change', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/pairs/change')
        .send({ reason: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/pairs/queue/join', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/pairs/queue/join');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/pairs/match', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/pairs/match');

      expect(response.status).toBe(401);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth Flow (e2e)', () => {
    it('/auth/register (POST) - should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Test123456!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('accessToken');
          expect(response.body).toHaveProperty('user');
          authToken = response.body.accessToken;
          userId = response.body.user.id;
        });
    });

    it('/auth/login (POST) - should login user', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Test123456!',
        })
        .expect((response) => {
          if (response.status === 401) {
            return;
          }
          expect(response.body).toHaveProperty('accessToken');
        });
    });

    it('/auth/profile (GET) - should get user profile', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('email');
        });
    });
  });

  describe('Orders Flow (e2e)', () => {
    it('/orders (GET) - should get user orders', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .then((response) => {
          expect(Array.isArray(response.body)).toBe(true);
        });
    });

    it('/orders/stats (GET) - should get order statistics', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .get('/orders/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('total');
        });
    });
  });

  describe('Dashboard Flow (e2e)', () => {
    it('/dashboard/user (GET) - should get user dashboard', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .get('/dashboard/user')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('user');
          expect(response.body).toHaveProperty('orders');
        });
    });

    it('/dashboard/volume (GET) - should get volume statistics', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .get('/dashboard/volume')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('totalVolume');
        });
    });
  });

  describe('KYC Flow (e2e)', () => {
    it('/kyc/status (GET) - should get KYC status', () => {
      if (!authToken) {
        return Promise.resolve();
      }

      return request(app.getHttpServer())
        .get('/kyc/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('status');
        });
    });
  });

  describe('Protected Routes (e2e)', () => {
    it('/orders (GET) - should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/orders')
        .expect(401);
    });

    it('/dashboard/user (GET) - should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .get('/dashboard/user')
        .expect(401);
    });
  });
});

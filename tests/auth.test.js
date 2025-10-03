const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../models');

describe('Authentication', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync({ force: true }); // make sure DB is fresh before all tests
  });

  beforeEach(async () => {
    // Truncate users to avoid duplicate emails between tests
    await User.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toHaveProperty('id');
    expect(response.body.data.user.email).toBe('test@example.com');
    expect(response.body.data).toHaveProperty('token');
    expect(response.body.data).toHaveProperty('refreshToken');
  });

  it('should login with valid credentials', async () => {
    // Register first
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        username: 'testuser'
      });

    // Then login
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('test@example.com');
    expect(response.body.data).toHaveProperty('token');
  });
});

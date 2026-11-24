const request = require('supertest');
const app = require('../app');

describe('Phase 1: Backend Foundation Tests', () => {
  it('GET /api/health should return 200 with service information and database status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('service', 'MedSync API');
    expect(res.body).toHaveProperty('database', 'connected');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/unknown-endpoint should return 404 with structured JSON error', async () => {
    const res = await request(app).get('/api/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Endpoint not found');
  });

  it('Helmet security headers should be attached to responses', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(res.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
  });

  it('CORS should permit requests from configured CLIENT_ORIGIN', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

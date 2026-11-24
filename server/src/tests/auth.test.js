const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const app = require('../app');
const { requireRole } = require('../middleware/role');
const { protect } = require('../middleware/auth');

// Dedicated test app for verifying RBAC middleware
const testApp = express();
testApp.use(cookieParser());
testApp.use(express.json());
testApp.get('/api/test/patient-only', protect, requireRole('patient'), (req, res) => {
  res.status(200).json({ access: 'granted', role: req.user.role });
});
testApp.get('/api/test/doctor-only', protect, requireRole('doctor'), (req, res) => {
  res.status(200).json({ access: 'granted', role: req.user.role });
});

describe('Phase 2: Authentication & Sessions Tests', () => {
  const patientData = {
    role: 'patient',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    password: 'password123',
    guardianPhone: '+1234567890',
  };

  const doctorData = {
    role: 'doctor',
    name: 'Dr. Gregory House',
    email: 'house@princeton.edu',
    password: 'diagnostician123',
    department: 'Diagnostic Medicine',
    yearsOfExperience: 20,
    phone: '+1987654321',
  };

  describe('POST /api/auth/register', () => {
    it('should register a new patient and set httpOnly session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(patientData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(patientData.email);
      expect(res.body.user.role).toBe('patient');
      expect(res.body.user.guardianPhone).toBe(patientData.guardianPhone);
      expect(res.body.user).not.toHaveProperty('passwordHash');

      // Check cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('medsync_token='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    });

    it('should register a new doctor with department and experience', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(doctorData);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('doctor');
      expect(res.body.user.department).toBe('Diagnostic Medicine');
      expect(res.body.user.yearsOfExperience).toBe(20);
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject registration if email is already registered', async () => {
      // Register first time
      await request(app).post('/api/auth/register').send(patientData);

      // Register second time with same email
      const res = await request(app)
        .post('/api/auth/register')
        .send(patientData);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('already exists');
    });

    it('should reject registration if password is fewer than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          ...patientData,
          email: 'shortpass@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('at least 8 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(patientData);
    });

    it('should authenticate user with valid credentials and return session cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: patientData.email,
          password: patientData.password,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(patientData.email);

      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.includes('medsync_token='))).toBe(true);
    });

    it('should return identical generic error for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: patientData.email,
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: 'Invalid email or password',
      });
    });

    it('should return identical generic error for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'anyPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: 'Invalid email or password',
      });
    });
  });

  describe('GET /api/auth/me & Sessions', () => {
    it('should return currently logged-in user profile with active cookie', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);

      const cookie = regRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe(patientData.email);
      expect(meRes.body.user.name).toBe(patientData.name);
    });

    it('should reject unauthenticated request to /api/auth/me', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Role-Based Access Control Middleware', () => {
    let patientCookie;
    let doctorCookie;

    beforeEach(async () => {
      const pRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);
      patientCookie = pRes.headers['set-cookie'];

      const dRes = await request(app)
        .post('/api/auth/register')
        .send(doctorData);
      doctorCookie = dRes.headers['set-cookie'];
    });

    it('should allow patient to access patient-only route and deny doctor', async () => {
      // Patient accessing patient route -> OK (200)
      const patientAccess = await request(testApp)
        .get('/api/test/patient-only')
        .set('Cookie', patientCookie);
      expect(patientAccess.status).toBe(200);
      expect(patientAccess.body.role).toBe('patient');

      // Doctor accessing patient route -> FORBIDDEN (403)
      const doctorAccess = await request(testApp)
        .get('/api/test/patient-only')
        .set('Cookie', doctorCookie);
      expect(doctorAccess.status).toBe(403);
      expect(doctorAccess.body.error).toContain('Access denied');
    });

    it('should allow doctor to access doctor-only route and deny patient', async () => {
      // Doctor accessing doctor route -> OK (200)
      const doctorAccess = await request(testApp)
        .get('/api/test/doctor-only')
        .set('Cookie', doctorCookie);
      expect(doctorAccess.status).toBe(200);
      expect(doctorAccess.body.role).toBe('doctor');

      // Patient accessing doctor route -> FORBIDDEN (403)
      const patientAccess = await request(testApp)
        .get('/api/test/doctor-only')
        .set('Cookie', patientCookie);
      expect(patientAccess.status).toBe(403);
      expect(patientAccess.body.error).toContain('Access denied');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear session cookie on logout', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Logged out successfully');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('medsync_token=;'))).toBe(true);
    });
  });
});

const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

describe('Phase 3: Profiles & Account Management Tests', () => {
  const patientData = {
    role: 'patient',
    name: 'Sarah Connor',
    email: 'sarah@resistance.org',
    password: 'password123',
    guardianPhone: '+1112223333',
  };

  const doctorData = {
    role: 'doctor',
    name: 'Dr. Leonard McCoy',
    email: 'bones@enterprise.starfleet',
    password: 'starfleetDoc123',
    department: 'Chief Medical Officer',
    yearsOfExperience: 15,
    phone: '+14445556666',
  };

  describe('PATCH /api/users/me (Profile Updates)', () => {
    it('should update patient profile fields (name, guardianPhone, theme)', async () => {
      // 1. Register patient
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);
      const cookie = regRes.headers['set-cookie'];

      // 2. Update profile
      const updateRes = await request(app)
        .patch('/api/users/me')
        .set('Cookie', cookie)
        .send({
          name: 'Sarah J. Connor',
          guardianPhone: '+19998887777',
          theme: 'dark',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.user.name).toBe('Sarah J. Connor');
      expect(updateRes.body.user.guardianPhone).toBe('+19998887777');
      expect(updateRes.body.user.theme).toBe('dark');
    });

    it('should update doctor profile fields (department, yearsOfExperience, phone)', async () => {
      // 1. Register doctor
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(doctorData);
      const cookie = regRes.headers['set-cookie'];

      // 2. Update profile
      const updateRes = await request(app)
        .patch('/api/users/me')
        .set('Cookie', cookie)
        .send({
          name: 'Dr. Leonard H. McCoy',
          department: 'Exobiology & Surgery',
          yearsOfExperience: 18,
          phone: '+17778889999',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.user.name).toBe('Dr. Leonard H. McCoy');
      expect(updateRes.body.user.department).toBe('Exobiology & Surgery');
      expect(updateRes.body.user.yearsOfExperience).toBe(18);
      expect(updateRes.body.user.phone).toBe('+17778889999');
    });

    it('should reject email change if new email is already in use by another user', async () => {
      // 1. Register user A
      await request(app).post('/api/auth/register').send(patientData);

      // 2. Register user B
      const regB = await request(app).post('/api/auth/register').send({
        ...doctorData,
        email: 'doctor_b@example.com',
      });
      const cookieB = regB.headers['set-cookie'];

      // 3. User B attempts to change email to User A's email
      const updateRes = await request(app)
        .patch('/api/users/me')
        .set('Cookie', cookieB)
        .send({ email: patientData.email });

      expect(updateRes.status).toBe(409);
      expect(updateRes.body.error).toContain('already exists');
    });
  });

  describe('PATCH /api/users/me/password (Password Change)', () => {
    it('should update password with correct current password and re-issue session cookie', async () => {
      // 1. Register user
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);
      const oldCookie = regRes.headers['set-cookie'];

      // 2. Wait 1 second to ensure new timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 3. Change password
      const changeRes = await request(app)
        .patch('/api/users/me/password')
        .set('Cookie', oldCookie)
        .send({
          currentPassword: 'password123',
          newPassword: 'newBrandNewPassword890',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.message).toContain('Password changed successfully');
      expect(changeRes.body).toHaveProperty('passwordChangedAt');

      // Check that a new cookie was set
      const newCookies = changeRes.headers['set-cookie'];
      expect(newCookies).toBeDefined();

      // 4. Verify login succeeds with the new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: patientData.email,
          password: 'newBrandNewPassword890',
        });
      expect(loginRes.status).toBe(200);

      // 5. Verify login fails with the old password
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: patientData.email,
          password: 'password123',
        });
      expect(oldLoginRes.status).toBe(401);
    });

    it('should reject password change if current password is incorrect', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);
      const cookie = regRes.headers['set-cookie'];

      const changeRes = await request(app)
        .patch('/api/users/me/password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'wrongPasswordNow',
          newPassword: 'newValidPassword890',
        });

      expect(changeRes.status).toBe(401);
      expect(changeRes.body.error).toContain('Current password is incorrect');
    });

    it('should reject password change if new password is under 8 characters', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);
      const cookie = regRes.headers['set-cookie'];

      const changeRes = await request(app)
        .patch('/api/users/me/password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'password123',
          newPassword: 'short',
        });

      expect(changeRes.status).toBe(400);
      expect(changeRes.body.error).toContain('at least 8 characters');
    });
  });

  describe('DELETE /api/users/me (Account Deletion)', () => {
    it('should permanently delete user account and clear cookie when valid password is provided', async () => {
      // 1. Register user
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);
      const cookie = regRes.headers['set-cookie'];
      const userId = regRes.body.user._id;

      // 2. Delete account
      const delRes = await request(app)
        .delete('/api/users/me')
        .set('Cookie', cookie)
        .send({ password: patientData.password });

      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toContain('permanently deleted');

      // Check cookie was expired
      const cookies = delRes.headers['set-cookie'];
      expect(cookies.some((c) => c.includes('medsync_token=;'))).toBe(true);

      // Verify user no longer exists in database
      const foundUser = await User.findById(userId);
      expect(foundUser).toBeNull();
    });

    it('should reject account deletion if password is incorrect', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(patientData);
      const cookie = regRes.headers['set-cookie'];
      const userId = regRes.body.user._id;

      const delRes = await request(app)
        .delete('/api/users/me')
        .set('Cookie', cookie)
        .send({ password: 'wrongPassword!' });

      expect(delRes.status).toBe(401);
      expect(delRes.body.error).toContain('Incorrect password');

      // Verify user still exists
      const foundUser = await User.findById(userId);
      expect(foundUser).not.toBeNull();
    });
  });
});

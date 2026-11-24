const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const app = require('../app');
const Share = require('../models/Share');
const Report = require('../models/Report');

describe('Phase 6: Sharing & Access Control Tests', () => {
  let samplePdfBuffer;
  let patientCookie;
  let patient2Cookie;
  let doctorCookie;
  let doctor2Cookie;
  let doctorUser;
  let doctor2User;
  let report1Id;
  let report2Id;

  beforeAll(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawText('Confidential Shared Medical File', { x: 50, y: 350 });
    samplePdfBuffer = Buffer.from(await pdfDoc.save());
  });

  beforeEach(async () => {
    // 1. Register Patient 1
    const p1Res = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'Arthur Dent',
      email: 'arthur.dent@hitchhiker.org',
      password: 'password123',
    });
    patientCookie = p1Res.headers['set-cookie'];

    // 2. Register Patient 2
    const p2Res = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'Ford Prefect',
      email: 'ford.prefect@hitchhiker.org',
      password: 'password123',
    });
    patient2Cookie = p2Res.headers['set-cookie'];

    // 3. Register Doctor 1
    const doc1Res = await request(app).post('/api/auth/register').send({
      role: 'doctor',
      name: 'Dr. Stephen Strange',
      email: 'strange@sanctum.org',
      password: 'mysticDoctor123',
      department: 'Neuro-Surgery',
    });
    doctorCookie = doc1Res.headers['set-cookie'];
    doctorUser = doc1Res.body.user;

    // 4. Register Doctor 2
    const doc2Res = await request(app).post('/api/auth/register').send({
      role: 'doctor',
      name: 'Dr. Leonard McCoy',
      email: 'mccoy@starfleet.org',
      password: 'spaceDoctor123',
      department: 'General Medicine',
    });
    doctor2Cookie = doc2Res.headers['set-cookie'];
    doctor2User = doc2Res.body.user;

    // 5. Upload 2 reports for Patient 1
    const r1 = await request(app)
      .post('/api/reports')
      .set('Cookie', patientCookie)
      .field('reason', 'Brain MRI scan')
      .field('doctorName', 'Dr. Stephen Strange')
      .field('visitDate', '2026-11-10')
      .field('type', 'Imaging')
      .attach('files', samplePdfBuffer, 'mri.pdf');
    report1Id = r1.body.report._id;

    const r2 = await request(app)
      .post('/api/reports')
      .set('Cookie', patientCookie)
      .field('reason', 'Blood Panel')
      .field('doctorName', 'Dr. Stephen Strange')
      .field('visitDate', '2026-11-20')
      .field('type', 'Lab report')
      .attach('files', samplePdfBuffer, 'blood.pdf');
    report2Id = r2.body.report._id;
  });

  describe('GET /api/doctors/search (Doctor Lookup)', () => {
    it('should find doctors by name substring and return profile details', async () => {
      const res = await request(app)
        .get('/api/doctors/search?q=Strange')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(200);
      expect(res.body.doctors).toHaveLength(1);
      expect(res.body.doctors[0].name).toBe('Dr. Stephen Strange');
      expect(res.body.doctors[0].department).toBe('Neuro-Surgery');
      expect(res.body.doctors[0].email).toBe('strange@sanctum.org');
    });

    it('should find doctors by email address query', async () => {
      const res = await request(app)
        .get('/api/doctors/search?q=mccoy@starfleet.org')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(200);
      expect(res.body.doctors).toHaveLength(1);
      expect(res.body.doctors[0].name).toBe('Dr. Leonard McCoy');
    });

    it('should return empty list if query is empty', async () => {
      const res = await request(app)
        .get('/api/doctors/search?q=')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(200);
      expect(res.body.doctors).toEqual([]);
    });
  });

  describe('GET /api/doctors/visited (Doctors Visited Aggregation)', () => {
    it('should aggregate doctor visit counts and last visit dates from reports', async () => {
      // Add a third report with a different doctor
      await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'Dermatology rash')
        .field('doctorName', 'Dr. Beverly Crusher')
        .field('visitDate', '2026-11-22')
        .field('type', 'Prescription')
        .attach('files', samplePdfBuffer, 'rash.pdf');

      const res = await request(app)
        .get('/api/doctors/visited')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('doctors');
      expect(res.body.doctors.length).toBe(2);

      // Most recent visit first
      expect(res.body.doctors[0].doctorName).toBe('Dr. Beverly Crusher');
      expect(res.body.doctors[0].visitCount).toBe(1);

      // Dr. Stephen Strange had 2 visits
      const strangeEntry = res.body.doctors.find(
        (d) => d.doctorName === 'Dr. Stephen Strange'
      );
      expect(strangeEntry).toBeDefined();
      expect(strangeEntry.visitCount).toBe(2);
    });
  });

  describe('POST /api/shares (Create Time-Limited Share)', () => {
    it('should create a share with multiple reports and a 24h expiration limit', async () => {
      const res = await request(app)
        .post('/api/shares')
        .set('Cookie', patientCookie)
        .send({
          doctorId: doctorUser._id,
          reportIds: [report1Id, report2Id],
          duration: '24h',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('share');
      expect(res.body.share.patient).toBeDefined();
      expect(res.body.share.doctor).toBe(doctorUser._id);
      expect(res.body.share.reportIds).toHaveLength(2);

      // Verify expiration is roughly 24 hours from now
      const expiresAt = new Date(res.body.share.expiresAt);
      const diffHours = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23.9);
      expect(diffHours).toBeLessThanOrEqual(24.1);
    });

    it('should reject share if recipient is not a doctor', async () => {
      // Try sharing with patient 2
      const p2Profile = await request(app)
        .get('/api/auth/me')
        .set('Cookie', patient2Cookie);

      const res = await request(app)
        .post('/api/shares')
        .set('Cookie', patientCookie)
        .send({
          doctorId: p2Profile.body.user._id,
          reportIds: [report1Id],
          duration: '1h',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('must be a registered doctor');
    });

    it('should reject share if patient tries to share another patient’s reports', async () => {
      // Patient 2 attempts to share Patient 1's reports
      const res = await request(app)
        .post('/api/shares')
        .set('Cookie', patient2Cookie)
        .send({
          doctorId: doctorUser._id,
          reportIds: [report1Id],
          duration: '1h',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('do not belong to your account');
    });
  });

  describe('GET /api/shares/inbox (Doctor Portal Inbox)', () => {
    it('should display active shares grouped by patient with remaining time countdown', async () => {
      // 1. Patient 1 shares reports with Doctor 1
      await request(app)
        .post('/api/shares')
        .set('Cookie', patientCookie)
        .send({
          doctorId: doctorUser._id,
          reportIds: [report1Id, report2Id],
          duration: '24h',
        });

      // 2. Doctor 1 checks inbox
      const res = await request(app)
        .get('/api/shares/inbox')
        .set('Cookie', doctorCookie);

      expect(res.status).toBe(200);
      expect(res.body.inbox).toHaveLength(1);
      expect(res.body.inbox[0].patient.name).toBe('Arthur Dent');
      expect(res.body.inbox[0].shares).toHaveLength(1);
      expect(res.body.inbox[0].shares[0].reports).toHaveLength(2);
      expect(res.body.inbox[0].shares[0].timeRemainingMs).toBeGreaterThan(0);
    });

    it('should reject doctor inbox access if caller is a patient', async () => {
      const res = await request(app)
        .get('/api/shares/inbox')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/shares/:shareId/reports/:reportId/file & Expiration Enforcement', () => {
    let activeShareId;

    beforeEach(async () => {
      const shareRes = await request(app)
        .post('/api/shares')
        .set('Cookie', patientCookie)
        .send({
          doctorId: doctorUser._id,
          reportIds: [report1Id],
          duration: '24h',
        });
      activeShareId = shareRes.body.share._id;
    });

    it('should decrypt and stream shared report PDF to authorized doctor and record openedAt', async () => {
      const res = await request(app)
        .get(`/api/shares/${activeShareId}/reports/${report1Id}/file`)
        .set('Cookie', doctorCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');

      // Check openedAt was updated
      const share = await Share.findById(activeShareId);
      expect(share.openedAt).not.toBeNull();
    });

    it('should reject Doctor 2 from accessing a share addressed to Doctor 1', async () => {
      const res = await request(app)
        .get(`/api/shares/${activeShareId}/reports/${report1Id}/file`)
        .set('Cookie', doctor2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('should block doctor access immediately when time runs out (TTL lag guard)', async () => {
      // Manually simulate an expired share (expired 1 second ago)
      await Share.findByIdAndUpdate(activeShareId, {
        expiresAt: new Date(Date.now() - 1000),
      });

      // 1. Verify it disappears from doctor's inbox
      const inboxRes = await request(app)
        .get('/api/shares/inbox')
        .set('Cookie', doctorCookie);
      expect(inboxRes.body.inbox).toHaveLength(0);

      // 2. Direct file request is blocked with 403
      const fileRes = await request(app)
        .get(`/api/shares/${activeShareId}/reports/${report1Id}/file`)
        .set('Cookie', doctorCookie);
      expect(fileRes.status).toBe(403);
      expect(fileRes.body.error).toContain('Access expired');

      // 3. Patient's own copy is NEVER deleted
      const patientFileRes = await request(app)
        .get(`/api/reports/${report1Id}/file`)
        .set('Cookie', patientCookie);
      expect(patientFileRes.status).toBe(200);
      expect(patientFileRes.headers['content-type']).toBe('application/pdf');
    });
  });
});

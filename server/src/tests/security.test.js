const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Share = require('../models/Share');
const Report = require('../models/Report');
const encryptionService = require('../services/encryptionService');
const gridFsService = require('../services/gridFsService');

describe('Phase 7: Comprehensive Security & Access Control Verification', () => {
  let samplePdfBuffer;
  let patientACookie;
  let patientBCookie;
  let doctorACookie;
  let doctorBCookie;
  let doctorAUser;
  let doctorBUser;
  let patientAReport1Id;
  let patientAReport2Id;
  let patientBReportId;

  beforeAll(async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawText('Confidential Medical Record for Security Testing', { x: 40, y: 350 });
    samplePdfBuffer = Buffer.from(await pdfDoc.save());
  });

  beforeEach(async () => {
    // 1. Patient A
    const resPA = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'Patient Alice',
      email: 'alice.security@test.com',
      password: 'password123',
    });
    patientACookie = resPA.headers['set-cookie'];

    // 2. Patient B
    const resPB = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'Patient Bob',
      email: 'bob.security@test.com',
      password: 'password123',
    });
    patientBCookie = resPB.headers['set-cookie'];

    // 3. Doctor A
    const resDA = await request(app).post('/api/auth/register').send({
      role: 'doctor',
      name: 'Dr. Gregory House',
      email: 'house.security@test.com',
      password: 'password123',
      department: 'Diagnostic Medicine',
    });
    doctorACookie = resDA.headers['set-cookie'];
    doctorAUser = resDA.body.user;

    // 4. Doctor B
    const resDB = await request(app).post('/api/auth/register').send({
      role: 'doctor',
      name: 'Dr. James Wilson',
      email: 'wilson.security@test.com',
      password: 'password123',
      department: 'Oncology',
    });
    doctorBCookie = resDB.headers['set-cookie'];
    doctorBUser = resDB.body.user;

    // 5. Upload Patient A Reports
    const r1 = await request(app)
      .post('/api/reports')
      .set('Cookie', patientACookie)
      .field('reason', 'Alice Blood Work')
      .field('doctorName', 'Dr. Gregory House')
      .field('visitDate', '2026-11-01')
      .field('type', 'Lab report')
      .attach('files', samplePdfBuffer, 'alice_blood.pdf');
    patientAReport1Id = r1.body.report._id;

    const r2 = await request(app)
      .post('/api/reports')
      .set('Cookie', patientACookie)
      .field('reason', 'Alice X-Ray')
      .field('doctorName', 'Dr. Gregory House')
      .field('visitDate', '2026-11-05')
      .field('type', 'Imaging')
      .attach('files', samplePdfBuffer, 'alice_xray.pdf');
    patientAReport2Id = r2.body.report._id;

    // 6. Upload Patient B Report
    const rB = await request(app)
      .post('/api/reports')
      .set('Cookie', patientBCookie)
      .field('reason', 'Bob Prescription')
      .field('doctorName', 'Dr. James Wilson')
      .field('visitDate', '2026-11-10')
      .field('type', 'Prescription')
      .attach('files', samplePdfBuffer, 'bob_rx.pdf');
    patientBReportId = rB.body.report._id;
  });

  describe('Security Check 1: Patient A cannot read or tamper with Patient B data', () => {
    it('Patient B cannot download Patient A report file (HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/reports/${patientAReport1Id}/file`)
        .set('Cookie', patientBCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('Patient B cannot delete Patient A report (HTTP 403)', async () => {
      const res = await request(app)
        .delete(`/api/reports/${patientAReport1Id}`)
        .set('Cookie', patientBCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');

      // Verify report still exists
      const report = await Report.findById(patientAReport1Id);
      expect(report).not.toBeNull();
    });

    it('Patient B cannot request an AI summary on Patient A report (HTTP 403)', async () => {
      const res = await request(app)
        .post(`/api/reports/${patientAReport1Id}/summary`)
        .set('Cookie', patientBCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('Patient B cannot share Patient A reports with a doctor (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/shares')
        .set('Cookie', patientBCookie)
        .send({
          doctorId: doctorAUser._id,
          reportIds: [patientAReport1Id],
          duration: '24h',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('do not belong to your account');
    });
  });

  describe('Security Check 2: A patient cannot call doctor routes', () => {
    it('Patient cannot view Doctor Inbox (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/shares/inbox')
        .set('Cookie', patientACookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('Patient cannot stream a report using doctor share file endpoint (HTTP 403)', async () => {
      // Create valid share for Doctor A
      const shareRes = await request(app)
        .post('/api/shares')
        .set('Cookie', patientACookie)
        .send({
          doctorId: doctorAUser._id,
          reportIds: [patientAReport1Id],
          duration: '24h',
        });
      const shareId = shareRes.body.share._id;

      // Patient tries to call the doctor endpoint
      const res = await request(app)
        .get(`/api/shares/${shareId}/reports/${patientAReport1Id}/file`)
        .set('Cookie', patientACookie);

      expect(res.status).toBe(403);
    });
  });

  describe('Security Check 3: A doctor cannot call patient routes', () => {
    it('Doctor cannot upload a personal report (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', doctorACookie)
        .field('reason', 'Doctor cannot upload personal report')
        .field('doctorName', 'Self')
        .field('visitDate', '2026-11-20')
        .field('type', 'Lab report')
        .attach('files', samplePdfBuffer, 'test.pdf');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });

    it('Doctor cannot list personal reports (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/reports')
        .set('Cookie', doctorACookie);

      expect(res.status).toBe(403);
    });

    it('Doctor cannot create a share (HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/shares')
        .set('Cookie', doctorACookie)
        .send({
          doctorId: doctorBUser._id,
          reportIds: [patientAReport1Id],
          duration: '24h',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Security Check 4: Doctor access limits & expiration enforcement', () => {
    let shareId;

    beforeEach(async () => {
      // Patient A shares Report 1 ONLY with Doctor A (Report 2 is NOT shared)
      const res = await request(app)
        .post('/api/shares')
        .set('Cookie', patientACookie)
        .send({
          doctorId: doctorAUser._id,
          reportIds: [patientAReport1Id],
          duration: '24h',
        });
      shareId = res.body.share._id;
    });

    it('Doctor A cannot read Patient A Report 2 that was not shared (HTTP 404)', async () => {
      const res = await request(app)
        .get(`/api/shares/${shareId}/reports/${patientAReport2Id}/file`)
        .set('Cookie', doctorACookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not part of the shared package');
    });

    it('Doctor B cannot view reports in a share addressed to Doctor A (HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/shares/${shareId}/reports/${patientAReport1Id}/file`)
        .set('Cookie', doctorBCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('not addressed to you');
    });

    it('Doctor cannot read report once access expires (Active TTL lag guard)', async () => {
      // Simulate share expiration
      await Share.findByIdAndUpdate(shareId, {
        expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
      });

      const res = await request(app)
        .get(`/api/shares/${shareId}/reports/${patientAReport1Id}/file`)
        .set('Cookie', doctorACookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access expired');

      // Crucial: Patient A own copy is still completely intact
      const ownerRes = await request(app)
        .get(`/api/reports/${patientAReport1Id}/file`)
        .set('Cookie', patientACookie);

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('Security Check 5: Token Tampering & Session Invalidation', () => {
    it('Forged JWT with invalid signature is rejected (HTTP 401)', async () => {
      const forgedToken = jwt.sign(
        { id: doctorAUser._id, role: 'doctor' },
        'wrong_attacker_signature_key',
        { expiresIn: '1d' }
      );

      const res = await request(app)
        .get('/api/shares/inbox')
        .set('Cookie', `medsync_token=${forgedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('session has expired or is invalid');
    });

    it('Unauthenticated requests are rejected (HTTP 401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });
  });

  describe('Security Check 6: AES-256-GCM Storage Integrity', () => {
    it('GridFS stores ciphertext that cannot be read as plaintext and detects any bit flips', async () => {
      const report = await Report.findById(patientAReport1Id);
      const { encryptedBuffer, metadata } = await gridFsService.downloadEncryptedFile(
        report.file.gridFsId
      );

      // Verify file is encrypted
      expect(encryptedBuffer.equals(samplePdfBuffer)).toBe(false);
      expect(encryptedBuffer.slice(0, 5).toString('ascii')).not.toBe('%PDF-');

      // Verify tampering detection
      const tampered = Buffer.from(encryptedBuffer);
      tampered[10] ^= 0x01; // Flip one bit

      expect(() => {
        encryptionService.decrypt(tampered, metadata.iv, metadata.authTag);
      }).toThrow('Decryption failed');
    });
  });
});

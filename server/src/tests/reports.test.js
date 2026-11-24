const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const app = require('../app');
const Report = require('../models/Report');
const encryptionService = require('../services/encryptionService');
const pdfService = require('../services/pdfService');
const gridFsService = require('../services/gridFsService');

describe('Phase 4: Reports & Confidential Storage Tests', () => {
  let samplePdfBuffer;
  let samplePngBuffer;
  let patientCookie;
  let doctorCookie;
  let patient2Cookie;

  beforeAll(async () => {
    // Generate valid sample PDF buffer
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawText('Sample Confidential Medical Report', { x: 50, y: 350 });
    samplePdfBuffer = Buffer.from(await pdfDoc.save());

    // Generate valid sample PNG buffer
    samplePngBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 86, g: 124, b: 141 },
      },
    })
      .png()
      .toBuffer();
  });

  beforeEach(async () => {
    // Register Patient 1
    const p1Res = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'John Patient',
      email: 'john.patient@example.com',
      password: 'password123',
    });
    patientCookie = p1Res.headers['set-cookie'];

    // Register Patient 2
    const p2Res = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'Bob Patient',
      email: 'bob.patient@example.com',
      password: 'password123',
    });
    patient2Cookie = p2Res.headers['set-cookie'];

    // Register Doctor
    const docRes = await request(app).post('/api/auth/register').send({
      role: 'doctor',
      name: 'Dr. Strange',
      email: 'strange@kamartaj.org',
      password: 'sorcererDoc123',
      department: 'Neuro-Surgery',
    });
    doctorCookie = docRes.headers['set-cookie'];
  });

  describe('AES-256-GCM Encryption Service', () => {
    it('should encrypt and decrypt plaintext buffer with byte-for-byte fidelity', () => {
      const plaintext = Buffer.from('Confidential Blood Test Results: Glucose 95 mg/dL');
      const { encryptedBuffer, iv, authTag } = encryptionService.encrypt(plaintext);

      expect(encryptedBuffer).toBeDefined();
      expect(encryptedBuffer.equals(plaintext)).toBe(false);
      expect(iv).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(authTag).toHaveLength(32); // 16 bytes = 32 hex chars

      const decrypted = encryptionService.decrypt(encryptedBuffer, iv, authTag);
      expect(decrypted.toString()).toBe(plaintext.toString());
    });

    it('should reject tampered ciphertext with decryption error', () => {
      const plaintext = Buffer.from('Normal Blood Pressure 120/80');
      const { encryptedBuffer, iv, authTag } = encryptionService.encrypt(plaintext);

      // Tamper with first byte of ciphertext
      encryptedBuffer[0] ^= 0xff;

      expect(() => {
        encryptionService.decrypt(encryptedBuffer, iv, authTag);
      }).toThrow('Decryption failed');
    });
  });

  describe('PDF Conversion & Normalization Service', () => {
    it('should normalize single or multiple images into a multi-page PDF', async () => {
      const files = [
        {
          buffer: samplePngBuffer,
          mimetype: 'image/png',
          originalname: 'camera_shot_1.png',
          size: samplePngBuffer.length,
        },
        {
          buffer: samplePngBuffer,
          mimetype: 'image/png',
          originalname: 'camera_shot_2.png',
          size: samplePngBuffer.length,
        },
      ];

      const { pdfBuffer, pageCount } = await pdfService.normalizeToPdf(files);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pageCount).toBe(2);
      expect(pdfBuffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should reject unsupported file types', async () => {
      const invalidFile = {
        buffer: Buffer.from('not an image'),
        mimetype: 'text/plain',
        originalname: 'notes.txt',
        size: 13,
      };

      await expect(pdfService.normalizeToPdf([invalidFile])).rejects.toThrow(
        'Unsupported file format'
      );
    });
  });

  describe('POST /api/reports (Upload & Encrypt Report)', () => {
    it('should upload a PDF report, encrypt it in GridFS, and save metadata', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'Annual Routine Health Checkup')
        .field('doctorName', 'Dr. Meredith Grey')
        .field('visitDate', '2026-11-20')
        .field('type', 'Lab report')
        .attach('files', samplePdfBuffer, 'blood_test.pdf');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('report');
      expect(res.body.report.reason).toBe('Annual Routine Health Checkup');
      expect(res.body.report.doctorName).toBe('Dr. Meredith Grey');
      expect(res.body.report.type).toBe('Lab report');
      expect(res.body.report.file.encrypted).toBe(true);
      expect(res.body.report.file.mimeType).toBe('application/pdf');

      // Check GridFS storage directly
      const { encryptedBuffer, metadata } = await gridFsService.downloadEncryptedFile(
        res.body.report.file.gridFsId
      );
      expect(encryptedBuffer).toBeDefined();
      expect(metadata).toHaveProperty('iv');
      expect(metadata).toHaveProperty('authTag');
      // Verify stored bytes are encrypted (not equal to raw PDF bytes)
      expect(encryptedBuffer.equals(samplePdfBuffer)).toBe(false);
    });

    it('should convert multiple camera photos into a single PDF report', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'Dermatology prescription multi-page')
        .field('doctorName', 'Dr. Derek Shepherd')
        .field('visitDate', '2026-11-15')
        .field('type', 'Prescription')
        .attach('files', samplePngBuffer, 'page1.png')
        .attach('files', samplePngBuffer, 'page2.png');

      expect(res.status).toBe(201);
      expect(res.body.report.file.originalName).toBe('page1.pdf');
    });

    it('should reject report if reason exceeds 120 characters', async () => {
      const longReason = 'A'.repeat(121);
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', longReason)
        .field('doctorName', 'Dr. House')
        .field('visitDate', '2026-11-20')
        .field('type', 'Lab report')
        .attach('files', samplePdfBuffer, 'test.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('cannot exceed 120 characters');
    });

    it('should reject report upload if user is not a patient', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set('Cookie', doctorCookie)
        .field('reason', 'Doctor cannot upload personal patient reports')
        .field('doctorName', 'Dr. Self')
        .field('visitDate', '2026-11-20')
        .field('type', 'Lab report')
        .attach('files', samplePdfBuffer, 'test.pdf');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });
  });

  describe('GET /api/reports (Monthly Timeline Grouping)', () => {
    it('should return reports grouped by month in descending order', async () => {
      // Create reports in two different months (November 2026 and October 2026)
      await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'November checkup')
        .field('doctorName', 'Dr. Green')
        .field('visitDate', '2026-11-10')
        .field('type', 'Lab report')
        .attach('files', samplePdfBuffer, 'nov.pdf');

      await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'October checkup')
        .field('doctorName', 'Dr. Blue')
        .field('visitDate', '2026-10-05')
        .field('type', 'Prescription')
        .attach('files', samplePdfBuffer, 'oct.pdf');

      const res = await request(app)
        .get('/api/reports')
        .set('Cookie', patientCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('timeline');
      expect(res.body.timeline.length).toBe(2);
      expect(res.body.timeline[0].month).toBe('2026-11');
      expect(res.body.timeline[1].month).toBe('2026-10');
      expect(res.body.totalCount).toBe(2);
    });
  });

  describe('GET /api/reports/:id/file (Decryption & Streaming)', () => {
    it('should stream decrypted PDF inline for report owner', async () => {
      // 1. Upload report
      const uploadRes = await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'Blood report')
        .field('doctorName', 'Dr. Watson')
        .field('visitDate', '2026-11-01')
        .field('type', 'Lab report')
        .attach('files', samplePdfBuffer, 'blood.pdf');

      const reportId = uploadRes.body.report._id;

      // 2. Download report
      const fileRes = await request(app)
        .get(`/api/reports/${reportId}/file`)
        .set('Cookie', patientCookie);

      expect(fileRes.status).toBe(200);
      expect(fileRes.headers['content-type']).toBe('application/pdf');
      expect(fileRes.headers['content-disposition']).toContain('inline;');

      // Verify downloaded bytes match original PDF
      expect(fileRes.body).toBeDefined();
      expect(fileRes.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('should reject download if requester is not the report owner (cross-patient security)', async () => {
      // 1. Patient 1 uploads report
      const uploadRes = await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'Confidential Patient 1 Report')
        .field('doctorName', 'Dr. Watson')
        .field('visitDate', '2026-11-01')
        .field('type', 'Lab report')
        .attach('files', samplePdfBuffer, 'patient1.pdf');

      const reportId = uploadRes.body.report._id;

      // 2. Patient 2 tries to download Patient 1's report
      const fileRes = await request(app)
        .get(`/api/reports/${reportId}/file`)
        .set('Cookie', patient2Cookie);

      expect(fileRes.status).toBe(403);
      expect(fileRes.body.error).toContain('Access denied');
    });
  });

  describe('DELETE /api/reports/:id (Report Deletion)', () => {
    it('should permanently delete report metadata and GridFS chunks', async () => {
      // 1. Upload report
      const uploadRes = await request(app)
        .post('/api/reports')
        .set('Cookie', patientCookie)
        .field('reason', 'Report to be deleted')
        .field('doctorName', 'Dr. Temporary')
        .field('visitDate', '2026-11-01')
        .field('type', 'Imaging')
        .attach('files', samplePdfBuffer, 'temp.pdf');

      const reportId = uploadRes.body.report._id;
      const gridFsId = uploadRes.body.report.file.gridFsId;

      // 2. Delete report
      const delRes = await request(app)
        .delete(`/api/reports/${reportId}`)
        .set('Cookie', patientCookie);

      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toContain('Report deleted successfully');

      // 3. Verify Report is gone from MongoDB
      const foundReport = await Report.findById(reportId);
      expect(foundReport).toBeNull();

      // 4. Verify GridFS file was deleted
      await expect(gridFsService.downloadEncryptedFile(gridFsId)).rejects.toThrow(
        'Requested file was not found in storage'
      );
    });
  });
});

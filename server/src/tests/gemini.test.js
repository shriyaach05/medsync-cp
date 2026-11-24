const request = require('supertest');
const { PDFDocument } = require('pdf-lib');
const app = require('../app');
const Report = require('../models/Report');
const geminiService = require('../services/geminiService');

describe('Phase 5: Google Gemini AI Integration Tests', () => {
  let patientCookie;
  let patient2Cookie;
  let doctorCookie;
  let samplePdfBuffer;
  let testReportId;

  beforeAll(async () => {
    // Generate valid sample PDF buffer
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawText('Sample Blood Test: Hemoglobin 14.2 g/dL, Fasting Glucose 92 mg/dL', {
      x: 30,
      y: 350,
    });
    samplePdfBuffer = Buffer.from(await pdfDoc.save());
  });

  beforeEach(async () => {
    // Register Patient 1
    const p1Res = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'Eleanor Vance',
      email: 'eleanor@hillhouse.org',
      password: 'password123',
    });
    patientCookie = p1Res.headers['set-cookie'];

    // Register Patient 2
    const p2Res = await request(app).post('/api/auth/register').send({
      role: 'patient',
      name: 'Theodora',
      email: 'theodora@hillhouse.org',
      password: 'password123',
    });
    patient2Cookie = p2Res.headers['set-cookie'];

    // Register Doctor
    const docRes = await request(app).post('/api/auth/register').send({
      role: 'doctor',
      name: 'Dr. John Montague',
      email: 'montague@research.org',
      password: 'doctorPassword123',
      department: 'Parapsychology',
    });
    doctorCookie = docRes.headers['set-cookie'];

    // Create a report for Patient 1
    const repRes = await request(app)
      .post('/api/reports')
      .set('Cookie', patientCookie)
      .field('reason', 'Routine Blood Test')
      .field('doctorName', 'Dr. Montague')
      .field('visitDate', '2026-11-20')
      .field('type', 'Lab report')
      .attach('files', samplePdfBuffer, 'blood_test.pdf');

    testReportId = repRes.body.report._id;
  });

  describe('Zod Output Schema Validation', () => {
    it('should validate and parse autofill JSON output correctly', () => {
      const rawJson = {
        reason: 'Follow-up Consultation for Hypertension',
        doctorName: 'Dr. Gregory House',
        visitDate: '2026-11-24',
        type: 'Prescription',
      };

      const parsed = geminiService.autofillOutputSchema.parse(rawJson);
      expect(parsed.reason).toBe('Follow-up Consultation for Hypertension');
      expect(parsed.doctorName).toBe('Dr. Gregory House');
      expect(parsed.visitDate).toBe('2026-11-24');
      expect(parsed.type).toBe('Prescription');
    });

    it('should validate structured summary JSON format according to medical table brief', () => {
      const rawSummary = {
        reportType: 'Complete Blood Count',
        date: '2026-11-20',
        doctor: 'Dr. Montague',
        keyFindings: [
          {
            test: 'Hemoglobin',
            value: '14.2 g/dL',
            normalRange: '13.5 - 17.5 g/dL',
            status: 'normal',
          },
          {
            test: 'Fasting Glucose',
            value: '115 mg/dL',
            normalRange: '70 - 99 mg/dL',
            status: 'high',
          },
        ],
        medicines: [
          {
            name: 'Metformin',
            dose: '500mg once daily',
            duration: '30 days',
          },
        ],
        advice: ['Maintain low sugar diet', 'Daily 30-minute brisk walking'],
        followUp: 'Repeat fasting blood test in 3 months',
      };

      const parsed = geminiService.summaryOutputSchema.parse(rawSummary);
      expect(parsed.reportType).toBe('Complete Blood Count');
      expect(parsed.keyFindings).toHaveLength(2);
      expect(parsed.keyFindings[0].status).toBe('normal');
      expect(parsed.keyFindings[1].status).toBe('high');
      expect(parsed.medicines[0].name).toBe('Metformin');
      expect(parsed.advice).toHaveLength(2);
      expect(parsed.followUp).toContain('3 months');
    });
  });

  describe('POST /api/reports/autofill Endpoint', () => {
    it('should extract autofill fields from uploaded document', async () => {
      // Mock extractAutofill to simulate Gemini response
      const spy = jest
        .spyOn(geminiService, 'extractAutofill')
        .mockResolvedValueOnce({
          reason: 'Annual Health Checkup',
          doctorName: 'Dr. Montague',
          visitDate: '2026-11-20',
          type: 'Lab report',
        });

      const res = await request(app)
        .post('/api/reports/autofill')
        .set('Cookie', patientCookie)
        .attach('files', samplePdfBuffer, 'test.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.autofill.reason).toBe('Annual Health Checkup');
      expect(res.body.autofill.doctorName).toBe('Dr. Montague');
      expect(res.body.autofill.type).toBe('Lab report');
      expect(res.body.message).toBe('Filled automatically, please check.');

      spy.mockRestore();
    });

    it('should gracefully return empty fields without error popup if extraction fails', async () => {
      const spy = jest
        .spyOn(geminiService, 'extractAutofill')
        .mockResolvedValueOnce({
          reason: '',
          doctorName: '',
          visitDate: null,
          type: 'Other',
        });

      const res = await request(app)
        .post('/api/reports/autofill')
        .set('Cookie', patientCookie)
        .attach('files', samplePdfBuffer, 'unclear.pdf');

      expect(res.status).toBe(200);
      expect(res.body.autofill.reason).toBe('');
      expect(res.body.autofill.visitDate).toBeNull();
      // Notice empty message so no error popup is triggered on client
      expect(res.body.message).toBe('');

      spy.mockRestore();
    });

    it('should reject autofill if caller is a doctor (patient-only route)', async () => {
      const res = await request(app)
        .post('/api/reports/autofill')
        .set('Cookie', doctorCookie)
        .attach('files', samplePdfBuffer, 'test.pdf');

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/reports/:id/summary Endpoint', () => {
    it('should generate structured summary, attach medical disclaimer, and cache for subsequent calls', async () => {
      const mockSummary = {
        reportType: 'Blood Test',
        date: '2026-11-20',
        doctor: 'Dr. Montague',
        keyFindings: [
          {
            test: 'Hemoglobin',
            value: '14.2 g/dL',
            normalRange: '13.5 - 17.5 g/dL',
            status: 'normal',
          },
        ],
        medicines: [],
        advice: ['Continue balanced diet'],
        followUp: 'Annual review',
      };

      const spy = jest
        .spyOn(geminiService, 'generateReportSummary')
        .mockResolvedValueOnce(mockSummary);

      // 1. First call: Generates summary via Gemini
      const firstRes = await request(app)
        .post(`/api/reports/${testReportId}/summary`)
        .set('Cookie', patientCookie);

      expect(firstRes.status).toBe(200);
      expect(firstRes.body).toHaveProperty('summary');
      expect(firstRes.body.cached).toBe(false);
      expect(firstRes.body.disclaimer).toBe(
        'AI summary, not medical advice. Check the original with your doctor.'
      );
      expect(firstRes.body.summary.reportType).toBe('Blood Test');
      expect(firstRes.body.summary.keyFindings[0].status).toBe('normal');

      // Verify report in database was updated
      const updatedReport = await Report.findById(testReportId);
      expect(updatedReport.summaryStatus).toBe('completed');
      expect(updatedReport.summary).toBeDefined();

      // 2. Second call: Instantly returns cached summary (no second call to Gemini)
      const secondRes = await request(app)
        .post(`/api/reports/${testReportId}/summary`)
        .set('Cookie', patientCookie);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.cached).toBe(true);
      expect(secondRes.body.summary.reportType).toBe('Blood Test');
      expect(spy).toHaveBeenCalledTimes(1); // Gemini was called only once!

      spy.mockRestore();
    });

    it('should prevent patient 2 from requesting summary for patient 1 report', async () => {
      const res = await request(app)
        .post(`/api/reports/${testReportId}/summary`)
        .set('Cookie', patient2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Access denied');
    });
  });
});

const { z } = require('zod');

/**
 * Gemini AI Service for MedSync
 * Handles AI-powered form autofill and simple-language medical report summaries.
 * Features automated retry on HTTP 429/503 and automatic failover to fallback models.
 * Strictly enforces zero-diagnosis and fact-bound JSON output schemas.
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_FALLBACK_MODEL = 'gemini-1.5-flash';
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Zod validation schema for Autofill output
 */
const autofillOutputSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(120, 'Reason cannot exceed 120 characters')
    .default('General Medical Consultation'),
  doctorName: z.string().trim().max(100).default('Unknown'),
  visitDate: z
    .string()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime());
    }, 'Invalid visit date')
    .default(null),
  type: z
    .enum(['Lab report', 'Prescription', 'Imaging', 'Other'])
    .default('Other'),
});

/**
 * Zod validation schema for Summary output
 */
const summaryOutputSchema = z.object({
  reportType: z.string().default('Medical Document'),
  date: z.string().default('Not mentioned'),
  doctor: z.string().default('Not mentioned'),
  keyFindings: z
    .array(
      z.object({
        test: z.string().default('Finding'),
        value: z.string().default('Reported'),
        normalRange: z.string().default('Not stated'),
        status: z.enum(['normal', 'high', 'low']).default('normal'),
      })
    )
    .default([]),
  medicines: z
    .array(
      z.object({
        name: z.string(),
        dose: z.string().default('As directed'),
        duration: z.string().default('As prescribed'),
      })
    )
    .default([]),
  advice: z.array(z.string()).default([]),
  followUp: z.string().default('Not mentioned'),
});

/**
 * Internal helper to send request to Google Gemini API
 * @param {string} model
 * @param {string} apiKey
 * @param {Buffer} pdfBuffer
 * @param {string} promptText
 * @returns {Promise<any>}
 */
const requestGemini = async (model, apiKey, pdfBuffer, promptText) => {
  const url = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const base64Pdf = pdfBuffer.toString('base64');

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1, // Minimal creativity for factual medical data
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  return response;
};

/**
 * Executes a Gemini request with retry logic on 429/503 and fallback model switching
 * @param {Buffer} pdfBuffer
 * @param {string} promptText
 * @returns {Promise<string>} Raw JSON text response from Gemini
 */
const callGeminiWithRetryAndFallback = async (pdfBuffer, promptText) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_placeholder') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const primaryModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

  let response;

  try {
    // Attempt 1: Primary Model
    response = await requestGemini(primaryModel, apiKey, pdfBuffer, promptText);

    // If rate-limited (429) or service unavailable (503), wait and retry
    if (response.status === 429 || response.status === 503) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[Gemini API] Primary model ${primaryModel} returned ${response.status}. Retrying in 1.5s...`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      response = await requestGemini(primaryModel, apiKey, pdfBuffer, promptText);
    }

    // If primary model still fails or is overloaded, switch to fallback model
    if (!response.ok && (response.status === 429 || response.status === 503 || response.status === 404)) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[Gemini API] Switching to fallback model ${fallbackModel}...`);
      }
      response = await requestGemini(fallbackModel, apiKey, pdfBuffer, promptText);
    }
  } catch (netErr) {
    // On network failure with primary model, try fallback model
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[Gemini API] Network error on primary model: ${netErr.message}. Trying fallback ${fallbackModel}...`);
    }
    response = await requestGemini(fallbackModel, apiKey, pdfBuffer, promptText);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API Error (HTTP ${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response received from Gemini API.');
  }

  return text;
};

/**
 * Job 1: Extract form fields for Add Document popup
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{ reason: string, doctorName: string, visitDate: string|null, type: string }>}
 */
const extractAutofill = async (pdfBuffer) => {
  const prompt = `You are a medical document reading assistant.
Extract exactly the following four fields from the attached medical document into valid JSON:
1. "reason": A single concise sentence stating the reason for visit, diagnosis, or test (maximum 120 characters). E.g. "Routine Blood Work", "Cardiology Consultation".
2. "doctorName": The treating or prescribing doctor's name (e.g. "Dr. Sarah Connor") or "Unknown" if not found.
3. "visitDate": The date of the visit or test formatted strictly as YYYY-MM-DD (e.g. "2026-11-24"). If the date is missing or ambiguous, output null.
4. "type": Exactly one of: "Lab report", "Prescription", "Imaging", or "Other".

Strict Rules:
- Output JSON ONLY matching: { "reason": string, "doctorName": string, "visitDate": string|null, "type": string }.
- Use ONLY facts explicitly visible in the document.
- NEVER invent information. If uncertain, use "Unknown" or null.
- NEVER diagnose.`;

  try {
    const jsonText = await callGeminiWithRetryAndFallback(pdfBuffer, prompt);
    const parsed = JSON.parse(jsonText);
    const validated = autofillOutputSchema.parse(parsed);
    return validated;
  } catch (error) {
    // If autofill fails, return safe default empty fields without crashing
    return {
      reason: '',
      doctorName: '',
      visitDate: null,
      type: 'Other',
    };
  }
};

/**
 * Job 2: Generate simple-language, non-diagnostic structured summary table
 * @param {Buffer} pdfBuffer
 * @returns {Promise<object>} Structured summary matching brief specification
 */
const generateReportSummary = async (pdfBuffer) => {
  const prompt = `You are a compassionate medical records assistant helping a patient or their guardian understand their medical report in simple, everyday language.
Analyze the attached medical document and return a structured JSON summary strictly adhering to the following structure:
{
  "reportType": "Clear report type, e.g. Complete Blood Count (CBC) or Chest X-Ray",
  "date": "Visit or test date as stated",
  "doctor": "Doctor name or Not mentioned",
  "keyFindings": [
    {
      "test": "Name of the test or biomarker (e.g. Hemoglobin, Glucose)",
      "value": "Measured result with unit (e.g. 13.5 g/dL)",
      "normalRange": "Normal reference range (e.g. 12.0 - 15.5 g/dL) or Not stated",
      "status": "normal" | "high" | "low"
    }
  ],
  "medicines": [
    {
      "name": "Medication brand/generic name",
      "dose": "Dosage and frequency (e.g. 500mg once daily with food)",
      "duration": "Length of treatment (e.g. 7 days, 1 month) or As needed"
    }
  ],
  "advice": [
    "Simple plain-language recommendations or lifestyle instructions mentioned in the report"
  ],
  "followUp": "Follow-up schedule or Not mentioned"
}

Strict Rules:
- Plain, friendly language that a student or patient can easily understand.
- NEVER diagnose new medical conditions.
- Only extract information present in the report. If no medicines or advice are mentioned, return empty arrays [].
- Output valid JSON ONLY.`;

  const jsonText = await callGeminiWithRetryAndFallback(pdfBuffer, prompt);
  const parsed = JSON.parse(jsonText);
  const validated = summaryOutputSchema.parse(parsed);
  return validated;
};

module.exports = {
  extractAutofill,
  generateReportSummary,
  autofillOutputSchema,
  summaryOutputSchema,
  callGeminiWithRetryAndFallback,
};

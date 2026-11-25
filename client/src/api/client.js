/**
 * MedSync API Client
 *
 * A lightweight wrapper around the browser's `fetch()` API.
 * - Uses `credentials: 'include'` so httpOnly JWT cookies are sent automatically.
 * - Uses VITE_API_URL (or `/api` via Vite dev proxy).
 * - Converts server error responses into clean Error objects with user-friendly messages.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Core request helper
 * @param {string} endpoint - e.g. '/auth/login'
 * @param {RequestInit & { body?: any, isFormData?: boolean }} options
 */
async function request(endpoint, options = {}) {
  const { body, isFormData = false, headers = {}, ...rest } = options;

  const config = {
    credentials: 'include',
    headers: { ...headers },
    ...rest,
  };

  if (body !== undefined) {
    if (isFormData || body instanceof FormData) {
      // Let the browser set multipart/form-data boundary automatically
      config.body = body;
    } else {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  } catch {
    throw new ApiError(
      'Unable to reach the server. Please check your internet connection and try again.',
      0
    );
  }

  // Handle binary/PDF responses
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    let errorMessage = 'Something went wrong. Please try again.';
    let details = null;

    if (contentType.includes('application/json')) {
      try {
        const data = await response.json();
        errorMessage = data.error || data.message || errorMessage;
        details = data.details || null;
      } catch {
        // Fallback to default message
      }
    }
    throw new ApiError(errorMessage, response.status, details);
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response;
}

export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body, ...options }),
  patch: (endpoint, body, options) => request(endpoint, { method: 'PATCH', body, ...options }),
  delete: (endpoint, body, options) => request(endpoint, { method: 'DELETE', body, ...options }),
  upload: (endpoint, formData, options) =>
    request(endpoint, { method: 'POST', body: formData, isFormData: true, ...options }),

  /**
   * Fetch a protected PDF/binary file as a Blob URL so it can be viewed in an <iframe> or downloaded.
   */
  async fetchBlobUrl(endpoint) {
    const response = await request(endpoint, { method: 'GET' });
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
};

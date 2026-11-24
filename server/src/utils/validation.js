const { z } = require('zod');

/**
 * Registration validation schema
 */
const registerSchema = z.object({
  role: z.enum(['patient', 'doctor'], {
    errorMap: () => ({ message: 'Role must be either "patient" or "doctor"' }),
  }),
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long'),
  guardianPhone: z.string().trim().optional().default(''),
  department: z.string().trim().optional().default(''),
  yearsOfExperience: z
    .number()
    .min(0, 'Years of experience cannot be negative')
    .optional()
    .default(0),
  phone: z.string().trim().optional().default(''),
});

/**
 * Login validation schema
 */
const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

/**
 * Middleware factory for request body validation using Zod
 * @param {z.ZodSchema} schema
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.errors.map((e) => e.message);
    return res.status(400).json({
      error: issues[0] || 'Invalid request data',
      details: issues,
    });
  }
  req.body = result.data;
  next();
};

module.exports = {
  registerSchema,
  loginSchema,
  validateBody,
};

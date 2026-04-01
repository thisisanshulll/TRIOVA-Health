import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5'),
  message: { success: false, error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000'), // 1 min
  max: parseInt(process.env.RATE_LIMIT_API_MAX || '100'),
  message: { success: false, error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
});

export const uploadRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || '3600000'), // 1 hour
  max: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '10'),
  message: { success: false, error: 'Upload limit reached for this hour' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
});

export const ragRateLimiter = rateLimit({
  windowMs: 3600000, // 1 hour
  max: 30,
  message: { success: false, error: 'RAG query limit reached for this hour' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip || 'unknown',
});

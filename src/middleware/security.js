const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// =====================
// CORS configuration
// =====================
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser requests

    const allowedOrigins = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yourdomain.com'
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// =====================
// Security headers with Helmet
// =====================
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Socket.IO compatible
});

// =====================
// HTTP Parameter Pollution protection
// =====================
const hppProtection = hpp({
  whitelist: ['page', 'limit', 'sort', 'fields', 'before', 'after']
});

// =====================
// Helper function to get client IP (IPv6 compatible)
// =====================
const getClientIp = (req) => {
  // Try to get IP from various headers (for proxies)
  const ip = req.ip || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress ||
             req.connection?.socket?.remoteAddress;
  
  // Handle IPv6 format - convert to consistent format
  if (ip && ip.includes('::ffff:')) {
    return ip.replace('::ffff:', '');
  }
  
  return ip;
};

// =====================
// Rate limiters
// =====================

// General API limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests from this IP, please try again later.' }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req)
});

// Auth (login) limiter - more strict
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  message: {
    success: false,
    error: { code: 'AUTH_RATE_LIMIT', message: 'Too many authentication attempts, please try again later.' }
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => getClientIp(req)
});

// Message rate limiter - user-based with IP fallback
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each user to 60 messages per minute
  keyGenerator: (req) => {
    // Use user ID if available (authenticated users)
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    // Fallback to IP for unauthenticated (though messages should require auth)
    return getClientIp(req);
  },
  message: {
    success: false,
    error: { code: 'MESSAGE_RATE_LIMIT', message: 'Message rate limit exceeded. Please slow down.' }
  }
});

// =====================
// Export
// =====================
module.exports = {
  corsOptions,
  securityHeaders,
  mongoSanitize,
  xss,
  hppProtection,
  generalLimiter,
  authLimiter,
  messageLimiter
};
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { swaggerUi, specs } = require('./config/swagger');
const rateLimiters = require('./middleware/rateLimiter');
require('dotenv').config();

const app = express();

// =====================
// Middleware
// =====================
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =====================
// Rate limiting
// =====================
// Only apply rate limiters if not testing
if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimiters.api);
  app.use('/api/v1/auth', rateLimiters.auth);
  app.use('/api/v1/messages', rateLimiters.messages);
}

// =====================
// Health check
// =====================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// =====================
// Swagger Docs
// =====================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// =====================
// API Routes
// =====================
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/channels', require('./routes/channels'));
app.use('/api/v1/messages', require('./routes/messages'));

// =====================
// 404 Handler
// =====================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// =====================
// Error Handler
// =====================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error'
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = app;

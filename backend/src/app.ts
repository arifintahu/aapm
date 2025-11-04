import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import bettingRoutes from './routes/betting.js';
import { logger, loggerStream } from './utils/logger.js';
import { storage } from './storage/index.js';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database storage
async function initializeApp() {
  try {
    await storage.initialize();
    logger.info('✅ Database storage initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize database storage:', error);
    process.exit(1);
  }
}

// CORS configuration with environment variable support
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
const customOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : [];
const allowedOrigins = [...defaultOrigins, ...customOrigins];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging
app.use(morgan('combined', { stream: loggerStream }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/betting', bettingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Gasless Prediction Market API',
    version: '1.0.0',
    description: 'Backend API for gasless prediction market betting platform',
    endpoints: {
      auth: '/api/auth',
      events: '/api/events',
      betting: '/api/betting',
      health: '/api/health',
    },
    documentation: 'https://github.com/your-repo/api-docs',
  });
});

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack }),
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
async function startServer() {
  // Initialize database first
  await initializeApp();
  
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
    });
    
    logger.info('📊 API endpoints available:', {
      auth: `http://localhost:${PORT}/api/auth`,
      events: `http://localhost:${PORT}/api/events`,
      betting: `http://localhost:${PORT}/api/betting`,
      health: `http://localhost:${PORT}/api/health`,
    });
  });
}

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default app;

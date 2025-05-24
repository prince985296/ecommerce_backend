import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sequelize, initializeDatabase, checkConnectionHealth } from './config/db.js';

// Route imports
import userRoutes from './routes/createUserrouter.js';
import addressRoutes from './routes/addressRoutes.js';
import getAddressRoutes from './routes/getAddressroute.js';
import apiRoutes from './routes/api_routers.js';
import orderRoutes from './routes/getOrderrouters.js';
import adminDashbord from './routes/adminDashbord.js';
import adminloginRoute from './routes/adminLoginRoute.js';
import feedbackRoutes from './routes/feedbackRoutes.js';

// Initialize environment variables
dotenv.config();

const app = express();
const allowedOrigins = [
  'https://desitasty.com', 
  'https://staging.desitasty.com',
  process.env.LOCAL_ORIGIN // Add this to your Railway env vars if needed
];

// ------------------ Enhanced Middleware ------------------ //

// Security middleware with additional CSP configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", ...allowedOrigins]
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" }
}));

// Body parsing middleware with stricter limits
app.use(express.json({ 
  limit: '10kb',
  strict: true 
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10kb',
  parameterLimit: 10 
}));

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes

// Trust proxy settings for Railway
app.set('trust proxy', 1); // Trust first proxy

// Rate limiting with Redis storage (recommended for production)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Different limits for prod/dev
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '::ffff:127.0.0.1', // Skip for localhost
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: '15 minutes'
    });
  }
});

// ------------------ Route Enhancements ------------------ //

// Apply rate limiting
app.use(limiter);

// Health checks with database verification
app.get('/health', async (req, res) => {
  const dbHealth = await checkConnectionHealth();
  const status = dbHealth ? 'healthy' : 'degraded';
  
  res.status(dbHealth ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealth ? 'connected' : 'disconnected',
    memoryUsage: process.memoryUsage().rss / 1024 / 1024 + 'MB'
  });
});

// Mount routes
app.use('/api/auth', userRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/get-address', getAddressRoutes);
app.use('/api/get-orders', orderRoutes);
app.use('/admin/login', adminloginRoute);
app.use('/admin/dashboard', adminDashbord);
app.use('/api/feedback', feedbackRoutes);
app.use('/api', apiRoutes);

// Enhanced root route
app.get('/', (req, res) => {
  res.json({
    message: 'DesiTasty API Service',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    docs: 'https://docs.desitasty.com' // Add your API docs link
  });
});

// ------------------ Error Handling Improvements ------------------ //

// 404 Handler with more details
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      auth: '/api/auth',
      orders: '/api/get-orders',
      admin: '/admin'
    }
  });
});

// Production error handler
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log detailed error for server-side
  console.error(`[${new Date().toISOString()}] ${statusCode} ${req.method} ${req.path}`, {
    error: err.message,
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Client response
  res.status(statusCode).json({
    error: isProduction && statusCode === 500 ? 'Internal server error' : err.message,
    ...(!isProduction && { 
      stack: err.stack,
      details: err.details 
    })
  });
};

app.use(errorHandler);

// ------------------ Server Startup with Graceful Shutdown ------------------ //

const startServer = async () => {
  try {
    // Initialize database with retry logic
    let retries = 5;
    while (retries > 0) {
      try {
        await initializeDatabase();
        break;
      } catch (dbError) {
        retries--;
        console.error(`Database connection failed. Retries left: ${retries}`, dbError);
        if (retries === 0) throw dbError;
        await new Promise(res => setTimeout(res, 5000)); // Wait 5 seconds before retry
      }
    }

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`📚 API docs available at /api-docs`);
      console.log(`🩺 Health check at /health`);
    });

    // Graceful shutdown handlers
    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      
      // Close server first to stop accepting new connections
      server.close(async () => {
        console.log('HTTP server closed');
        
        // Then close database connections
        try {
          await sequelize.close();
          console.log('Database connections closed');
        } catch (dbError) {
          console.error('Error closing database connections:', dbError);
        }
        
        process.exit(0);
      });

      // Force shutdown after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        console.error('Forcing shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

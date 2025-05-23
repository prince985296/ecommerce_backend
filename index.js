import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sequelize } from './config/db.js';

// Route imports
import userRoutes from './routes/createUserrouter.js'; // Combined user routes
import addressRoutes from './routes/addressRoutes.js';
import getAddressRoutes from './routes/getAddressroute.js';
import apiRoutes from './routes/api_routers.js';
import orderRoutes from './routes/getOrderrouters.js';
import adminDashbord from './routes/adminDashbord.js';
import adminloginRoute from './routes/adminLoginRoute.js';
import feedbackRoutes from './routes/feedbackRoutes.js';


// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();
const allowedOrigins = ['https://desitasty.com', 'https://staging.desitasty.com'];


// ------------------ Middleware ------------------ //

// Security middleware
app.use(helmet());


// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  //origin:'*', // Use environment variable for CORS origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.set('trust proxy', true);

// Rate limiting - different limits for different routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many auth requests from this IP, please try again later'
});

// ------------------ Routes ------------------ //
// Apply rate limiting to appropriate routes
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// User routes
app.use('/api/auth', userRoutes); // Assuming this combines getOrCreateUser and getAllUser

// Address routes
app.use('/api/address', addressRoutes);
app.use('/api/get-address', getAddressRoutes);

// Order routes
app.use('/api/get-orders', orderRoutes);

// Admin routes
app.use('/admin/login', adminloginRoute);
app.use('/admin/dashboard', adminDashbord);

// Feedback routes
app.use('/api/feedback', feedbackRoutes);

// General API
app.use('/api', apiRoutes);

// ------------------ Health Checks ------------------ //
//app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.get('/db-health', async (req, res) => {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query('SELECT 1+1 AS result');
    res.json({ 
      status: 'healthy',
      dbResult: results[0].result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err.stack);

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An error occurred' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
});

// ------------------ Server Startup ------------------ //
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');


    
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};


startServer();

export default app;

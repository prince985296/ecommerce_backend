import { Sequelize, DataTypes } from 'sequelize';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  timezone: '+00:00',
  connectTimeout: 30000, // 30 seconds
  connectionLimit: 10,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_CA_CERT // Add CA cert in production
  } : undefined
};

// MySQL2 Connection Pool
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Pool event listeners for monitoring
pool.on('acquire', (connection) => {
  console.log(`Connection ${connection.threadId} acquired`);
});

pool.on('release', (connection) => {
  console.log(`Connection ${connection.threadId} released`);
});

pool.on('enqueue', () => {
  console.log('Waiting for available connection slot');
});

// Sequelize Configuration
const sequelize = new Sequelize({
  dialect: 'mysql',
  username: dbConfig.user,
  password: dbConfig.password,
  host: dbConfig.host,
  database: dbConfig.database,
  port: dbConfig.port,
  dialectOptions: {
    connectTimeout: 30000,
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: true,
    ssl: dbConfig.ssl
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
    evict: 1000
  },
  retry: {
    max: 5,
    match: [
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /SequelizeConnectionError/,
      /ENETUNREACH/,
      /EHOSTUNREACH/
    ],
    backoffBase: 1000,
    backoffExponent: 1.5
  },
  logging: process.env.NODE_ENV === 'development' ? 
    (msg) => console.log(`[Sequelize] ${msg}`) : 
    false
});

// Define Order Model
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  razorpay_order_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'INR',
  },
  receipt: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Pending',
  },
  items: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  address: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  razorpay_payment_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  razorpay_signature: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'orders',
  timestamps: true,
});

// Database Initialization
export async function initializeDatabase() {
  try {
    // Test both connections
    await sequelize.authenticate();
    console.log('Sequelize connection established');
    
    const testConn = await pool.getConnection();
    await testConn.ping();
    testConn.release();
    console.log('MySQL pool connection established');
    
    // Sync models
    await sequelize.sync({ 
      alter: process.env.NODE_ENV === 'development',
      logging: process.env.NODE_ENV === 'development' ? console.log : false
    });
    
    console.log('✅ Database synchronized');
    startHealthChecks();
  } catch (error) {
    console.error('❌ Database initialization failed:');
    logDatabaseError(error);
    process.exit(1);
  }
}

// Error logging helper
function logDatabaseError(error) {
  console.error('- Error name:', error.name);
  console.error('- Error message:', error.message);
  console.error('- Error code:', error.original?.code);
  console.error('- Error details:', error.original?.sqlMessage);
  
  if (error.original?.code === 'HANDSHAKE_SSL_ERROR') {
    console.error('SSL handshake failed. Verify your SSL configuration');
  }
}

// Connection Health Management
let healthCheckInterval;

export async function checkConnectionHealth() {
  try {
    // Check Sequelize connection
    await sequelize.query('SELECT 1');
    
    // Check raw MySQL connection
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    
    return true;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

function startHealthChecks() {
  // Clear existing interval if any
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  
  // Run every 5 minutes
  healthCheckInterval = setInterval(async () => {
    const isHealthy = await checkConnectionHealth();
    if (!isHealthy) {
      console.warn('Database connection unhealthy - attempting to reconnect');
      try {
        await sequelize.close();
        await initializeDatabase();
      } catch (reconnectError) {
        console.error('Reconnection failed:', reconnectError);
      }
    }
  }, 300000); // 5 minutes
}

// Query Helper
export async function query(sql, params = []) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Database operation failed');
  } finally {
    if (connection) connection.release();
  }
}

// Order Operations
export async function createOrderRecord(orderData, transaction) {
  try {
    return await Order.create(orderData, { transaction });
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

export async function updateOrderPayment(orderId, paymentData, transaction) {
  try {
    const order = await Order.findByPk(orderId, { transaction });
    if (!order) throw new Error('Order not found');
    return await order.update(paymentData, { transaction });
  } catch (error) {
    console.error('Error updating order:', error);
    throw error;
  }
}

export async function getOrderByRazorpayId(razorpayOrderId, transaction) {
  try {
    return await Order.findOne({ 
      where: { razorpay_order_id: razorpayOrderId }, 
      transaction 
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    throw error;
  }
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  clearInterval(healthCheckInterval);
  await sequelize.close();
  await pool.end();
  process.exit(0);
});

export { 
  sequelize, 
  Order,
  pool,
  initializeDatabase,
  checkConnectionHealth
};

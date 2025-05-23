import { Sequelize, DataTypes } from 'sequelize';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST ,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT) || 3306,
  family: 4,  // Force IPv4 connection
  timezone: '+00:00',
  connectTimeout: 10000, 
  connectionLimit: 10,  
  ssl: process.env.NODE_ENV === 'production' ? {
  rejectUnauthorized: false // Less secure but works
} : undefined
};

// MySQL2 Connection Pool
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true
});

export async function query(sql, params = []) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params); // ✅ only return rows
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Database operation failed');
  } finally {
    if (connection) connection.release();
  }
}

export default {
  query, // 👈 important: export the query function
};


const sequelize = new Sequelize({
  dialect: 'mysql',
  username: dbConfig.user,
  password: dbConfig.password,
  host: dbConfig.host,
  database: dbConfig.database,
  port: dbConfig.port || 3306,
  family: 4,
  dialectOptions: {
    connectTimeout: 30000,
    timezone: 'Z',
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : undefined
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    evict: 1000,
    idle: 10000
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
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});




//Define Order model
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

// Sync models with the database
export async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Sequelize connection established');
    
    const testConn = await pool.getConnection();
    console.log('Raw MySQL connection established');
    testConn.release();
    
    await sequelize.sync({ 
      alter: process.env.NODE_ENV === 'development',
      logging: console.log // Show sync queries
    });
    console.log('✅ Database synchronized');
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('- Error name:', error.name);
    console.error('- Error message:', error.message);
    console.error('- Error code:', error.original?.code);
    console.error('- Error details:', error.original?.sqlMessage);
    
    // Additional debugging for SSL issues
    if (error.original?.code === 'HANDSHAKE_SSL_ERROR') {
      console.error('SSL handshake failed. Verify your SSL configuration:');
      console.error('1. Check if your CA certificate is correct');
      console.error('2. Try with rejectUnauthorized: false temporarily');
    }
    
    process.exit(1);
  }
}

// Create Order Record
export async function createOrderRecord(orderData, transaction) {
  try {
    const order = await Order.create(orderData, { transaction });
    return order;
  } catch (error) {
    console.error('❌ Error creating order record:', error);
    throw error;
  }
}

// Update Order Payment
export async function updateOrderPayment(orderId, paymentData, transaction) {
  try {
    const order = await Order.findByPk(orderId, { transaction });
    if (!order) {
      throw new Error('Order not found');
    }
    await order.update(paymentData, { transaction });
    return order;
  } catch (error) {
    console.error('❌ Error updating order payment:', error);
    throw error;
  }
}

// Get Order by Razorpay ID
export async function getOrderByRazorpayId(razorpayOrderId, transaction) {
  try {
    const order = await Order.findOne({ where: { razorpay_order_id: razorpayOrderId }, transaction });
    return order;
  } catch (error) {
    console.error('❌ Error fetching order by Razorpay ID:', error);
    throw error;
  }
}

export { sequelize, Order };
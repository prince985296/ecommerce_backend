import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
dotenv.config();

export async function adminlogin(username, password) {
  try {
    const result = await db.query('SELECT * FROM admin WHERE username = ?', [username]);
    const rows = Array.isArray(result) ? result[0] : result;

    console.log('DB result:', rows);

    const user = rows;

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    console.log('Input password:', password);
    console.log('Stored hash:', user.password);
    console.log('Match:', bcrypt.compareSync(password, user.password));

if (passwordMatch && user.isAdmin == 1) {
  const token = jwt.sign(
    { id: user.id, username: user.username, role: 'admin' },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '2h' }
  );
  return { success: true, token };
} else {
  return { success: false, message: 'Unauthorized access' };
}
  } catch (error) {
    console.error('Admin login error:', error);
    throw new Error('Database operation failed');
  }
}

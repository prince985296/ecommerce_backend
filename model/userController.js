import db from '../config/db.js';


export async function getOrCreateUserByPhone(uid, phone) {
  try {
    // Check if user already exists
    const rows = await db.query('SELECT * FROM users WHERE uid = ?', [uid]);

    if (rows.length > 0) {
      return rows[0];
    }

    // User doesn't exist — insert new
    await db.query('INSERT INTO users (uid, phone) VALUES (?, ?)', [uid, phone]);

    // Fetch and return the newly created user
    const newUser = await db.query('SELECT * FROM users WHERE uid = ?', [uid]);
    return newUser[0];

  } catch (err) {
    console.error('User DB error:', err);
    throw new Error('Database operation failed');
  }
}

export const viewUserinAdminPanal= async(req, res)=> {
  try {
    const result = await db.query('select * from users');
    if(result.length > 0){
      res.json(result)
    } else {
      res.status(404).json({ message: 'No user found' })
    }

  } catch (error) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

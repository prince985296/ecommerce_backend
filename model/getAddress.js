// controllers/getAddress.js
import db from '../config/db.js';

export const getAddress = async (req, res) => {
  const uid = req.params.uid;
  console.log("UID received:", uid);

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  try {
    const results = await db.query('SELECT * FROM addresses WHERE uid = ?', [uid]); // ✅ clean results
    console.log("Address results:", results);

    if (results.length > 0) {
      res.json(results);
    } else {
      res.status(404).json({ message: 'No address found for this UID' });
    }
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default getAddress;

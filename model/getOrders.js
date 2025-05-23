import db from '../config/db.js';


export const getAllOrders = async (req, res) => {
  try {
    const results = await db.query('select * from orders');

    if (results.length > 0) {
      res.json(results);
    } else {
      res.status(404).json({ message: 'No orders found' });
    }
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllOrders_uid = async (req, res) => {
  const uid = req.params.uid;

  if (!uid) {
    return res.status(400).json({ error: "UID is required" });
  }

  try {
    const results = await db.query('SELECT * FROM orders WHERE user_id = ?', [uid]);

    if (results.length > 0) {
      res.json(results);
    } else {
      res.status(404).json({ message: 'No orders found for this UID' });
    }
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



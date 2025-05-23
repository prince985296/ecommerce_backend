import express from 'express';
import { adminlogin } from '../controllers/adminLogin.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await adminlogin(username, password);

    if (result.success) {
      res.status(200).json({ message: 'Login successful', token: result.token });
    } else {
      res.status(401).json({ message: result.message });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

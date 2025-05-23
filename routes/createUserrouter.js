import express from 'express';
import { getOrCreateUserByPhone, viewUserinAdminPanal } from '../model/userController.js';
import verifyFirebaseToken  from '../middleware/firebase_auth_middleware.js';
const router = express.Router();

router.post('/',verifyFirebaseToken, async (req, res) => {
  const { uid, phone } = req.body;

  try {
    const user = await getOrCreateUserByPhone(uid, phone);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ success: false, message: 'User lookup or creation failed' });
  }
});

router.get('/',viewUserinAdminPanal);

export default router;

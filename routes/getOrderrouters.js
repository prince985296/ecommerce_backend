import express from 'express';
import { getAllOrders_uid, getAllOrders } from '../model/getOrders.js';

const router = express.Router();

// ✅ More specific route first
router.get('/allorders', getAllOrders);

// ✅ Dynamic route after
router.get('/:uid', getAllOrders_uid);

export default router;

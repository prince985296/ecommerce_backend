import express from 'express';
import { submitCoupon } from '../model/coupon.js';

const router = express.Router();

// POST /api/coupon/apply
router.post('/apply', submitCoupon);

export default router;
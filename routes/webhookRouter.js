import express from 'express';
import crypto from 'crypto';
import { sequelize, Order } from '../config/db.js'; // Adjust the path as per your file structure

const router = express.Router();
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Razorpay Webhook Handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(body)) // use stringified body
    .digest('hex');

  if (signature === expectedSignature) {
    console.log('✅ Webhook verified');

    const event = body.event;

    if (event === 'refund.processed') {
      const refund = body.payload.refund.entity;
      const paymentId = refund.payment_id;

      try {
        // Start transaction
        await sequelize.transaction(async (t) => {
          const order = await Order.findOne({
            where: { razorpay_payment_id: paymentId },
            transaction: t,
          });

          if (order) {
            order.status = 'Refunded';
            await order.save({ transaction: t });
            console.log(`🔁 Order ID ${order.id} status updated to 'Refunded'`);
          } else {
            console.warn('⚠️ Order not found for refund payment ID:', paymentId);
          }
        });

        res.status(200).send('Webhook handled');
      } catch (err) {
        console.error('❌ Error handling webhook:', err);
        res.status(500).send('Webhook error');
      }
    } else {
      res.status(200).send('Unhandled event');
    }
  } else {
    console.warn('❌ Invalid webhook signature');
    res.status(400).send('Invalid signature');
  }
});

export default router;

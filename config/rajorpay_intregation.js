
import Razorpay from 'razorpay';
import crypto from 'crypto'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order
async function createOrder(amount, receipt, user_id) {
  const options = {
    amount: amount, // Razorpay expects amount in paise
    currency: "INR",
    receipt: receipt,
    notes: {
      userId: user_id
    }
  };

  try {
    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
}

// Verify payment signature
function verifyPaymentSignature(orderId, paymentId, signature) {
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(orderId + "|" + paymentId)
    .digest('hex');
    
  return generatedSignature === signature;
}

export  { razorpay, createOrder, verifyPaymentSignature };
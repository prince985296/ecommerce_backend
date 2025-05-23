import express from "express";
import { body, validationResult } from "express-validator";
import verifyFirebaseToken from "../middleware/firebase_auth_middleware.js";
import { sendThankYouEmail } from "../utils/emailService_order_complet.js";
import {
  verifyPaymentSignature,
  createOrder as createRazorpayOrder,
} from "../config/rajorpay_intregation.js";
import {
  createOrderRecord,
  updateOrderPayment,
  getOrderByRazorpayId,
  sequelize,
} from "../config/db.js";
import { getOrCreateUserByPhone } from "../model/userController.js";

const router = express.Router();

class PaymentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = "PaymentError";
  }
}

// Create order endpoint
router.post(
  "/create-order",
  verifyFirebaseToken,
  [
    body("amount")
      .isInt({ min: 100 })
      .withMessage("Amount must be at least ₹1"),
    body("receipt").isString().notEmpty().withMessage("Receipt ID is required"),
    body("currency")
      .optional()
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be 3 characters"),
    body("items")
      .isArray({ min: 1 })
      .withMessage("Items must be an array with at least one item"),
    body('address.*.email')
  .isEmail()
  .withMessage('Must provide a valid email in address'),
  ],
  
  
  async (req, res) => {
    console.log("Incoming request body:", req.body);
    const transaction = await sequelize.transaction();
    //console.log('Order creation error:', transaction);

    try {
      console.log("🔥 Starting create-order");
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await transaction.rollback();
        return res.status(400).json({ errors: errors.array() });
      }

      const { amount, receipt, currency = "INR", items, address } = req.body;
      const { uid, phone } = req.user; // Assuming req.user comes from verifyFirebaseToken
      console.log("✅ Request body:", {
        amount,
        receipt,
        currency,
        items,
        address,
      });
      console.log("✅ User from Firebase:", { uid, phone });

      //Get or create user
      const user = await getOrCreateUserByPhone(uid, phone);

      console.log("✅ User found or created:", user);
      if (!user) {
        throw new PaymentError("Failed to create user account");
      }

      // Create Razorpay order
      const razorpayOrder = await createRazorpayOrder(
        amount,
        receipt,
        currency
      );
      console.log("✅ Razorpay order created:", razorpayOrder);
      // Save order to database
      const orderData = {
        razorpay_order_id: razorpayOrder.id,
        user_id: user.uid, // or user.id depending on your user model
        amount: amount,
        currency: currency,
        receipt: receipt,
        items: items,
        address: address,
        status: "created",
      };

      await createOrderRecord(orderData, transaction);
      console.log("✅ Order saved in DB");
      await transaction.commit();
      console.log("✅ Transaction committed successfully");

      res.status(201).json({
        success: true,
        order: razorpayOrder,
        user: {
          uid: user.uid,
          phone: user.phone,
        },
      });
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
        console.log("⚠️ Transaction rolled back due to error");
      }

      console.error("❌ Order creation error:", error);
      const statusCode = error instanceof PaymentError ? error.statusCode : 500;
      const message =
        error instanceof PaymentError
          ? error.message
          : "Failed to create order";

      res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === "development" && { details: error.stack }),
      });
    }
  }
);

// Payment verification endpoint
router.post(
  "/verify-payment",
  verifyFirebaseToken,
  [
    body("order_id").isString().notEmpty().withMessage("Order ID is required"),
    body("payment_id")
      .isString()
      .notEmpty()
      .withMessage("Payment ID is required"),
    body("signature")
      .isString()
      .notEmpty()
      .withMessage("Signature is required"),
  ],
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      console.log("🔥 Starting payment verification");
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log("❌ Validation errors:", errors.array());
        await transaction.rollback();
        return res.status(400).json({ errors: errors.array() });
      }

      const { order_id, payment_id, signature } = req.body;
      const { uid } = req.user;
      console.log("✅ Payment details received:", {
        order_id,
        payment_id,
        signature,
      });
      console.log("✅ User UID:", uid);

      // Verify payment signature
      const isValid = verifyPaymentSignature(order_id, payment_id, signature);

      if (!isValid) {
        console.log("❌ Invalid payment signature");
        await transaction.rollback();
        throw new PaymentError("Invalid payment signature");
      }

      // Check if order exists and belongs to user
      const order = await getOrderByRazorpayId(order_id, transaction);
      console.log("✅ Order from DB:", order);
      if (!order) {
        console.log("❌ UID mismatch:", {
          orderUser: order.user_id,
          currentUser: uid,
        });
        await transaction.rollback();
        throw new PaymentError("Order not found", 404);
      }

      if (order.user_id !== uid) {
        await transaction.rollback();
        throw new PaymentError("Unauthorized access to order", 403);
      }

      // Prevent duplicate payments
      if (order.status === "paid") {
        console.log("⚠️ Duplicate payment attempt");
        await transaction.rollback();
        throw new PaymentError("Payment already processed");
      }

      // Update order
      // ... existing code ...
      await updateOrderPayment(
        order.id,
        {
          razorpay_payment_id: payment_id,
          razorpay_signature: signature,
          status: "paid",
          paid_at: new Date(),
        },
        transaction
      );

      //Parse the address string into an object
      let orderAddress;
      try {
        orderAddress = JSON.parse(order.address);
        console.log("✅ Parsed address:", orderAddress);
      } catch (error) {
        console.error("❌ Error parsing address:", error);
        orderAddress = [];
      }

      const email = Array.isArray(orderAddress) && orderAddress.length > 0 
        ? orderAddress[0].email 
        : null;

      console.log("✅ Email found in order address:", email);

      if (email) {
        // Send thank you email
        await sendThankYouEmail(email, {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          status: "paid",
          paid_at: new Date(),
          // Include address details if needed
          address: orderAddress[0],
        }).catch((e) => console.error("Email sending failed:", e));
      } else {
        console.log("No email found in order address");
      }
// ... existing code ...
      await transaction.commit();
      console.log("✅ Transaction committed for payment");
      // Here you might want to trigger fulfillment logic (email, etc.)

      res.json({
        success: true,
        message: "Payment verified successfully",
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
          status: "paid",
          paid_at: new Date(),
        },
      });
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
        console.log("⚠️ Transaction rolled back due to error");
      }

      console.error("❌ Payment verification error:", error);
      const statusCode = error instanceof PaymentError ? error.statusCode : 500;
      const message =
        error instanceof PaymentError
          ? error.message
          : "Payment verification failed";

      res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV === "development" && { details: error.stack }),
      });
    }
  }
);

export default router;

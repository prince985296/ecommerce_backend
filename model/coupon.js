import db from '../config/db.js';

export const submitCoupon = async (req, res) => {
    const { couponCode } = req.body;

    if (!couponCode) {
        return res.status(400).json({ 
            valid: false, 
            message: "Coupon code is required" 
        });
    }

    try {
        const [rows] = await db.query(
            `SELECT * FROM coupons 
             WHERE code = ? 
             AND is_active = TRUE 
             AND expiry_date > NOW()`,
            [couponCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({ 
                valid: false, 
                message: "Invalid or expired coupon" 
            });
        }

        const coupon = rows[0];
        return res.json({
            valid: true,
            discount: coupon.discount_percentage,
            couponId: coupon.id,
            message: "Coupon applied successfully",
        });

    } catch (err) {
        console.error("Coupon validation error:", err);
        return res.status(500).json({ 
            valid: false,
            message: "Server error during coupon validation" 
        });
    }
};
import db from '../config/db.js'

export const submitAddress = async (req, res) => {
  console.log("📩 submitAddress called");

  const {
    uid,
    firstName = null,
    lastName = null,
    houseDetails = null,
    areaDetails = null,
    landmark = null,
    city = null,
    state = null,
    pincode = null,
    phone = null,
    email = null,
  } = req.body;


  if (!uid || !firstName || !pincode) {
    return res.status(400).json({
      error: "Validation failed",
      details: "UID, First Name, and Pincode are required"
    });
  }

  try {
    const [userRows] = await db.query('SELECT id FROM users WHERE uid = ?', [uid]);
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({
        error: "User not found",
        details: "Please register this UID first"
      });
    }

    const addressData = {
      uid,
      firstName,
      lastName,
      houseDetails,
      areaDetails,
      landmark,
      city,
      state,
      pincode,
      phone,
      email
    };
    

    const addressRows = await db.query('SELECT id FROM addresses WHERE uid = ?', [uid]);

    const columns = Object.keys(addressData);
    const values = Object.values(addressData);
    
    if (addressRows && addressRows.length > 0) {
      
      // Update existing address
      const updateSQL = `UPDATE addresses SET ${columns.map(col => `${col}=?`).join(', ')} WHERE uid = ?`;
      await db.query(updateSQL, [...values, uid]);

      return res.json({
        success: true,
        message: "Address updated successfully",
        action: "update"
      });
    } else {
      // Insert new address
      const insertSQL = `INSERT INTO addresses (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
      const insertResult = await db.query(insertSQL, values);

      return res.status(201).json({
        success: true,
        message: "Address created successfully",
        action: "create",
        addressId: insertResult.insertId
      });
    }

  } catch (err) {
    console.error("Address submission error:", err);

    return res.status(500).json({
      error: "Server error",
      details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later'
    });
  }
};

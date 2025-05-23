import express from 'express'

import jwt from 'jsonwebtoken';

const router = express.Router();

router.get("/", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (decoded.role === 'admin') {
      res.status(200).json({ message: "Welcome to the admin dashboard" });
    } else {
      res.status(403).json({ message: "Access forbidden" });
    }
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router

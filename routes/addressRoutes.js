// routes/addressRoutes.js
import express from "express";
import { submitAddress } from "../model/address.js";

const router = express.Router();
router.post("/", submitAddress); 
export default router;

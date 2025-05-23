import express from 'express';
import { getAddress } from '../model/getAddress.js';

const router = express.Router();

// Mount GET route
router.get('/:uid', getAddress);

export default router;

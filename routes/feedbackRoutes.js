// routes/feedbackRoutes.js
import express from 'express';
import { submitFeedback , viewfeedbackinAdminPanal } from '../controllers/feedBackController.js';

const router = express.Router();
router.post('/', submitFeedback);
router.get('/', viewfeedbackinAdminPanal);

// POST /api/feedback
export default router;

import express from 'express';
import { statisticsController } from '../controllers/statisticsController.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get daily stats (authenticated)
router.get('/daily', authMiddleware, statisticsController.getDailyStats);

// Get overall stats (authenticated)
router.get('/overall', authMiddleware, statisticsController.getOverallStats);

// Get category stats (authenticated)
router.get('/category', authMiddleware, statisticsController.getCategoryStats);

// Get keyword stats (authenticated)
router.get('/keywords', authMiddleware, statisticsController.getKeywordStats);

export default router;

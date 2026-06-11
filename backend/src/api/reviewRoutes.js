import express from 'express';
import { reviewController } from '../controllers/reviewController.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Get pending reviews (reviewers only)
router.get('/pending', authMiddleware, roleMiddleware(['reviewer', 'admin']), reviewController.getPendingReviews);

// Submit review (reviewers only)
router.post('/', authMiddleware, roleMiddleware(['reviewer', 'admin']), reviewController.submitReview);

// Update review (reviewers only)
router.put('/:reviewId', authMiddleware, roleMiddleware(['reviewer', 'admin']), reviewController.updateReview);

// Get review history (authenticated)
router.get('/:videoId/history', authMiddleware, reviewController.getReviewHistory);

// Get audit log (authenticated)
router.get('/:videoId/log', authMiddleware, reviewController.getAuditLog);

export default router;

import { reviewService } from '../services/reviewService.js';
import { logger } from '../utils/helpers.js';

export const reviewController = {
  async getPendingReviews(req, res) {
    try {
      const { limit = 20, offset = 0, riskLevel } = req.query;
      const result = await reviewService.getPendingReviews(
        parseInt(limit),
        parseInt(offset),
        { riskLevel }
      );
      res.json(result);
    } catch (error) {
      logger.error('Get pending reviews error', error);
      res.status(500).json({ error: 'Failed to fetch pending reviews' });
    }
  },

  async submitReview(req, res) {
    try {
      const { videoId, auditResultId, finalDecision, reviewComment } = req.body;

      if (!finalDecision || !reviewComment) {
        return res.status(400).json({ error: 'finalDecision and reviewComment are required' });
      }

      if (!['pass', 'violation', 'appeal_pending'].includes(finalDecision)) {
        return res.status(400).json({ error: 'Invalid finalDecision' });
      }

      if (reviewComment.trim().length === 0) {
        return res.status(400).json({ error: 'Review comment cannot be empty' });
      }

      const review = await reviewService.submitReview(
        videoId,
        auditResultId,
        req.user.id,
        finalDecision,
        reviewComment
      );

      res.status(201).json({
        message: 'Review submitted successfully',
        review,
      });
    } catch (error) {
      logger.error('Submit review error', error);
      res.status(500).json({ error: 'Failed to submit review' });
    }
  },

  async updateReview(req, res) {
    try {
      const { reviewId } = req.params;
      const { finalDecision, reviewComment } = req.body;

      if (!finalDecision || !reviewComment) {
        return res.status(400).json({ error: 'finalDecision and reviewComment are required' });
      }

      const review = await reviewService.updateReview(
        reviewId,
        finalDecision,
        reviewComment,
        req.user.id
      );

      res.json({
        message: 'Review updated successfully',
        review,
      });
    } catch (error) {
      logger.error('Update review error', error);
      res.status(500).json({ error: 'Failed to update review' });
    }
  },

  async getReviewHistory(req, res) {
    try {
      const { videoId } = req.params;
      const reviews = await reviewService.getReviewHistory(videoId);
      res.json(reviews);
    } catch (error) {
      logger.error('Get review history error', error);
      res.status(500).json({ error: 'Failed to fetch review history' });
    }
  },

  async getAuditLog(req, res) {
    try {
      const { videoId } = req.params;
      const logs = await reviewService.getAuditLog(videoId);
      res.json(logs);
    } catch (error) {
      logger.error('Get audit log error', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  },
};

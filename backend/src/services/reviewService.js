import { Review, AuditLog, Video, AuditResult } from '../models/index.js';
import { logger } from '../utils/helpers.js';
import { Op } from 'sequelize';

export const reviewService = {
  async getPendingReviews(limit = 20, offset = 0, filters = {}) {
    try {
      const where = { riskLevel: { [Op.in]: ['suspicious', 'violation'] } };

      if (filters.riskLevel) {
        where.riskLevel = filters.riskLevel;
      }

      const { count, rows } = await AuditResult.findAndCountAll({
        where,
        include: [
          {
            association: 'video',
            include: [{ association: 'uploader', attributes: ['id', 'username'] }],
          },
        ],
        limit,
        offset,
        order: [['processedAt', 'DESC']],
      });

      return { total: count, pendingReviews: rows };
    } catch (error) {
      logger.error('Error fetching pending reviews', error);
      throw error;
    }
  },

  async submitReview(videoId, auditResultId, reviewerId, finalDecision, reviewComment) {
    try {
      const auditResult = await AuditResult.findByPk(auditResultId);

      const review = await Review.create({
        videoId,
        auditResultId,
        reviewerId,
        originalRiskLevel: auditResult.riskLevel,
        finalDecision,
        reviewComment,
      });

      // Create audit log
      await AuditLog.create({
        videoId,
        reviewId: review.id,
        operatorId: reviewerId,
        operationType: 'created',
        statusBefore: auditResult.riskLevel,
        statusAfter: finalDecision,
        changeSummary: `AI decision: ${auditResult.riskLevel}, Reviewer decision: ${finalDecision}`,
      });

      logger.info('Review submitted', { videoId, reviewId: review.id, decision: finalDecision });
      return review;
    } catch (error) {
      logger.error('Error submitting review', error);
      throw error;
    }
  },

  async updateReview(reviewId, finalDecision, reviewComment, operatorId) {
    try {
      const review = await Review.findByPk(reviewId);

      if (!review) {
        throw new Error('Review not found');
      }

      const oldDecision = review.finalDecision;

      await Review.update(
        { finalDecision, reviewComment },
        { where: { id: reviewId } }
      );

      // Create audit log
      await AuditLog.create({
        videoId: review.videoId,
        reviewId,
        operatorId,
        operationType: 'updated',
        statusBefore: oldDecision,
        statusAfter: finalDecision,
        changeSummary: `Decision updated from ${oldDecision} to ${finalDecision}`,
      });

      logger.info('Review updated', { reviewId, newDecision: finalDecision });
      return review;
    } catch (error) {
      logger.error('Error updating review', error);
      throw error;
    }
  },

  async getReviewHistory(videoId) {
    try {
      const reviews = await Review.findAll({
        where: { videoId },
        include: [
          { association: 'reviewer', attributes: ['id', 'username'] },
        ],
        order: [['reviewedAt', 'DESC']],
      });
      return reviews;
    } catch (error) {
      logger.error('Error fetching review history', error);
      throw error;
    }
  },

  async getAuditLog(videoId) {
    try {
      const logs = await AuditLog.findAll({
        where: { videoId },
        include: [
          { association: 'operator', attributes: ['id', 'username'] },
          { association: 'review' },
        ],
        order: [['operatedAt', 'DESC']],
      });
      return logs;
    } catch (error) {
      logger.error('Error fetching audit log', error);
      throw error;
    }
  },
};

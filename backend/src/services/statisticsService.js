import { Video, AuditResult, Review } from '../models/index.js';
import { logger } from '../utils/helpers.js';
import { Op } from 'sequelize';

export const statisticsService = {
  async getDailyStats(date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const uploadCount = await Video.count({
        where: {
          uploadedAt: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
      });

      const processedCount = await AuditResult.count({
        where: {
          processedAt: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
      });

      const auditResults = await AuditResult.findAll({
        where: {
          processedAt: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
      });

      const riskLevelCounts = {
        pass: auditResults.filter(r => r.riskLevel === 'pass').length,
        suspicious: auditResults.filter(r => r.riskLevel === 'suspicious').length,
        violation: auditResults.filter(r => r.riskLevel === 'violation').length,
      };

      const reviewCount = await Review.count({
        where: {
          reviewedAt: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
      });

      const reviews = await Review.findAll({
        where: {
          reviewedAt: {
            [Op.between]: [startOfDay, endOfDay],
          },
        },
      });

      const reviewDecisions = {
        pass: reviews.filter(r => r.finalDecision === 'pass').length,
        violation: reviews.filter(r => r.finalDecision === 'violation').length,
        appeal_pending: reviews.filter(r => r.finalDecision === 'appeal_pending').length,
      };

      const aiPassRate = processedCount > 0 ? ((riskLevelCounts.pass / processedCount) * 100).toFixed(2) : 0;
      const reviewPassRate = reviewCount > 0 ? ((reviewDecisions.pass / reviewCount) * 100).toFixed(2) : 0;

      return {
        date: date.toISOString().split('T')[0],
        uploadCount,
        processedCount,
        reviewCount,
        riskLevelDistribution: riskLevelCounts,
        reviewDecisions,
        aiPassRate: parseFloat(aiPassRate),
        reviewPassRate: parseFloat(reviewPassRate),
      };
    } catch (error) {
      logger.error('Error fetching daily stats', error);
      throw error;
    }
  },

  async getOverallStats() {
    try {
      const totalUploads = await Video.count();
      const totalProcessed = await AuditResult.count();
      const totalReviews = await Review.count();

      const auditResults = await AuditResult.findAll();
      const reviews = await Review.findAll();

      const riskLevelCounts = {
        pass: auditResults.filter(r => r.riskLevel === 'pass').length,
        suspicious: auditResults.filter(r => r.riskLevel === 'suspicious').length,
        violation: auditResults.filter(r => r.riskLevel === 'violation').length,
      };

      const reviewDecisions = {
        pass: reviews.filter(r => r.finalDecision === 'pass').length,
        violation: reviews.filter(r => r.finalDecision === 'violation').length,
        appeal_pending: reviews.filter(r => r.finalDecision === 'appeal_pending').length,
      };

      return {
        totalUploads,
        totalProcessed,
        totalReviews,
        riskLevelDistribution: riskLevelCounts,
        reviewDecisions,
      };
    } catch (error) {
      logger.error('Error fetching overall stats', error);
      throw error;
    }
  },

  async getCategoryStats() {
    try {
      const videos = await Video.findAll({
        attributes: ['category'],
      });

      const categoryCount = {};
      videos.forEach(v => {
        categoryCount[v.category] = (categoryCount[v.category] || 0) + 1;
      });

      return categoryCount;
    } catch (error) {
      logger.error('Error fetching category stats', error);
      throw error;
    }
  },

  async getKeywordStats() {
    try {
      const auditResults = await AuditResult.findAll({
        attributes: ['sensitiveKeywords'],
      });

      const keywordCount = {};
      auditResults.forEach(result => {
        if (result.sensitiveKeywords && Array.isArray(result.sensitiveKeywords)) {
          result.sensitiveKeywords.forEach(kw => {
            keywordCount[kw] = (keywordCount[kw] || 0) + 1;
          });
        }
      });

      // Sort by count and get top 20
      const sortedKeywords = Object.entries(keywordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      return Object.fromEntries(sortedKeywords);
    } catch (error) {
      logger.error('Error fetching keyword stats', error);
      throw error;
    }
  },
};

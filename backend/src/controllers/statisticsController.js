import { statisticsService } from '../services/statisticsService.js';
import { logger } from '../utils/helpers.js';

export const statisticsController = {
  async getDailyStats(req, res) {
    try {
      const { date } = req.query;
      const statsDate = date ? new Date(date) : new Date();
      const stats = await statisticsService.getDailyStats(statsDate);
      res.json(stats);
    } catch (error) {
      logger.error('Get daily stats error', error);
      res.status(500).json({ error: 'Failed to fetch daily stats' });
    }
  },

  async getOverallStats(req, res) {
    try {
      const stats = await statisticsService.getOverallStats();
      res.json(stats);
    } catch (error) {
      logger.error('Get overall stats error', error);
      res.status(500).json({ error: 'Failed to fetch overall stats' });
    }
  },

  async getCategoryStats(req, res) {
    try {
      const stats = await statisticsService.getCategoryStats();
      res.json(stats);
    } catch (error) {
      logger.error('Get category stats error', error);
      res.status(500).json({ error: 'Failed to fetch category stats' });
    }
  },

  async getKeywordStats(req, res) {
    try {
      const stats = await statisticsService.getKeywordStats();
      res.json(stats);
    } catch (error) {
      logger.error('Get keyword stats error', error);
      res.status(500).json({ error: 'Failed to fetch keyword stats' });
    }
  },
};

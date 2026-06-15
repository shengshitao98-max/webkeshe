import express from 'express';
import AuditResult from '../models/AuditResult.js';
import Video from '../models/Video.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get all audit results
router.get('/', async (req, res) => {
  try {
    const auditResults = await AuditResult.findAll({
      include: [{
        model: Video,
        as: 'video',
      }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ auditResults });
  } catch (error) {
    logger.error('Get audit results error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit result by ID
router.get('/:id', async (req, res) => {
  try {
    const auditResult = await AuditResult.findByPk(req.params.id, {
      include: [{
        model: Video,
        as: 'video',
      }],
    });

    if (!auditResult) {
      return res.status(404).json({ error: 'Audit result not found' });
    }

    res.json({ auditResult });
  } catch (error) {
    logger.error('Get audit result error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get audit results by video ID
router.get('/video/:videoId', async (req, res) => {
  try {
    const auditResult = await AuditResult.findOne({
      where: { videoId: req.params.videoId },
      include: [{
        model: Video,
        as: 'video',
      }],
    });

    if (!auditResult) {
      return res.status(404).json({ error: 'Audit result not found' });
    }

    res.json({ auditResult });
  } catch (error) {
    logger.error('Get audit result by video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update audit result
router.put('/:id', async (req, res) => {
  try {
    const auditResult = await AuditResult.findByPk(req.params.id);

    if (!auditResult) {
      return res.status(404).json({ error: 'Audit result not found' });
    }

    await auditResult.update(req.body);

    res.json({ auditResult });
  } catch (error) {
    logger.error('Update audit result error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

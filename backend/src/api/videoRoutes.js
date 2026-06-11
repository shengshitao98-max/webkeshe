import express from 'express';
import { videoController } from '../controllers/videoController.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Upload video (authenticated users)
router.post('/upload', authMiddleware, videoController.uploadVideo);

// Get all videos with audit results (authenticated)
router.get('/all', authMiddleware, videoController.getAllVideos);

// List videos by status (authenticated)
router.get('/', authMiddleware, videoController.listVideos);

// Stream video (authenticated)
router.get('/stream/:videoId', authMiddleware, videoController.streamVideo);

// Get video thumbnail (authenticated)
router.get('/thumbnail/:videoId', authMiddleware, videoController.getThumbnail);

// Get analysis result (authenticated)
router.get('/:videoId/analysis', authMiddleware, videoController.getAnalysisResult);

// Delete video (uploader or admin)
router.delete('/:videoId', authMiddleware, videoController.deleteVideo);

// Get video details (anyone)
router.get('/:videoId', videoController.getVideo);

export default router;

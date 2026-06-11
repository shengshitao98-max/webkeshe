import { videoService } from '../services/videoService.js';
import { logger } from '../utils/helpers.js';
import { User, AuditResult } from '../models/index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const videoController = {
  async uploadVideo(req, res) {
    try {
      logger.info('Received upload request');
      logger.info('Request files:', req.files ? Object.keys(req.files) : 'none');
      logger.info('Request body:', req.body);
      logger.info('Request user:', req.user);

      if (!req.files || !req.files.video) {
        logger.error('No video file provided in request');
        return res.status(400).json({ error: 'No video file provided' });
      }

      // Ensure user exists in database
      let user = await User.findByPk(req.user.id);
      if (!user) {
        logger.info(`User ${req.user.id} not found by ID, checking by username...`);
        user = await User.findOne({ where: { username: req.user.username } });
        
        if (!user) {
          logger.info(`Creating user ${req.user.username} with ID ${req.user.id}`);
          user = await User.create({
            id: req.user.id,
            username: req.user.username,
            email: `${req.user.username}@demo.com`,
            password: 'demo-password',
            role: req.user.role || 'reviewer',
            status: 'active',
          });
        } else {
          logger.info(`Found existing user by username, updating ID to match token`);
          await User.update(
            { id: req.user.id },
            { where: { username: req.user.username } }
          );
        }
      }

      const videoFile = req.files.video;
      const { title, description, category } = req.body;

      logger.info(`Uploading file: ${videoFile.name}, size: ${videoFile.size}, type: ${videoFile.mimetype}`);

      // Validate file size (200MB max)
      if (videoFile.size > 209715200) {
        logger.error(`File size ${videoFile.size} exceeds 200MB limit`);
        return res.status(400).json({ error: 'File size exceeds 200MB limit' });
      }

      // Validate file type
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
      if (!allowedTypes.includes(videoFile.mimetype)) {
        logger.warn(`Non-standard video format: ${videoFile.mimetype}, proceeding anyway`);
      }

      const filename = `${Date.now()}_${videoFile.name}`;
      const filePath = path.join(uploadDir, filename);

      logger.info(`Saving file to: ${filePath}`);

      // Handle file based on whether it's in memory or temp file
      if (videoFile.data) {
        await fs.promises.writeFile(filePath, videoFile.data);
      } else if (videoFile.tempFilePath) {
        await fs.promises.copyFile(videoFile.tempFilePath, filePath);
      } else {
        await videoFile.mv(filePath);
      }

      logger.info('File saved successfully, creating database record');

      const video = await videoService.createVideo({
        filename,
        originalName: videoFile.name,
        fileSize: videoFile.size,
        filePath,
        title,
        description,
        category: category || 'other',
      }, req.user.id);

      logger.info(`Video created with ID: ${video.id}`);

      videoService.analyzeVideo(video.id, filePath).catch(err => {
        logger.error('Background analysis failed', err);
      });

      res.status(201).json({
        message: 'Video uploaded successfully',
        video,
      });
    } catch (error) {
      logger.error('Upload error', error);
      res.status(500).json({ error: 'Upload failed: ' + error.message });
    }
  },

  async getVideo(req, res) {
    try {
      const { videoId } = req.params;
      const video = await videoService.getVideoById(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json(video);
    } catch (error) {
      logger.error('Get video error', error);
      res.status(500).json({ error: 'Failed to fetch video' });
    }
  },

  async listVideos(req, res) {
    try {
      const { status, limit = 20, offset = 0 } = req.query;

      if (!status) {
        return res.status(400).json({ error: 'Status parameter is required' });
      }

      const result = await videoService.getVideosByStatus(status, parseInt(limit), parseInt(offset));
      res.json(result);
    } catch (error) {
      logger.error('List videos error', error);
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  },

  async getAllVideos(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const result = await videoService.getAllVideosWithAudit(parseInt(limit), parseInt(offset));
      res.json(result);
    } catch (error) {
      logger.error('Get all videos error', error);
      res.status(500).json({ error: 'Failed to fetch all videos' });
    }
  },

  async getAnalysisResult(req, res) {
    try {
      const { videoId } = req.params;
      const result = await videoService.getAnalysisResults(videoId);

      if (!result) {
        return res.status(404).json({ error: 'Analysis result not found' });
      }

      res.json(result);
    } catch (error) {
      logger.error('Get analysis error', error);
      res.status(500).json({ error: 'Failed to fetch analysis' });
    }
  },

  async deleteVideo(req, res) {
    try {
      const { videoId } = req.params;
      const video = await videoService.getVideoById(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (video.uploaderId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await videoService.deleteVideo(videoId);
      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      logger.error('Delete video error', error);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  },

  async streamVideo(req, res) {
    try {
      const { videoId } = req.params;
      const video = await videoService.getVideoById(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const filePath = video.filePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      logger.error('Stream video error', error);
      res.status(500).json({ error: 'Failed to stream video' });
    }
  },

  async getThumbnail(req, res) {
    try {
      const { videoId } = req.params;
      const video = await videoService.getVideoById(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      const filePath = video.filePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }

      const thumbnailPath = path.join(uploadDir, `thumbnail_${videoId}.jpg`);
      
      // If thumbnail already exists, use it
      if (fs.existsSync(thumbnailPath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        fs.createReadStream(thumbnailPath).pipe(res);
        return;
      }

      // Try to use first keyframe from audit result
      const auditResult = await AuditResult.findOne({ where: { videoId } });
      if (auditResult && auditResult.keyframes && auditResult.keyframes.length > 0) {
        // Keyframe paths from AI service are absolute paths
        let firstKeyframe = auditResult.keyframes[0];
        if (fs.existsSync(firstKeyframe)) {
          res.setHeader('Content-Type', 'image/jpeg');
          fs.createReadStream(firstKeyframe).pipe(res);
          return;
        }
      }

      // Fall back to returning 204 No Content
      res.status(204).send();
    } catch (error) {
      logger.error('Get thumbnail error', error);
      res.status(204).send();
    }
  },
};

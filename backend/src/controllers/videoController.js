import { videoService } from '../services/videoService.js';
import { logger } from '../utils/helpers.js';
import { aiServiceClient } from '../utils/aiClient.js';
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
      logger.info(`Video file info - tempFilePath: ${videoFile.tempFilePath}, has mv: ${typeof videoFile.mv === 'function'}, size: ${videoFile.size}`);

      let fileSaved = false;
      
      if (videoFile.tempFilePath) {
        const tempPath = videoFile.tempFilePath;
        const tempExists = fs.existsSync(tempPath);
        logger.info(`Temp file exists at ${tempPath}: ${tempExists}`);
        
        if (tempExists) {
          try {
            const tempSize = fs.statSync(tempPath).size;
            logger.info(`Temp file size: ${tempSize}`);
            await fs.promises.copyFile(tempPath, filePath);
            fileSaved = true;
            logger.info('Successfully copied from temp file');
          } catch (copyError) {
            logger.error(`Failed to copy from temp file: ${copyError.message}`);
          }
        }
      }

      if (!fileSaved && typeof videoFile.mv === 'function') {
        try {
          logger.info('Using mv method to move file');
          await new Promise((resolve, reject) => {
            videoFile.mv(filePath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          fileSaved = true;
          logger.info('Successfully moved file using mv method');
        } catch (mvError) {
          logger.error(`Failed to move file: ${mvError.message}`);
        }
      }

      if (!fileSaved && videoFile.data && videoFile.data.length > 0) {
        try {
          logger.info(`Writing from buffer, size: ${videoFile.data.length}`);
          await fs.promises.writeFile(filePath, videoFile.data);
          fileSaved = true;
          logger.info('Successfully wrote from buffer');
        } catch (writeError) {
          logger.error(`Failed to write from buffer: ${writeError.message}`);
        }
      }

      if (!fileSaved) {
        logger.error('No valid file data found to save - checking for alternative temp paths');
        
        const altTempDirs = ['./tmp', '../tmp', path.join(__dirname, '..', 'tmp')];
        for (const altDir of altTempDirs) {
          const possibleTempFiles = fs.readdirSync(altDir, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.includes('tmp-'))
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
          
          if (possibleTempFiles.length > 0) {
            const latestTemp = path.join(altDir, possibleTempFiles[0].name);
            const tempSize = fs.statSync(latestTemp).size;
            logger.info(`Found temp file: ${latestTemp}, size: ${tempSize}`);
            
            if (tempSize > 0 && tempSize === videoFile.size) {
              try {
                await fs.promises.copyFile(latestTemp, filePath);
                fileSaved = true;
                logger.info(`Successfully copied from alternative temp file: ${latestTemp}`);
                break;
              } catch (copyError) {
                logger.error(`Failed to copy from alt temp: ${copyError.message}`);
              }
            }
          }
        }
      }

      if (!fileSaved) {
        logger.error('Failed to save video file using all available methods');
        return res.status(500).json({ error: 'Failed to save video file' });
      }

      const savedSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      logger.info(`File saved, size: ${savedSize}, original size: ${videoFile.size}`);
      
      if (savedSize === 0) {
        logger.error(`File save resulted in empty file`);
        return res.status(500).json({ error: 'File save resulted in empty file' });
      }
      
      if (savedSize !== videoFile.size) {
        logger.warn(`File size mismatch. Saved: ${savedSize}, Expected: ${videoFile.size}. Continuing anyway...`);
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

  async reanalyzeVideo(req, res) {
    try {
      const { videoId } = req.params;
      const video = await videoService.getVideoById(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check permission
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Delete existing audit result if any
      await videoService.deleteAnalysisResult(videoId);

      // Re-analyze the video
      const auditResult = await videoService.analyzeVideo(video.id, video.filePath);

      res.json({
        message: 'Video re-analyzed successfully',
        auditResult,
      });
    } catch (error) {
      logger.error('Re-analyze video error', error);
      res.status(500).json({ error: 'Failed to re-analyze video: ' + error.message });
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
        let start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start) || start < 0) {
          start = 0;
        }
        if (isNaN(end) || end < 0 || end >= fileSize) {
          end = fileSize - 1;
        }

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
        let firstKeyframe = auditResult.keyframes[0];
        if (fs.existsSync(firstKeyframe)) {
          res.setHeader('Content-Type', 'image/jpeg');
          fs.createReadStream(firstKeyframe).pipe(res);
          return;
        }
      }

      // Try to extract keyframe from AI service
      try {
        const keyframesResult = await aiServiceClient.extractKeyframes(filePath, 1);
        if (keyframesResult && keyframesResult.keyframes && keyframesResult.keyframes.length > 0) {
          const firstKeyframe = keyframesResult.keyframes[0];
          if (fs.existsSync(firstKeyframe)) {
            res.setHeader('Content-Type', 'image/jpeg');
            fs.createReadStream(firstKeyframe).pipe(res);
            return;
          }
        }
      } catch (aiError) {
        logger.warn('AI service keyframe extraction failed, falling back', aiError.message);
      }

      // Fall back to returning 204 No Content
      res.status(204).send();
    } catch (error) {
      logger.error('Get thumbnail error', error);
      res.status(204).send();
    }
  },
};

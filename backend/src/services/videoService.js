import { Video, AuditResult, User } from '../models/index.js';
import { logger, generateUniqueFilename, calculateRiskLevel, calculateOverallRiskScore } from '../utils/helpers.js';
import { aiServiceClient } from '../utils/aiClient.js';
import { SensitiveKeyword } from '../models/index.js';
import path from 'path';

export const videoService = {
  async createVideo(uploadData, userId) {
    try {
      const video = await Video.create({
        ...uploadData,
        uploaderId: userId,
        status: 'pending',
      });
      logger.info('Video created', { videoId: video.id });
      return video;
    } catch (error) {
      logger.error('Error creating video', error);
      throw error;
    }
  },

  async getVideoById(videoId) {
    try {
      const video = await Video.findByPk(videoId, {
        include: [
          { association: 'uploader', attributes: ['id', 'username'] },
          { association: 'auditResult' },
          { association: 'reviews' },
        ],
      });
      return video;
    } catch (error) {
      logger.error('Error fetching video', error);
      throw error;
    }
  },

  async getVideosByStatus(status, limit = 20, offset = 0) {
    try {
      const { count, rows } = await Video.findAndCountAll({
        where: { status },
        include: [
          { association: 'uploader', attributes: ['id', 'username'] },
          { association: 'auditResult' },
        ],
        limit,
        offset,
        order: [['uploadedAt', 'DESC']],
      });
      return { total: count, videos: rows };
    } catch (error) {
      logger.error('Error fetching videos by status', error);
      throw error;
    }
  },

  async getAllVideosWithAudit(limit = 20, offset = 0) {
    try {
      const { count, rows } = await Video.findAndCountAll({
        include: [
          { association: 'uploader', attributes: ['id', 'username'] },
          { association: 'auditResult' },
          { association: 'reviews', limit: 1, order: [['reviewedAt', 'DESC']] },
        ],
        limit,
        offset,
        order: [['uploadedAt', 'DESC']],
      });
      return { total: count, videos: rows };
    } catch (error) {
      logger.error('Error fetching all videos', error);
      throw error;
    }
  },

  async analyzeVideo(videoId, filePath, audioPath = null) {
    try {
      logger.info('Starting video analysis', { videoId, filePath });

      // Update status
      await Video.update(
        { status: 'processing' },
        { where: { id: videoId } }
      );

      // Extract metadata
      const metadata = await aiServiceClient.getMetadata(filePath);
      if (metadata) {
        await Video.update(
          {
            duration: metadata.metadata?.duration || null,
            resolution: metadata.metadata?.resolution || null,
            width: metadata.metadata?.width || null,
            height: metadata.metadata?.height || null,
            fps: metadata.metadata?.fps || null,
          },
          { where: { id: videoId } }
        );
      }

      // Use Kimi direct video analysis
      const kimiResult = await aiServiceClient.analyzeVideoWithKimi(filePath);

      // Extract keyframes for thumbnail and fallback
      const keyframesData = await aiServiceClient.extractKeyframes(filePath, 5);
      const audioExtracted = await aiServiceClient.extractAudio(filePath);
      const transcription = await aiServiceClient.transcribeAudio(audioExtracted.audioPath);

      // Detect sensitive keywords from transcription
      const video = await this.getVideoById(videoId);
      const textToAnalyze = `${video.title || ''} ${video.description || ''} ${transcription.text || ''}`;
      const sensitiveDetection = await aiServiceClient.detectSensitiveContent(textToAnalyze);

      // Classify video content
      const categoryResult = await aiServiceClient.classifyVideo(
        video.title || '',
        video.description || '',
        transcription.text || ''
      );

      // Update video category
      await Video.update(
        { category: categoryResult.category },
        { where: { id: videoId } }
      );

      // Calculate scores
      const kimiRiskScore = kimiResult.kimiVideoAnalysis?.riskScore || 0;
      const textRiskScore = sensitiveDetection.riskScore || 0;
      const overallRiskScore = calculateOverallRiskScore(kimiRiskScore, textRiskScore);

      // Create audit result
      const auditResult = await AuditResult.create({
        videoId,
        textRiskScore,
        imageRiskScore: kimiRiskScore,
        overallRiskScore,
        riskLevel: calculateRiskLevel(overallRiskScore),
        sensitiveKeywords: sensitiveDetection.keywords || [],
        keyframes: keyframesData.keyframes || [],
        transcription: transcription.text,
        imageClassifications: kimiResult.kimiVideoAnalysis?.reasoning ? [{
          class: kimiResult.kimiVideoAnalysis.class || 'normal',
          riskScore: kimiResult.kimiVideoAnalysis.riskScore || 0,
          confidence: kimiResult.kimiVideoAnalysis.confidence || 0.9,
          reasoning: kimiResult.kimiVideoAnalysis.reasoning || [],
          metrics: {},
        }] : [],
        summary: kimiResult.kimiVideoAnalysis?.summary || '',
      });

      // Update video status
      await Video.update(
        { status: 'completed' },
        { where: { id: videoId } }
      );

      logger.info('Video analysis completed', { videoId, riskLevel: auditResult.riskLevel });
      return auditResult;
    } catch (error) {
      logger.error('Error analyzing video', error);
      await Video.update(
        { status: 'failed' },
        { where: { id: videoId } }
      );
      throw error;
    }
  },

  async getAnalysisResults(videoId) {
    try {
      const auditResult = await AuditResult.findOne({
        where: { videoId },
      });
      return auditResult;
    } catch (error) {
      logger.error('Error fetching analysis results', error);
      throw error;
    }
  },

  async deleteVideo(videoId) {
    try {
      await Video.destroy({ where: { id: videoId } });
      await AuditResult.destroy({ where: { videoId } });
      logger.info('Video deleted', { videoId });
    } catch (error) {
      logger.error('Error deleting video', error);
      throw error;
    }
  },
};

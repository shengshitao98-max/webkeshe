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

      // Get video record
      const video = await Video.findByPk(videoId);
      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }

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

      let kimiResult = null;
      let analysisMethod = 'kimi';
      let localThreshold = 30;
      
      // Step 1: Perform local image analysis
      let localAnalysisResult = null;
      try {
        localAnalysisResult = await aiServiceClient.performLocalAnalysis(filePath);
      } catch (localError) {
        logger.warn('Local analysis failed', { error: localError.message });
        localAnalysisResult = { riskScore: 0, class: 'normal' };
      }

      // Step 2: Extract audio and transcribe BEFORE deciding whether to call Kimi API
      // This allows us to consider both visual and audio risks
      let audioExtracted = { audioPath: null };
      try {
        audioExtracted = await aiServiceClient.extractAudio(filePath);
      } catch (error) {
        logger.warn('Audio extraction failed', { error: error.message });
      }

      // Transcribe audio
      let transcription = { text: '' };
      try {
        if (audioExtracted.audioPath) {
          transcription = await aiServiceClient.transcribeAudio(audioExtracted.audioPath);
        }
      } catch (error) {
        logger.warn('Audio transcription failed', { error: error.message });
      }

      // Step 3: Detect sensitive keywords from audio transcription only
      const textToAnalyze = transcription.text || '';
      let sensitiveDetection = { keywords: [], riskScore: 0 };
      try {
        sensitiveDetection = await aiServiceClient.detectSensitiveContent(textToAnalyze);
      } catch (error) {
        logger.warn('Sensitive content detection failed', { error: error.message });
      }

      // Step 4: Extract keyframes
      let keyframesData = { keyframes: [] };
      try {
        keyframesData = await aiServiceClient.extractKeyframes(filePath, 5);
      } catch (error) {
        logger.warn('Keyframe extraction failed', { error: error.message });
      }

      // Step 5: Decide whether to call Kimi API based on BOTH visual and audio risk
      const imageRisk = localAnalysisResult.riskScore || 0;
      const textRisk = sensitiveDetection.riskScore || 0;
      
      // Combined risk: image risk is primary, text risk is secondary
      const combinedRisk = imageRisk * 0.7 + textRisk * 0.3;
      
      logger.info(`Analysis risks - Image: ${imageRisk}, Text: ${textRisk}, Combined: ${combinedRisk.toFixed(1)}`);
      
      if (combinedRisk >= localThreshold) {
        logger.info(`Combined risk detected (${combinedRisk.toFixed(1)} >= ${localThreshold}), calling Kimi API`);
        try {
          kimiResult = await aiServiceClient.analyzeVideoWithKimi(filePath, localThreshold);
        } catch (kimiError) {
          logger.warn('Kimi API failed, using local analysis result', { error: kimiError.message });
          kimiResult = {
            kimiVideoAnalysis: {
              class: localAnalysisResult.class || 'normal',
              riskScore: imageRisk,
              confidence: 0.9,
              reasoning: localAnalysisResult.reasoning || ['本地分析完成'],
              metrics: {},
            },
            summary: localAnalysisResult.summary || '本地分析完成',
            analysisMethod: 'local_fallback',
            localThreshold: localThreshold,
          };
          analysisMethod = 'local_fallback';
        }
      } else {
        logger.info(`Combined risk passed (${combinedRisk.toFixed(1)} < ${localThreshold}), skipping Kimi API`);
        kimiResult = {
          kimiVideoAnalysis: {
            class: localAnalysisResult.class || 'normal',
            riskScore: imageRisk,
            confidence: 0.9,
            reasoning: localAnalysisResult.reasoning || ['本地分析完成'],
            metrics: {},
          },
          summary: localAnalysisResult.summary || '本地分析通过',
          analysisMethod: 'local_only',
          localThreshold: localThreshold,
        };
        analysisMethod = 'local_only';
      }

      // Classify video content
      let categoryResult = { category: video.category || 'other' };
      try {
        categoryResult = await aiServiceClient.classifyVideo(
          video.title || '',
          video.description || '',
          transcription.text || ''
        );
      } catch (error) {
        logger.warn('Video classification failed', { error: error.message });
      }

      // Update video category
      await Video.update(
        { category: categoryResult.category },
        { where: { id: videoId } }
      );

      // Get local risk score from local analysis result
      const localRiskScore = localAnalysisResult?.riskScore || 0;

      // Calculate scores
      const kimiRiskScore = kimiResult.kimiVideoAnalysis?.riskScore || 0;
      const textRiskScore = sensitiveDetection.riskScore || 0;
      
      // Local risk score is the basis for whether to call API
      // Final score should be based on local analysis, not overridden by Kimi
      const imageRiskScore = localRiskScore;
      const overallRiskScore = calculateOverallRiskScore(textRiskScore, imageRiskScore);

      // Create audit result
      const auditResult = await AuditResult.create({
        videoId,
        textRiskScore,
        imageRiskScore: imageRiskScore,
        localRiskScore,
        overallRiskScore,
        riskLevel: calculateRiskLevel(overallRiskScore),
        sensitiveKeywords: sensitiveDetection.keywords || [],
        keyframes: keyframesData.keyframes || [],
        transcription: transcription.text,
        imageClassifications: kimiResult.kimiVideoAnalysis?.reasoning ? [{
          class: kimiResult.kimiVideoAnalysis.class || 'normal',
          riskScore: imageRiskScore,
          confidence: kimiResult.kimiVideoAnalysis.confidence || 0.9,
          reasoning: kimiResult.kimiVideoAnalysis.reasoning || [],
          metrics: {},
        }] : [],
        summary: kimiResult.summary || '',
        analysisMethod: kimiResult.analysisMethod || analysisMethod,
        localThreshold: kimiResult.localThreshold || localThreshold,
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

  async deleteAnalysisResult(videoId) {
    try {
      await AuditResult.destroy({ where: { videoId } });
      logger.info('Analysis result deleted', { videoId });
    } catch (error) {
      logger.error('Error deleting analysis result', error);
      throw error;
    }
  },
};

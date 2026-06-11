import axios from 'axios';
import { logger } from './helpers.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5000';

export const aiServiceClient = {
  async getMetadata(videoPath) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/get-metadata`, {
        videoPath,
      }, { timeout: 30000 });
      return response.data;
    } catch (error) {
      logger.error('Metadata extraction error:', error.message);
      return null;
    }
  },

  async analyzeVideoWithKimi(videoPath) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/analyze-video`, {
        videoPath,
      }, { timeout: 300000 }); // 5 minutes for video upload + analysis
      return response.data;
    } catch (error) {
      logger.error('Kimi video analysis error:', error.message);
      throw new Error('Kimi video analysis failed');
    }
  },

  async analyzeVideo(videoPath, audioPath) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/analyze`, {
        videoPath,
        audioPath,
      }, { timeout: 300000 }); // 5 minutes timeout
      return response.data;
    } catch (error) {
      logger.error('AI Service error:', error.message);
      throw new Error('Video analysis failed');
    }
  },

  async extractKeyframes(videoPath, interval = 5) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/extract-keyframes`, {
        videoPath,
        interval,
      }, { timeout: 60000 });
      return response.data;
    } catch (error) {
      logger.error('Keyframe extraction error:', error.message);
      throw new Error('Keyframe extraction failed');
    }
  },

  async extractAudio(videoPath) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/extract-audio`, {
        videoPath,
      }, { timeout: 120000 });
      return response.data;
    } catch (error) {
      logger.error('Audio extraction error:', error.message);
      throw new Error('Audio extraction failed');
    }
  },

  async transcribeAudio(audioPath) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/transcribe`, {
        audioPath,
      }, { timeout: 120000 });
      return response.data;
    } catch (error) {
      logger.error('Transcription error:', error.message);
      throw new Error('Audio transcription failed');
    }
  },

  async classifyImages(imagePaths) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/classify-images`, {
        imagePaths,
      }, { timeout: 600000 }); // 10 minutes for multiple Kimi API calls
      return response.data;
    } catch (error) {
      logger.error('Image classification error:', error.message);
      throw new Error('Image classification failed');
    }
  },

  async detectSensitiveContent(text) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/detect-keywords`, {
        text,
      }, { timeout: 30000 });
      return response.data;
    } catch (error) {
      logger.error('Sensitive content detection error:', error.message);
      throw new Error('Sensitive content detection failed');
    }
  },

  async classifyVideo(title, description, transcription) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/classify-video`, {
        title,
        description,
        transcription,
      }, { timeout: 30000 });
      return response.data;
    } catch (error) {
      logger.error('Video classification error:', error.message);
      throw new Error('Video classification failed');
    }
  },

  async summarizeVideo(title, description, transcription, category, keyframes = []) {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/summarize-video`, {
        title,
        description,
        transcription,
        category,
        keyframes,
      }, { timeout: 60000 });
      return response.data;
    } catch (error) {
      logger.error('Video summarization error:', error.message);
      throw new Error('Video summarization failed');
    }
  },
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const getTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

export const logger = {
  info: (message, data = {}) => {
    console.log(`[${getTimestamp()}] INFO: ${message}`, data);
  },
  error: (message, error = {}) => {
    console.error(`[${getTimestamp()}] ERROR: ${message}`, error);
  },
  warn: (message, data = {}) => {
    console.warn(`[${getTimestamp()}] WARN: ${message}`, data);
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${getTimestamp()}] DEBUG: ${message}`, data);
    }
  },
};

export const calculateRiskLevel = (score) => {
  if (score < 30) return 'pass';
  if (score < 70) return 'suspicious';
  return 'violation';
};

export const calculateOverallRiskScore = (textScore, imageScore, weights = { text: 0.3, image: 0.7 }) => {
  const cappedTextScore = Math.min(textScore, 50);
  return Math.round(cappedTextScore * weights.text + imageScore * weights.image);
};

export const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
};

export const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  return `${sanitizeFilename(name)}_${timestamp}_${random}${ext}`;
};

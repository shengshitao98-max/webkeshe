import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditResult = sequelize.define('AuditResult', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  videoId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  textRiskScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Risk score from text analysis (0-100)',
  },
  imageRiskScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Risk score from image analysis (0-100)',
  },
  localRiskScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Risk score from local analysis (0-100)',
  },
  overallRiskScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Weighted overall risk score (0-100)',
  },
  riskLevel: {
    type: DataTypes.ENUM('pass', 'suspicious', 'violation'),
    comment: 'Pass: <30, Suspicious: 30-70, Violation: >=70',
  },
  sensitiveKeywords: {
    type: DataTypes.JSON,
    comment: 'Array of detected sensitive keywords',
  },
  keyframes: {
    type: DataTypes.JSON,
    comment: 'Array of keyframe paths',
  },
  transcription: {
    type: DataTypes.TEXT,
    comment: 'Audio transcription',
  },
  imageClassifications: {
    type: DataTypes.JSON,
    comment: 'Array of image classification results',
  },
  summary: {
    type: DataTypes.TEXT,
    comment: 'Video content summary/description',
  },
  analysisMethod: {
    type: DataTypes.ENUM('local_only', 'kimi', 'local_fallback'),
    defaultValue: 'local_only',
    comment: 'Method used for analysis: local_only, kimi, or local_fallback',
  },
  localThreshold: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    comment: 'Local analysis threshold used for this video',
  },
  processedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'audit_results',
  timestamps: false,
});

export default AuditResult;

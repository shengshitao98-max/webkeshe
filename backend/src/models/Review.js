import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  videoId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  auditResultId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  reviewerId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  originalRiskLevel: {
    type: DataTypes.ENUM('pass', 'suspicious', 'violation'),
  },
  finalDecision: {
    type: DataTypes.ENUM('pass', 'violation', 'appeal_pending'),
    allowNull: false,
  },
  reviewComment: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Mandatory review comment',
  },
  reviewedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'reviews',
  timestamps: false,
});

export default Review;

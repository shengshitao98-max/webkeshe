import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Video = sequelize.define('Video', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  duration: {
    type: DataTypes.FLOAT,
    comment: 'Video duration in seconds',
  },
  resolution: {
    type: DataTypes.STRING,
    comment: 'Video resolution (e.g., 1920x1080)',
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  uploaderId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
  },
  description: {
    type: DataTypes.TEXT,
  },
  category: {
    type: DataTypes.ENUM('news', 'entertainment', 'education', 'lifestyle', 'other'),
    defaultValue: 'other',
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
  },
  uploadedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'videos',
  timestamps: false,
});

export default Video;

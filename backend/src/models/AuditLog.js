import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  videoId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  reviewId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  operatorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  operationType: {
    type: DataTypes.ENUM('created', 'updated', 'deleted'),
    allowNull: false,
  },
  statusBefore: {
    type: DataTypes.STRING,
  },
  statusAfter: {
    type: DataTypes.STRING,
  },
  changeSummary: {
    type: DataTypes.TEXT,
  },
  operatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'audit_logs',
  timestamps: false,
});

export default AuditLog;

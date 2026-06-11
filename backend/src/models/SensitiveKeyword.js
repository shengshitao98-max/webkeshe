import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const SensitiveKeyword = sequelize.define('SensitiveKeyword', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  keyword: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  category: {
    type: DataTypes.ENUM('political', 'porn', 'violence', 'illegal'),
    allowNull: false,
  },
  severity: {
    type: DataTypes.INTEGER,
    comment: 'Severity level (1-10)',
    defaultValue: 5,
  },
  riskScore: {
    type: DataTypes.FLOAT,
    defaultValue: 10,
    comment: 'Risk score when matched (0-100)',
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'sensitive_keywords',
  timestamps: false,
});

export default SensitiveKeyword;

import User from './User.js';
import Video from './Video.js';
import AuditResult from './AuditResult.js';
import Review from './Review.js';
import AuditLog from './AuditLog.js';
import SensitiveKeyword from './SensitiveKeyword.js';

// 定义关系
Video.belongsTo(User, { foreignKey: 'uploaderId', as: 'uploader' });
User.hasMany(Video, { foreignKey: 'uploaderId', as: 'uploadedVideos' });

AuditResult.belongsTo(Video, { foreignKey: 'videoId', as: 'video' });
Video.hasOne(AuditResult, { foreignKey: 'videoId', as: 'auditResult' });

Review.belongsTo(Video, { foreignKey: 'videoId', as: 'video' });
Review.belongsTo(AuditResult, { foreignKey: 'auditResultId', as: 'auditResult' });
Review.belongsTo(User, { foreignKey: 'reviewerId', as: 'reviewer' });
Video.hasMany(Review, { foreignKey: 'videoId', as: 'reviews' });

AuditLog.belongsTo(Video, { foreignKey: 'videoId', as: 'video' });
AuditLog.belongsTo(Review, { foreignKey: 'reviewId', as: 'review' });
AuditLog.belongsTo(User, { foreignKey: 'operatorId', as: 'operator' });

export {
  User,
  Video,
  AuditResult,
  Review,
  AuditLog,
  SensitiveKeyword,
};

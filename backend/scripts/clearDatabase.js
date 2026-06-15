import sequelize from '../src/config/database.js';
import { User, Video, AuditResult, Review, AuditLog, SensitiveKeyword } from '../src/models/index.js';

async function clearDatabase() {
  try {
    console.log('正在连接数据库...');
    await sequelize.authenticate();
    console.log('数据库连接成功');

    console.log('\n正在清空数据...');

    // 按照外键依赖顺序删除数据
    await AuditLog.destroy({ where: {}, truncate: true });
    console.log('已清空: AuditLog');

    await Review.destroy({ where: {}, truncate: true });
    console.log('已清空: Review');

    await AuditResult.destroy({ where: {}, truncate: true });
    console.log('已清空: AuditResult');

    await Video.destroy({ where: {}, truncate: true });
    console.log('已清空: Video');

    await SensitiveKeyword.destroy({ where: {}, truncate: true });
    console.log('已清空: SensitiveKeyword');

    await User.destroy({ where: {}, truncate: true });
    console.log('已清空: User');

    console.log('\n所有数据已清空完成!');
    
    // 重新创建默认用户
    console.log('\n正在创建默认用户...');
    const bcrypt = await import('bcrypt');
    
    const adminHashedPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: adminHashedPassword,
      role: 'admin',
      status: 'active',
    });
    console.log('创建管理员用户: admin / admin123');

    const reviewerHashedPassword = await bcrypt.hash('reviewer123', 10);
    await User.create({
      username: 'reviewer1',
      email: 'reviewer1@example.com',
      password: reviewerHashedPassword,
      role: 'reviewer',
      status: 'active',
    });
    console.log('创建审核员用户: reviewer1 / reviewer123');

    console.log('\n默认用户创建完成!');

    process.exit(0);
  } catch (error) {
    console.error('清空数据库失败:', error);
    process.exit(1);
  }
}

clearDatabase();
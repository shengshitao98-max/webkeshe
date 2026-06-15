import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import sequelize from './config/database.js';
import { User } from './models/index.js';
import authRoutes from './api/authRoutes.js';
import videoRoutes from './api/videoRoutes.js';
import reviewRoutes from './api/reviewRoutes.js';
import statisticsRoutes from './api/statisticsRoutes.js';
import auditRoutes from './api/auditRoutes.js';
import logger from './utils/logger.js';
import fs from 'fs';
import path from 'path';
import fileUpload from 'express-fileupload';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With'],
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(fileUpload({
  limits: { fileSize: 209715200 },
  useTempFiles: true,
  tempFileDir: './tmp/',
}));

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Created uploads directory');
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Database sync and server start
const initDatabase = async () => {
  try {
    // Sync database (don't alter existing tables)
    await sequelize.sync({ alter: false });
    logger.info('Database synced successfully');

    // Initialize admin user
    const bcrypt = await import('bcrypt');
    const User = (await import('./models/User.js')).default;

    const adminExists = await User.findOne({ where: { username: 'admin' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        status: 'active',
      });
      logger.info('Admin user created: admin / admin123');
    }

    // Initialize default reviewer if not exists
    const reviewerExists = await User.findOne({ where: { username: 'reviewer1' } });
    if (!reviewerExists) {
      const hashedPassword = await bcrypt.hash('reviewer123', 10);
      await User.create({
        username: 'reviewer1',
        email: 'reviewer1@example.com',
        password: hashedPassword,
        role: 'reviewer',
        status: 'active',
      });
      logger.info('Reviewer user created: reviewer1 / reviewer123');
    }

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

initDatabase();

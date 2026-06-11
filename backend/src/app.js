import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from './config/database.js';
import { errorHandler, authMiddleware } from './middleware/auth.js';
import { logger } from './utils/helpers.js';
import { User } from './models/index.js';

import videoRoutes from './api/videoRoutes.js';
import reviewRoutes from './api/reviewRoutes.js';
import statisticsRoutes from './api/statisticsRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure required directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(fileUpload({
  limits: { fileSize: 209715200 }, // 200MB
  useTempFiles: false,
  tempFileDir: path.join(__dirname, 'tmp'),
  createParentPath: true,
  debug: false,
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoint
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const usernameToUse = username || 'reviewer1';

  try {
    let user = await User.findOne({ where: { username: usernameToUse } });
    
    if (!user) {
      user = await User.create({
        username: usernameToUse,
        email: `${usernameToUse}@demo.com`,
        password: 'demo-password',
        role: 'admin',
        status: 'active',
      });
      logger.info(`Created demo user: ${usernameToUse}`);
    }

    const userPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: userPayload });
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// API Routes
app.use('/api/videos', videoRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/statistics', statisticsRoutes);

// Error handler
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Sync database schema (only verify structure, don't modify)
    await sequelize.sync();
    logger.info('Database synced successfully');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();

export default app;

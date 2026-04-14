import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from './database/connection.js';
import { initializeSchema } from './database/init.js';
import { createWebSocketManager } from './websocket/manager.js';
import {
  authMiddleware,
  handleChangePassword,
  handleLogin,
  handleLogout,
  handleRegister,
  handleRegisterPreview,
  handleRefreshToken,
  handleVerifyToken,
} from './auth/routes.js';
import gameRoutes from './games/routes.js';
import userRoutes from './routes/users.js';
import type { AuthRequest } from './auth/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const app = express();
const httpServer = createServer(app);

// Initialize database
initializeDatabase();
initializeSchema().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Initialize WebSocket
const wsManager = createWebSocketManager(httpServer);

// Routes
app.post('/api/auth/register', handleRegister);
app.get('/api/auth/register-preview', handleRegisterPreview);
app.post('/api/auth/login', handleLogin);
app.post('/api/auth/refresh', handleRefreshToken);
app.post('/api/auth/logout', handleLogout);
app.get('/api/auth/verify', authMiddleware, handleVerifyToken);
app.post('/api/auth/change-password', authMiddleware, handleChangePassword);

// Protected routes
app.use('/api/games', authMiddleware, gameRoutes);
app.use('/api/users', authMiddleware, userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 iChess backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

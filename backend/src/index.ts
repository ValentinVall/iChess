import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initializeDatabase } from './database/connection.js';
import { initializeSchema } from './database/init.js';
import { createWebSocketManager } from './websocket/manager.js';
import { authMiddleware, handleSignIn, handleVerifyToken } from './auth/routes.js';
import gameRoutes from './games/routes.js';
import userRoutes from './routes/users.js';
import type { AuthRequest } from './auth/routes.js';

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
app.use(cors());

// Initialize WebSocket
const wsManager = createWebSocketManager(httpServer);

// Routes
app.post('/api/auth/signin', handleSignIn);
app.get('/api/auth/verify', authMiddleware, handleVerifyToken);

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

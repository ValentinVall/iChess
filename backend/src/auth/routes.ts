import type { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../database/connection.js';
import { createAppleAuthService } from './apple.js';

const authService = createAppleAuthService();

export interface AuthRequest extends Request {
  userId?: string;
  appleId?: string;
}

/**
 * Middleware to verify JWT token
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.slice(7);
    const decoded = authService.verifyJWT(token);

    req.userId = decoded.userId;
    req.appleId = decoded.appleId;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Sign in route handler
 */
export async function handleSignIn(req: AuthRequest, res: Response) {
  try {
    const { identityToken, user } = req.body;

    if (!identityToken) {
      return res.status(400).json({ error: 'Missing identity token' });
    }

    // Verify Apple token
    const appleToken = await authService.verifyToken(identityToken);
    const db = getDatabase();

    // Save/update user in database
    const result = await db.query(
      `INSERT INTO users (apple_id, email, display_name, rating)
       VALUES ($1, $2, $3, 1600)
       ON CONFLICT (apple_id) DO UPDATE
       SET email = COALESCE($2, email), 
           display_name = COALESCE($3, display_name),
           updated_at = NOW()
       RETURNING id`,
      [appleToken.sub, appleToken.email || user?.email, user?.name?.firstName || 'Player']
    );

    const userId = result.rows[0].id;

    // Generate JWT - use numeric userId instead of appleId
    const jwtToken = authService.generateJWT(String(userId), appleToken.sub);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: userId,
        email: appleToken.email,
      },
    });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(400).json({ error: 'Sign in failed' });
  }
}

/**
 * Verify token route
 */
export function handleVerifyToken(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({
      valid: true,
      userId: req.userId,
      appleId: req.appleId,
    });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

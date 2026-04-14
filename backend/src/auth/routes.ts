import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database/connection.js';
import { createJWTService } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  deleteExpiredRefreshTokens,
  deleteRefreshTokenById,
  deleteRefreshTokenByValue,
  findRefreshToken,
  generateRefreshToken,
  getRefreshTokenTtlSeconds,
  persistRefreshToken,
} from './refreshTokens.js';

const authService = createJWTService();

interface LocalAuthBody {
  username?: string;
  password?: string;
}

interface RefreshRequestBody {
  refreshToken?: string;
}

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
}

async function getNextPlayerNumber() {
  const db = getDatabase();

  try {
    const sequenceResult = await db.query(
      `SELECT last_value, is_called
       FROM player_number_seq`
    );

    const sequenceRow = sequenceResult.rows[0] as { last_value?: number; is_called?: boolean } | undefined;
    if (sequenceRow && typeof sequenceRow.last_value === 'number') {
      return sequenceRow.is_called ? sequenceRow.last_value + 1 : sequenceRow.last_value;
    }
  } catch {
    // Fall back to deriving the next public number from existing users if the sequence is unavailable.
  }

  const fallbackResult = await db.query(
    `SELECT COALESCE(MAX(player_number), 0) + 1 AS next_player_number
     FROM users
     WHERE COALESCE(is_system, FALSE) = FALSE`
  );

  return Number(fallbackResult.rows[0]?.next_player_number || 1);
}

const REFRESH_TOKEN_COOKIE = 'ichess_refresh_token';

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function validateRegistrationCredentials(username?: string, password?: string) {
  const nextUsername = typeof username === 'string' ? normalizeUsername(username) : '';
  const nextPassword = typeof password === 'string' ? password : '';

  if (!/^[a-z]{3,20}$/.test(nextUsername)) {
    return { error: 'Username must be 3-20 characters and use only lowercase letters' };
  }

  if (nextPassword.length < 6 || nextPassword.length > 72) {
    return { error: 'Password must be between 6 and 72 characters' };
  }

  return {
    username: nextUsername,
    password: nextPassword,
  };
}

function validateLoginCredentials(username?: string, password?: string) {
  const nextUsername = typeof username === 'string' ? normalizeUsername(username) : '';
  const nextPassword = typeof password === 'string' ? password : '';

  if (!nextUsername || nextUsername.length > 50) {
    return { error: 'Invalid username or password' };
  }

  if (nextPassword.length < 6 || nextPassword.length > 72) {
    return { error: 'Password must be between 6 and 72 characters' };
  }

  return {
    username: nextUsername,
    password: nextPassword,
  };
}

function validatePasswordValue(password?: string) {
  const nextPassword = typeof password === 'string' ? password : '';

  if (nextPassword.length < 6 || nextPassword.length > 72) {
    return { error: 'Password must be between 6 and 72 characters' };
  }

  return { password: nextPassword };
}

export interface AuthRequest extends Request {
  userId?: string;
  authSubject?: string;
}

function getRefreshTokenFromRequest(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookiePairs = cookieHeader.split(';').map((part) => part.trim());
    const refreshCookie = cookiePairs.find((part) => part.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
    if (refreshCookie) {
      return decodeURIComponent(refreshCookie.slice(REFRESH_TOKEN_COOKIE.length + 1));
    }
  }

  const bodyToken = (req.body as RefreshRequestBody | undefined)?.refreshToken;
  return typeof bodyToken === 'string' && bodyToken.trim() ? bodyToken : null;
}

function getRefreshTokenExpiryDate() {
  return new Date(Date.now() + getRefreshTokenTtlSeconds() * 1000);
}

function setRefreshTokenCookie(res: Response, refreshToken: string, expiresAt: Date) {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    expires: expiresAt,
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

async function issueSessionTokens(res: Response, userId: string, authSubject: string) {
  const db = getDatabase();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await deleteExpiredRefreshTokens(client);

    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = getRefreshTokenExpiryDate();
    await persistRefreshToken(client, userId, refreshToken, refreshExpiresAt);

    await client.query('COMMIT');

    setRefreshTokenCookie(res, refreshToken, refreshExpiresAt);

    const accessToken = authService.generateJWT(userId, authSubject);

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function buildSessionResponse(
  accessToken: string,
  refreshToken: string,
  refreshTokenExpiresAt: string,
  includeRefreshToken: boolean
) {
  return includeRefreshToken
    ? {
        token: accessToken,
        accessToken,
        refreshToken,
        refreshTokenExpiresAt,
      }
    : {
        token: accessToken,
        accessToken,
        refreshTokenExpiresAt,
      };
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
    req.authSubject = decoded.authSubject;

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export async function handleRegister(req: AuthRequest, res: Response) {
  try {
    const { username, password } = req.body as LocalAuthBody;
    const validated = validateRegistrationCredentials(username, password);
    if ('error' in validated) {
      return res.status(400).json({ error: validated.error });
    }

    const db = getDatabase();
    const existingUser = await db.query(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [validated.username],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const authSubject = `local:${randomUUID()}`;
    const passwordHash = await hashPassword(validated.password);

    const result = await db.query(
      `INSERT INTO users (apple_id, apple_sub, provider, password_hash, email, display_name, username, bio, rating)
       VALUES ($1, $2, 'local', $3, NULL, $4, $5, $6, 800)
       RETURNING id, player_number, username, rating`,
      [
        authSubject,
        authSubject,
        passwordHash,
        validated.username,
        validated.username,
        'New iChess player.',
      ]
    );

    const savedUser = result.rows[0];

    await db.query(
      `INSERT INTO user_mode_stats (user_id, mode)
       VALUES
         ($1, 'bullet'),
         ($1, 'blitz'),
         ($1, 'rapid')
       ON CONFLICT (user_id, mode) DO NOTHING`,
      [savedUser.id],
    );

    const session = await issueSessionTokens(res, String(savedUser.id), authSubject);

    res.json({
      success: true,
      ...buildSessionResponse(session.accessToken, session.refreshToken, session.refreshTokenExpiresAt, false),
      user: {
        id: savedUser.id,
        playerNumber: savedUser.player_number ? `#${savedUser.player_number}` : null,
        username: savedUser.username,
        rating: savedUser.rating,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
}

export async function handleRegisterPreview(req: Request, res: Response) {
  try {
    const nextPlayerNumber = await getNextPlayerNumber();

    res.json({
      success: true,
      playerNumber: `#${nextPlayerNumber}`,
      numericPlayerNumber: nextPlayerNumber,
    });
  } catch (error) {
    console.error('Register preview error:', error);
    res.status(500).json({ error: 'Failed to load next player number' });
  }
}

export async function handleLogin(req: AuthRequest, res: Response) {
  try {
    const { username, password } = req.body as LocalAuthBody;
    const validated = validateLoginCredentials(username, password);
    if ('error' in validated) {
      return res.status(400).json({ error: validated.error });
    }

    const db = getDatabase();
    const result = await db.query(
      `SELECT id, player_number, apple_sub, username, rating, password_hash
       FROM users
       WHERE username = $1 AND provider = 'local'
       LIMIT 1`,
      [validated.username],
    );

    const user = result.rows[0];
    if (!user?.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatches = await verifyPassword(validated.password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const session = await issueSessionTokens(res, String(user.id), user.apple_sub);


    res.json({
      success: true,
      ...buildSessionResponse(session.accessToken, session.refreshToken, session.refreshTokenExpiresAt, false),
      user: {
        id: user.id,
        playerNumber: user.player_number ? `#${user.player_number}` : null,
        username: user.username,
        rating: user.rating,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
}

export async function handleChangePassword(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordBody;
    const currentPasswordValidation = validatePasswordValue(currentPassword);
    if ('error' in currentPasswordValidation) {
      return res.status(400).json({ error: 'Current password must be between 6 and 72 characters' });
    }

    const newPasswordValidation = validatePasswordValue(newPassword);
    if ('error' in newPasswordValidation) {
      return res.status(400).json({ error: newPasswordValidation.error });
    }

    if (currentPasswordValidation.password === newPasswordValidation.password) {
      return res.status(400).json({ error: 'New password must be different from the current password' });
    }

    const db = getDatabase();
    const result = await db.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = $1 AND provider = 'local'
       LIMIT 1`,
      [req.userId],
    );

    const user = result.rows[0] as { id: number; password_hash: string | null } | undefined;
    if (!user?.password_hash) {
      return res.status(400).json({ error: 'Password changes are only available for local accounts' });
    }

    const passwordMatches = await verifyPassword(currentPasswordValidation.password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const nextPasswordHash = await hashPassword(newPasswordValidation.password);
    await db.query(
      `UPDATE users
       SET password_hash = $2
       WHERE id = $1`,
      [req.userId, nextPasswordHash],
    );

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
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
      authSubject: req.authSubject,
    });
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export async function handleRefreshToken(req: Request, res: Response) {
  const providedRefreshToken = getRefreshTokenFromRequest(req);
  const refreshTokenCameFromBody = Boolean((req.body as RefreshRequestBody | undefined)?.refreshToken);

  if (!providedRefreshToken) {
    clearRefreshTokenCookie(res);
    return res.status(401).json({ error: 'Missing refresh token' });
  }

  const db = getDatabase();
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await deleteExpiredRefreshTokens(client);

    const existingToken = await findRefreshToken(client, providedRefreshToken);

    if (!existingToken || existingToken.expiresAt.getTime() <= Date.now()) {
      if (existingToken) {
        await deleteRefreshTokenById(client, existingToken.id);
      }

      await client.query('COMMIT');
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userResult = await client.query(
      `SELECT id, apple_sub
       FROM users
       WHERE id = $1 AND apple_sub IS NOT NULL
       LIMIT 1`,
      [existingToken.userId]
    );

    const user = userResult.rows[0];
    if (!user) {
      await deleteRefreshTokenById(client, existingToken.id);
      await client.query('COMMIT');
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'User not found for refresh token' });
    }

    await deleteRefreshTokenById(client, existingToken.id);

    const nextRefreshToken = generateRefreshToken();
    const refreshExpiresAt = getRefreshTokenExpiryDate();
    await persistRefreshToken(client, String(user.id), nextRefreshToken, refreshExpiresAt);

    await client.query('COMMIT');

    setRefreshTokenCookie(res, nextRefreshToken, refreshExpiresAt);

    const accessToken = authService.generateJWT(String(user.id), user.apple_sub);

    return res.json({
      success: true,
      ...buildSessionResponse(
        accessToken,
        nextRefreshToken,
        refreshExpiresAt.toISOString(),
        refreshTokenCameFromBody
      ),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Failed to refresh session' });
  } finally {
    client.release();
  }
}

export async function handleLogout(req: Request, res: Response) {
  const providedRefreshToken = getRefreshTokenFromRequest(req);

  clearRefreshTokenCookie(res);

  if (!providedRefreshToken) {
    return res.json({ success: true });
  }

  const db = getDatabase();
  const client = await db.connect();

  try {
    await deleteRefreshTokenByValue(client, providedRefreshToken);
    return res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Failed to logout' });
  } finally {
    client.release();
  }
}

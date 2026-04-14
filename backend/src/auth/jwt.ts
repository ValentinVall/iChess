import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/index.js';

export class JWTService {
  generateJWT(userId: string, authSubject: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      userId,
      authSubject,
      iat: now,
      exp: now + this.getAccessTokenTtlSeconds(),
    };

    return jwt.sign(payload, this.getJwtSecret(), {
      algorithm: 'HS256',
    });
  }

  verifyJWT(token: string): JWTPayload {
    const decoded = jwt.verify(token, this.getJwtSecret(), {
      algorithms: ['HS256'],
    });

    return decoded as JWTPayload;
  }

  private getJwtSecret() {
    const jwtSecret = process.env.JWT_SECRET?.trim();

    if (!jwtSecret) {
      throw new Error('Missing JWT_SECRET configuration');
    }

    return jwtSecret;
  }

  private getAccessTokenTtlSeconds() {
    const ttlValue = Number(process.env.JWT_ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60);

    if (!Number.isFinite(ttlValue) || ttlValue <= 0) {
      throw new Error('Invalid JWT_ACCESS_TOKEN_TTL_SECONDS configuration');
    }

    return Math.floor(ttlValue);
  }
}

export function createJWTService() {
  return new JWTService();
}
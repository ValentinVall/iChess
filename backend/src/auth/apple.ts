import jwt from 'jsonwebtoken';
import axios from 'axios';
import { z } from 'zod';
import type { AppleToken, JWTPayload } from '../types/index.js';

const APPLE_AUTH_URL = 'https://appleid.apple.com';

export class AppleAuthService {
  private teamId: string;
  private bundleId: string;
  private keyId: string;

  constructor(teamId: string, bundleId: string, keyId: string) {
    this.teamId = teamId;
    this.bundleId = bundleId;
    this.keyId = keyId;
  }

  /**
   * Verify Apple identity token
   */
  async verifyToken(identityToken: string): Promise<AppleToken> {
    try {
      // Fetch Apple's public keys
      const response = await axios.get(`${APPLE_AUTH_URL}/auth/keys`);
      const keys = response.data.keys;

      // Decode header to get key ID
      const headerPayload = identityToken.split('.')[0];
      const decodedHeader = JSON.parse(Buffer.from(headerPayload, 'base64').toString());
      const kid = decodedHeader.kid;

      // Find the matching public key
      const publicKey = keys.find((key: any) => key.kid === kid);
      if (!publicKey) {
        throw new Error('Public key not found');
      }

      // Convert JWK to PEM format (simplified - use a library in production)
      // For production, use `node-jose` or similar
      const decoded = jwt.verify(identityToken, `-----BEGIN PUBLIC KEY-----\n${publicKey.n}\n-----END PUBLIC KEY-----`, {
        algorithms: ['RS256'],
      });

      // Validate token structure
      const tokenSchema = z.object({
        iss: z.string(),
        aud: z.string(),
        exp: z.number(),
        iat: z.number(),
        sub: z.string(),
        email: z.string().optional(),
      });

      return tokenSchema.parse(decoded) as AppleToken;
    } catch (error) {
      console.error('Apple token verification failed:', error);
      throw new Error('Invalid Apple identity token');
    }
  }

  /**
   * Generate JWT for authenticated user
   */
  generateJWT(userId: string, appleId: string): string {
    const payload: JWTPayload = {
      userId,
      appleId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
      algorithm: 'HS256',
    });
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret', {
        algorithms: ['HS256'],
      });
      return decoded as JWTPayload;
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  }
}

export function createAppleAuthService(): AppleAuthService {
  const teamId = process.env.APPLE_TEAM_ID || '';
  const bundleId = process.env.APPLE_BUNDLE_ID || '';
  const keyId = process.env.APPLE_KEY_ID || '';

  return new AppleAuthService(teamId, bundleId, keyId);
}

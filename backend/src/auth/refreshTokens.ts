import { createHash, randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';

const REFRESH_TOKEN_BYTES = 48;

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
}

export function generateRefreshToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function getRefreshTokenTtlSeconds() {
  const ttlValue = Number(process.env.JWT_REFRESH_TOKEN_TTL_SECONDS ?? 30 * 24 * 60 * 60);

  if (!Number.isFinite(ttlValue) || ttlValue <= 0) {
    throw new Error('Invalid JWT_REFRESH_TOKEN_TTL_SECONDS configuration');
  }

  return Math.floor(ttlValue);
}

export async function persistRefreshToken(
  client: PoolClient,
  userId: string,
  token: string,
  expiresAt: Date
) {
  const tokenHash = hashRefreshToken(token);

  const result = await client.query<RefreshTokenRecord>(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id AS "userId", expires_at AS "expiresAt"`,
    [userId, tokenHash, expiresAt]
  );

  return result.rows[0];
}

export async function findRefreshToken(client: PoolClient, token: string) {
  const tokenHash = hashRefreshToken(token);
  const result = await client.query<RefreshTokenRecord>(
    `SELECT id, user_id AS "userId", expires_at AS "expiresAt"
     FROM refresh_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  return result.rows[0] ?? null;
}

export async function deleteRefreshTokenById(client: PoolClient, refreshTokenId: string) {
  await client.query(`DELETE FROM refresh_tokens WHERE id = $1`, [refreshTokenId]);
}

export async function deleteRefreshTokenByValue(client: PoolClient, token: string) {
  await client.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hashRefreshToken(token)]);
}

export async function deleteExpiredRefreshTokens(client: PoolClient) {
  await client.query(`DELETE FROM refresh_tokens WHERE expires_at <= NOW()`);
}
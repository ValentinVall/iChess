import express, { Router } from 'express';
import { getDatabase } from '../database/connection.js';
import type { AuthRequest } from '../auth/routes.js';
import { getWebSocketManager } from '../websocket/manager.js';
import {
  DEFAULT_ONLINE_RATING_MODE,
  ONLINE_RATING_MODES,
  type OnlineRatingMode,
  isOnlineRatingMode,
} from '../games/modes.js';

const router = Router();

const PROFILE_STAT_MODES = ['bullet', 'blitz', 'ai', 'rapid'] as const;

type ProfileStatMode = (typeof PROFILE_STAT_MODES)[number];

type ModeStatLine = {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: number;
};

type FriendshipStatus = 'pending' | 'accepted';

type FriendshipDirection = 'accepted' | 'incoming' | 'outgoing';

type FriendshipListItem = {
  friendshipId: string;
  userId: number;
  username: string;
  playerNumber: string | null;
  bio: string;
  status: FriendshipStatus;
  direction: FriendshipDirection;
};

type ProfileRow = {
  id: number;
  player_number: number | null;
  username: string | null;
  bio: string | null;
  is_system: boolean | null;
  created_at: string;
};

function parsePlayerNumberInput(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const digits = String(value).replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function getFriendCount(userId: number) {
  const db = getDatabase();
  const result = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM friendships
     WHERE status = 'accepted'
       AND (requester_id = $1 OR addressee_id = $1)`,
    [userId],
  );

  return Number(result.rows[0]?.count || 0);
}

async function getFriendshipByUsers(currentUserId: number, otherUserId: number) {
  const db = getDatabase();
  const result = await db.query(
    `SELECT id, requester_id, addressee_id, status
     FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)
     LIMIT 1`,
    [currentUserId, otherUserId],
  );

  return result.rows[0] as
    | { id: string; requester_id: number; addressee_id: number; status: FriendshipStatus }
    | undefined;
}

async function getProfileById(userId: number) {
  const db = getDatabase();
  const result = await db.query(
    `SELECT id, player_number, username, bio, is_system, created_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] as ProfileRow | undefined;
}

async function getProfileByPlayerNumber(playerNumber: number) {
  const db = getDatabase();
  const result = await db.query(
    `SELECT id, player_number, username, bio, is_system, created_at
     FROM users
     WHERE player_number = $1
       AND COALESCE(is_system, FALSE) = FALSE
     LIMIT 1`,
    [playerNumber],
  );

  return result.rows[0] as ProfileRow | undefined;
}

async function buildProfilePayload(user: ProfileRow, selectedMode: ProfileStatMode, isOwnProfile: boolean) {
  const modeStats = await loadModeStats(Number(user.id));
  const selectedModeStats = modeStats[selectedMode];
  const friendCount = await getFriendCount(Number(user.id));

  return {
    id: user.id,
    playerNumber: user.player_number ? `#${user.player_number}` : null,
    username: user.username || 'player',
    bio: user.bio || '',
    isSystemAccount: Boolean(user.is_system),
    accountLabel: user.is_system ? 'System account' : 'Player account',
    accountNote: user.is_system
      ? 'Reserved platform account for the built-in chess engine.'
      : 'Personal player profile',
    friendCount,
    isOwnProfile,
    selectedMode,
    modeStats,
    rating: selectedModeStats.rating,
    wins: selectedModeStats.wins,
    losses: selectedModeStats.losses,
    draws: selectedModeStats.draws,
    totalGames: selectedModeStats.totalGames,
    winRate: selectedModeStats.winRate,
    memberSince: user.created_at,
  };
}

async function getFilteredHistory(userId: number, selectedMode: ProfileStatMode, limit: number) {
  const historyModeFilter =
    selectedMode === 'ai'
      ? `AND games.mode = 'ai'`
      : `AND games.mode = 'online'
           AND games.time_control_id LIKE '${selectedMode}-%'`;

  const db = getDatabase();
  const result = await db.query(
    `SELECT
       games.id,
       games.mode,
       games.result,
       games.difficulty,
       games.created_at,
       games.completed_at,
       games.pgn,
       CASE
         WHEN games.white_player_id = $1 THEN 'white'
         ELSE 'black'
       END AS player_color,
       CASE
         WHEN games.result = 'draw' THEN 'draw'
         WHEN (games.result = 'white' AND games.white_player_id = $1)
           OR (games.result = 'black' AND games.black_player_id = $1) THEN 'win'
         ELSE 'loss'
       END AS outcome,
       CASE
         WHEN games.mode = 'ai' THEN 'AI'
         WHEN games.white_player_id = $1 THEN COALESCE(black_user.username, 'player')
         ELSE COALESCE(white_user.username, 'player')
       END AS opponent_label,
       CASE
         WHEN games.mode = 'ai' THEN NULL
         WHEN games.white_player_id = $1 THEN black_user.player_number
         ELSE white_user.player_number
       END AS opponent_player_number
     FROM games
     LEFT JOIN users AS white_user ON white_user.id = games.white_player_id
     LEFT JOIN users AS black_user ON black_user.id = games.black_player_id
     WHERE (games.white_player_id = $1 OR games.black_player_id = $1)
       AND games.status = 'completed'
       ${historyModeFilter}
     ORDER BY completed_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(game => ({
    id: game.id,
    mode: game.mode,
    outcome: game.outcome,
    result: game.result,
    playerColor: game.player_color,
    opponentLabel: game.opponent_label,
    opponentPlayerNumber: game.opponent_player_number ? `#${game.opponent_player_number}` : null,
    difficulty: game.difficulty,
    date: game.completed_at,
    duration: game.completed_at ?
      Math.round((new Date(game.completed_at).getTime() - new Date(game.created_at).getTime()) / 1000) : 0,
    pgn: game.pgn,
  }));
}

async function getFriendshipsPayload(userId: number) {
  const db = getDatabase();
  const result = await db.query(
    `SELECT
       friendships.id AS friendship_id,
       friendships.status,
       CASE
         WHEN friendships.status = 'accepted' THEN 'accepted'
         WHEN friendships.requester_id = $1 THEN 'outgoing'
         ELSE 'incoming'
       END AS direction,
       other_user.id AS user_id,
       other_user.username,
       other_user.player_number,
       other_user.bio
     FROM friendships
     JOIN users AS other_user
       ON other_user.id = CASE
         WHEN friendships.requester_id = $1 THEN friendships.addressee_id
         ELSE friendships.requester_id
       END
     WHERE (friendships.requester_id = $1 OR friendships.addressee_id = $1)
       AND COALESCE(other_user.is_system, FALSE) = FALSE
     ORDER BY friendships.updated_at DESC, friendships.created_at DESC`,
    [userId],
  );

  const friends: FriendshipListItem[] = [];
  const incomingRequests: FriendshipListItem[] = [];
  const outgoingRequests: FriendshipListItem[] = [];

  for (const row of result.rows) {
    const item: FriendshipListItem = {
      friendshipId: row.friendship_id,
      userId: Number(row.user_id),
      username: row.username || 'player',
      playerNumber: row.player_number ? `#${row.player_number}` : null,
      bio: row.bio || '',
      status: row.status,
      direction: row.direction,
    };

    if (item.direction === 'accepted') {
      friends.push(item);
      continue;
    }

    if (item.direction === 'incoming') {
      incomingRequests.push(item);
      continue;
    }

    outgoingRequests.push(item);
  }

  return {
    friendCount: friends.length,
    friends,
    incomingRequests,
    outgoingRequests,
  };
}

function isProfileStatMode(value: string | null | undefined): value is ProfileStatMode {
  return Boolean(value && PROFILE_STAT_MODES.includes(value as ProfileStatMode));
}

function resolveRequestedMode(rawMode: unknown): ProfileStatMode {
  if (typeof rawMode === 'string') {
    const normalizedMode = rawMode.trim();

    if (isProfileStatMode(normalizedMode)) {
      return normalizedMode;
    }
  }

  return DEFAULT_ONLINE_RATING_MODE;
}

function createModeStatLine(partial?: Partial<ModeStatLine>): ModeStatLine {
  const wins = Number(partial?.wins || 0);
  const losses = Number(partial?.losses || 0);
  const draws = Number(partial?.draws || 0);
  const totalGames = wins + losses + draws;

  return {
    rating: Number(partial?.rating || 800),
    wins,
    losses,
    draws,
    totalGames,
    winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
  };
}

async function loadModeStats(userId: number) {
  const db = getDatabase();
  const result = await db.query(
    `SELECT mode, rating, wins, losses, draws
     FROM user_mode_stats
     WHERE user_id = $1`,
    [userId],
  );

  const modeStats = Object.fromEntries(
    PROFILE_STAT_MODES.map((mode) => [mode, createModeStatLine(mode === 'ai' ? { rating: 0 } : undefined)]),
  ) as Record<ProfileStatMode, ModeStatLine>;

  for (const row of result.rows) {
    const rowMode = typeof row.mode === 'string' ? row.mode : null;

    if (!isOnlineRatingMode(rowMode)) {
      continue;
    }

    modeStats[rowMode] = createModeStatLine({
      rating: row.rating,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
    });
  }

  const aiStatsResult = await db.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE games.result = 'draw'
       ) AS draws,
       COUNT(*) FILTER (
         WHERE (
           games.white_player_id = $1
           AND games.result = 'white'
         ) OR (
           games.black_player_id = $1
           AND games.result = 'black'
         )
       ) AS wins,
       COUNT(*) FILTER (
         WHERE games.result <> 'draw'
           AND NOT (
             (games.white_player_id = $1 AND games.result = 'white')
             OR (games.black_player_id = $1 AND games.result = 'black')
           )
       ) AS losses
     FROM games
     WHERE games.mode = 'ai'
       AND games.status = 'completed'
       AND (games.white_player_id = $1 OR games.black_player_id = $1)`,
    [userId],
  );

  const aiStats = aiStatsResult.rows[0];
  modeStats.ai = createModeStatLine({
    rating: 0,
    wins: aiStats?.wins,
    losses: aiStats?.losses,
    draws: aiStats?.draws,
  });

  return modeStats;
}

/**
 * Get user profile
 */
router.get('/me', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await getProfileById(Number(req.userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const selectedMode = resolveRequestedMode(req.query.mode);
    res.json(await buildProfilePayload(user, selectedMode, true));
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.get('/profile/:playerNumber', async (req: AuthRequest, res) => {
  try {
    const numericPlayerNumber = parsePlayerNumberInput(req.params.playerNumber);
    if (!numericPlayerNumber) {
      return res.status(400).json({ error: 'Invalid Player Number' });
    }

    const user = await getProfileByPlayerNumber(numericPlayerNumber);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const selectedMode = resolveRequestedMode(req.query.mode);
    const isOwnProfile = Number(req.userId) === Number(user.id);
    res.json(await buildProfilePayload(user, selectedMode, isOwnProfile));
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.get('/me/friends', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = await getFriendshipsPayload(Number(req.userId));
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

router.get('/friends/search', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const numericPlayerNumber = parsePlayerNumberInput(req.query.playerNumber);
    if (!numericPlayerNumber) {
      return res.status(400).json({ error: 'Enter a valid Player Number' });
    }

    const db = getDatabase();
    const result = await db.query(
      `SELECT id, username, player_number, bio
       FROM users
       WHERE player_number = $1
         AND COALESCE(is_system, FALSE) = FALSE
       LIMIT 1`,
      [numericPlayerNumber],
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'No player found with that Player Number' });
    }

    const currentUserId = Number(req.userId);
    if (Number(user.id) === currentUserId) {
      return res.json({
        success: true,
        relationshipStatus: 'self',
        user: {
          userId: Number(user.id),
          username: user.username || 'player',
          playerNumber: user.player_number ? `#${user.player_number}` : null,
          bio: user.bio || '',
        },
      });
    }

    const friendship = await getFriendshipByUsers(currentUserId, Number(user.id));
    const relationshipStatus = !friendship
      ? 'none'
      : friendship.status === 'accepted'
      ? 'friend'
      : friendship.requester_id === currentUserId
      ? 'outgoing_pending'
      : 'incoming_pending';

    res.json({
      success: true,
      relationshipStatus,
      friendshipId: friendship?.id ?? null,
      user: {
        userId: Number(user.id),
        username: user.username || 'player',
        playerNumber: user.player_number ? `#${user.player_number}` : null,
        bio: user.bio || '',
      },
    });
  } catch (error) {
    console.error('Search friends error:', error);
    res.status(500).json({ error: 'Failed to search for player' });
  }
});

router.post('/me/friends/request', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const numericPlayerNumber = parsePlayerNumberInput(req.body?.playerNumber);
    if (!numericPlayerNumber) {
      return res.status(400).json({ error: 'Enter a valid Player Number' });
    }

    const currentUserId = Number(req.userId);
    const db = getDatabase();
    const targetResult = await db.query(
      `SELECT id, username, player_number, bio
       FROM users
       WHERE player_number = $1
         AND COALESCE(is_system, FALSE) = FALSE
       LIMIT 1`,
      [numericPlayerNumber],
    );

    const targetUser = targetResult.rows[0];
    if (!targetUser) {
      return res.status(404).json({ error: 'No player found with that Player Number' });
    }

    if (Number(targetUser.id) === currentUserId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    const existing = await getFriendshipByUsers(currentUserId, Number(targetUser.id));
    if (existing?.status === 'accepted') {
      return res.status(409).json({ error: 'You are already friends with this player' });
    }

    if (existing?.status === 'pending' && existing.requester_id === currentUserId) {
      return res.status(409).json({ error: 'Friend request already sent' });
    }

    let friendshipId = existing?.id ?? null;
    let relationshipStatus: 'friend' | 'outgoing_pending';

    if (existing?.status === 'pending' && existing.addressee_id === currentUserId) {
      const accepted = await db.query(
        `UPDATE friendships
         SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING id`,
        [existing.id],
      );

      friendshipId = accepted.rows[0]?.id ?? existing.id;
      relationshipStatus = 'friend';
    } else {
      const created = await db.query(
        `INSERT INTO friendships (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [currentUserId, Number(targetUser.id)],
      );

      friendshipId = created.rows[0]?.id ?? null;
      relationshipStatus = 'outgoing_pending';

      const requester = await getProfileById(currentUserId);
      const wsManager = getWebSocketManager();
      wsManager?.getIO().to(Array.from(wsManager.getIO().sockets.sockets.values())
        .filter((socket) => String(socket.data.userId ?? '') === String(targetUser.id))
        .map((socket) => socket.id)).emit('friend_request_received', {
          friendshipId,
          requestedBy: {
            userId: currentUserId,
            username: requester?.username || 'player',
            playerNumber: requester?.player_number ? `#${requester.player_number}` : null,
          },
        });
    }

    res.json({
      success: true,
      friendshipId,
      relationshipStatus,
    });
  } catch (error) {
    console.error('Create friend request error:', error);
    res.status(500).json({ error: 'Failed to update friendship' });
  }
});

router.post('/me/friends/:friendshipId/respond', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { friendshipId } = req.params;
    const action = req.body?.action;

    if (action !== 'accept' && action !== 'decline') {
      return res.status(400).json({ error: 'Invalid friendship action' });
    }

    const db = getDatabase();
    const existing = await db.query(
      `SELECT id, requester_id, addressee_id, status
       FROM friendships
       WHERE id = $1
       LIMIT 1`,
      [friendshipId],
    );

    const friendship = existing.rows[0] as
      | { id: string; requester_id: number; addressee_id: number; status: FriendshipStatus }
      | undefined;

    if (!friendship || friendship.status !== 'pending' || friendship.addressee_id !== Number(req.userId)) {
      return res.status(404).json({ error: 'Pending friend request not found' });
    }

    if (action === 'accept') {
      await db.query(
        `UPDATE friendships
         SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [friendshipId],
      );

      return res.json({ success: true, relationshipStatus: 'friend' });
    }

    await db.query(`DELETE FROM friendships WHERE id = $1`, [friendshipId]);
    res.json({ success: true, relationshipStatus: 'none' });
  } catch (error) {
    console.error('Respond friend request error:', error);
    res.status(500).json({ error: 'Failed to respond to friend request' });
  }
});

router.delete('/me/friends/:friendshipId', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { friendshipId } = req.params;
    const db = getDatabase();
    const result = await db.query(
      `DELETE FROM friendships
       WHERE id = $1
         AND (requester_id = $2 OR addressee_id = $2)
       RETURNING id`,
      [friendshipId, req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Remove friendship error:', error);
    res.status(500).json({ error: 'Failed to remove friendship' });
  }
});

router.patch('/me', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { username, bio } = req.body;

    const nextUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const nextBio = typeof bio === 'string' ? bio.trim() : '';

    if (!nextUsername || !/^[a-z]{3,20}$/.test(nextUsername)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters and use only lowercase letters' });
    }

    if (nextBio.length > 240) {
      return res.status(400).json({ error: 'Bio must be 240 characters or fewer' });
    }

    const db = getDatabase();

    const existingUser = await db.query(
      `SELECT id FROM users WHERE username = $1 AND id <> $2 LIMIT 1`,
      [nextUsername, req.userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    await db.query(
      `UPDATE users
       SET display_name = $1, username = $2, bio = $3, updated_at = NOW()
       WHERE id = $4`,
      [nextUsername, nextUsername, nextBio, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Get user stats
 */
router.get('/:userId/stats', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const selectedMode = resolveRequestedMode(req.query.mode);

    const db = getDatabase();
    const result = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const modeStats = await loadModeStats(Number(userId));
    const selectedModeStats = modeStats[selectedMode];

    res.json({
      userId,
      selectedMode,
      modeStats,
      rating: selectedModeStats.rating,
      gamesPlayed: selectedModeStats.totalGames,
      wins: selectedModeStats.wins,
      losses: selectedModeStats.losses,
      draws: selectedModeStats.draws,
      winRate: selectedModeStats.winRate,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/profile/:playerNumber/history', async (req: AuthRequest, res) => {
  try {
    const numericPlayerNumber = parsePlayerNumberInput(req.params.playerNumber);
    if (!numericPlayerNumber) {
      return res.status(400).json({ error: 'Invalid Player Number' });
    }

    const user = await getProfileByPlayerNumber(numericPlayerNumber);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const parsedLimit = Number(req.query.limit);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
      : 50;
    const selectedMode = resolveRequestedMode(req.query.mode);

    const games = await getFilteredHistory(Number(user.id), selectedMode, limit);
    res.json({ success: true, games });
  } catch (error) {
    console.error('Get public history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
});

/**
 * Get user game history
 */
router.get('/me/history', async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parsedLimit = Number(req.query.limit);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 50)
      : 50;
    const selectedMode = resolveRequestedMode(req.query.mode);
    const games = await getFilteredHistory(Number(req.userId), selectedMode, limit);

    res.json({ success: true, games });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
});

export default router;

export type RatedGameResult = 'white' | 'black' | 'draw';

export interface RatingInput {
  userId: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface RatingOutcome {
  before: number;
  after: number;
  delta: number;
}

export interface RatingUpdateResult {
  white: RatingOutcome;
  black: RatingOutcome;
}

const MIN_RATING = 100;
const PROVISIONAL_GAMES = 30;

function getGamesPlayed(player: RatingInput) {
  return player.wins + player.losses + player.draws;
}

function getExpectedScore(playerRating: number, opponentRating: number) {
  const clampedDifference = Math.max(-400, Math.min(400, opponentRating - playerRating));
  return 1 / (1 + 10 ** (clampedDifference / 400));
}

function getKFactor(player: RatingInput) {
  const gamesPlayed = getGamesPlayed(player);

  if (gamesPlayed < PROVISIONAL_GAMES) {
    return 40;
  }

  if (player.rating >= 2400) {
    return 10;
  }

  if (player.rating >= 2000) {
    return 16;
  }

  return 24;
}

function getActualScore(result: RatedGameResult, color: 'white' | 'black') {
  if (result === 'draw') {
    return 0.5;
  }

  return result === color ? 1 : 0;
}

export function calculateOnlineRatingUpdate(
  white: RatingInput,
  black: RatingInput,
  result: RatedGameResult,
): RatingUpdateResult {
  const whiteExpected = getExpectedScore(white.rating, black.rating);
  const blackExpected = getExpectedScore(black.rating, white.rating);
  const whiteActual = getActualScore(result, 'white');
  const blackActual = getActualScore(result, 'black');

  const whiteDelta = Math.round(getKFactor(white) * (whiteActual - whiteExpected));
  const blackDelta = Math.round(getKFactor(black) * (blackActual - blackExpected));

  return {
    white: {
      before: white.rating,
      after: Math.max(MIN_RATING, white.rating + whiteDelta),
      delta: Math.max(MIN_RATING, white.rating + whiteDelta) - white.rating,
    },
    black: {
      before: black.rating,
      after: Math.max(MIN_RATING, black.rating + blackDelta),
      delta: Math.max(MIN_RATING, black.rating + blackDelta) - black.rating,
    },
  };
}
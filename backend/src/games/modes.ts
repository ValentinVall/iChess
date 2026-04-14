export const ONLINE_RATING_MODES = ['bullet', 'blitz', 'rapid'] as const;

export type OnlineRatingMode = (typeof ONLINE_RATING_MODES)[number];

export const DEFAULT_ONLINE_RATING_MODE: OnlineRatingMode = 'rapid';

export function isOnlineRatingMode(value: string | null | undefined): value is OnlineRatingMode {
  return Boolean(value && ONLINE_RATING_MODES.includes(value as OnlineRatingMode));
}

export function getOnlineRatingMode(timeControlId?: string | null): OnlineRatingMode {
  const modePrefix = String(timeControlId ?? '').split('-', 1)[0];

  if (isOnlineRatingMode(modePrefix)) {
    return modePrefix;
  }

  return DEFAULT_ONLINE_RATING_MODE;
}
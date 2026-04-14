export interface StockfishLevelMeta {
  level: number;
  title: string;
  elo: number;
  accent: string;
}

export const DEFAULT_STOCKFISH_LEVEL = 4;
export const MAX_STOCKFISH_LEVEL = 15;

export const stockfishLevels: StockfishLevelMeta[] = [
  {
    level: 1,
    title: "Noob",
    elo: 100,
    accent: "from-[#78552f]/92 to-[#78552f]/34",
  },
  {
    level: 2,
    title: "Beginner",
    elo: 250,
    accent: "from-[#E0E0E0]/92 to-[#E0E0E0]/35",
  },
  {
    level: 3,
    title: "Newbie",
    elo: 500,
    accent: "from-[#B7E4C7]/90 to-[#B7E4C7]/35",
  },
  {
    level: 4,
    title: "Intermediate",
    elo: 750,
    accent: "from-[#52B788]/88 to-[#52B788]/30",
  },
  {
    level: 5,
    title: "Amateur",
    elo: 1000,
    accent: "from-[#2EC4B6]/88 to-[#2EC4B6]/30",
  },
  {
    level: 6,
    title: "4 Rank",
    elo: 1250,
    accent: "from-[#00BFFF]/90 to-[#00BFFF]/32",
  },
  {
    level: 7,
    title: "3 Rank",
    elo: 1500,
    accent: "from-[#3F37C9]/90 to-[#3F37C9]/32",
  },
  {
    level: 8,
    title: "2 Rank",
    elo: 1750,
    accent: "from-[#560BAD]/90 to-[#560BAD]/32",
  },
  {
    level: 9,
    title: "1 Rank",
    elo: 2000,
    accent: "from-[#BA2CBF]/92 to-[#BA2CBF]/34",
  },
  {
    level: 10,
    title: "Candidate Master CM",
    elo: 2200,
    accent: "from-[#FF00B3]/92 to-[#FF00B3]/34",
  },
  {
    level: 11,
    title: "Fide Master FM",
    elo: 2300,
    accent: "from-[#FF9F1C]/92 to-[#FF9F1C]/34",
  },
  {
    level: 12,
    title: "International Master IM",
    elo: 2400,
    accent: "from-[#FF3D00]/94 to-[#FF3D00]/36",
  },
  {
    level: 13,
    title: "Grandmaster GM",
    elo: 2500,
    accent: "from-[#FFD700]/94 to-[#FFD700]/38",
  },
  {
    level: 14,
    title: "Super Grandmaster",
    elo: 2700,
    accent: "from-[#000000]/96 to-[#2B2B2B]/44",
  },
  {
    level: 15,
    title: "World Champion",
    elo: 3000,
    accent: "from-[#FFFFFF]/98 to-[#E9E9E9]/44",
  },
];

export function getStockfishLevelMeta(level: number) {
  return stockfishLevels.find((item) => item.level === level) || stockfishLevels[DEFAULT_STOCKFISH_LEVEL - 1];
}
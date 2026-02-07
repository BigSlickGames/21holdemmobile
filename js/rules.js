export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const STARTING_STACK = 5000;
export const MIN_BUYIN_MULTIPLIER = 10;

export const BLIND_PRESETS = [
  { id: "low", label: "1 / 2", smallBlind: 1, bigBlind: 2 },
  { id: "mid", label: "10 / 20", smallBlind: 10, bigBlind: 20 },
  { id: "high", label: "100 / 200", smallBlind: 100, bigBlind: 200 },
];

export const ROUND_SEQUENCE = [
  "Pre-Action",
  "Action",
  "Stage",
  "Show",
  "Caboose",
];

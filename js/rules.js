export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const STARTING_STACK = 100;

export const BLIND_PRESETS = [
  { id: "low", label: "1 / 2", smallBlind: 1, bigBlind: 2 },
  { id: "mid", label: "2 / 4", smallBlind: 2, bigBlind: 4 },
  { id: "high", label: "5 / 10", smallBlind: 5, bigBlind: 10 },
];

export const ROUND_SEQUENCE = [
  "Pre-Action",
  "Action",
  "Stage",
  "Show",
  "Caboose",
];

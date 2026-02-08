export const SMALL_BLIND = 1;
export const BIG_BLIND = 2;
export const STARTING_STACK = 5000;
export const MIN_BUYIN_MULTIPLIER = 50;

export const BLIND_PRESETS = [
  { id: "b1", label: "1 / 2", smallBlind: 1, bigBlind: 2 },
  { id: "b2", label: "2 / 4", smallBlind: 2, bigBlind: 4 },
  { id: "b3", label: "5 / 10", smallBlind: 5, bigBlind: 10 },
  { id: "b4", label: "10 / 20", smallBlind: 10, bigBlind: 20 },
  { id: "b5", label: "20 / 40", smallBlind: 20, bigBlind: 40 },
  { id: "b6", label: "50 / 100", smallBlind: 50, bigBlind: 100 },
  { id: "b7", label: "100 / 200", smallBlind: 100, bigBlind: 200 },
  { id: "b8", label: "250 / 500", smallBlind: 250, bigBlind: 500 },
  { id: "b9", label: "500 / 1000", smallBlind: 500, bigBlind: 1000 },
];

export const ROUND_SEQUENCE = [
  "Pre-Action",
  "Action",
  "Stage",
  "Show",
  "Caboose",
];

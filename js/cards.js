const CARD_ASSET_DIR = "assets/images/playing-cards/Cards (large)";
const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

export const CARD_BACK_IMAGE = `${CARD_ASSET_DIR}/card_back.png`;

const rankToken = (rank) => {
  if (rank === "10") {
    return "10";
  }
  if (rank === "J" || rank === "Q" || rank === "K" || rank === "A") {
    return rank;
  }
  return `0${rank}`;
};

export const cardImagePath = (card) =>
  `${CARD_ASSET_DIR}/card_${card.suit}_${rankToken(card.rank)}.png`;

export const cardDisplayName = (card) => {
  const suitName = card.suit.charAt(0).toUpperCase() + card.suit.slice(1);
  return `${card.rank} of ${suitName}`;
};

export const isTenValue = (card) => ["10", "J", "Q", "K"].includes(card.rank);

export const calculateBestTotal = (cards) => {
  let total = 0;
  let aces = 0;

  cards.forEach((card) => {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
      return;
    }
    if (isTenValue(card)) {
      total += 10;
      return;
    }
    total += Number(card.rank);
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
};

export const isBlackjack = (cards) => {
  if (cards.length !== 2) {
    return false;
  }
  const hasAce = cards.some((card) => card.rank === "A");
  const hasTenCard = cards.some((card) => isTenValue(card));
  return hasAce && hasTenCard;
};

export const buildShuffledDeck = () => {
  const deck = [];

  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      const card = { suit, rank };
      deck.push({
        ...card,
        id: `${suit}-${rank}`,
        image: cardImagePath(card),
      });
    });
  });

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = deck[index];
    deck[index] = deck[swapIndex];
    deck[swapIndex] = temp;
  }

  return deck;
};

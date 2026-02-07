export const tutorialModules = [
  { id: "fundamentals", label: "Fundamentals" },
  { id: "rounds", label: "Rounds" },
  { id: "actions", label: "Actions" },
  { id: "special", label: "Double Down" },
  { id: "winning", label: "Winning" },
];

export const tutorialScreens = [
  {
    module: "fundamentals",
    title: "Objective",
    paragraphs: [
      "21 Hold'em blends poker betting structure with blackjack totals.",
      "The best total at or under 21 wins the hand.",
    ],
    bullets: [
      "Players compete against each other, not a house dealer.",
      "Each hand starts with a fresh shuffle.",
    ],
  },
  {
    module: "fundamentals",
    title: "Table Setup",
    paragraphs: ["The dealer button rotates clockwise each hand."],
    bullets: [
      "Left of dealer posts Small Blind.",
      "Next player posts Big Blind.",
      "In this build, blinds are 1 and 2.",
    ],
  },
  {
    module: "fundamentals",
    title: "Card Values",
    paragraphs: [
      "Number cards count as face value.",
      "J, Q, K are worth 10.",
      "Aces flex between 1 and 11.",
    ],
    bullets: ["If your best total goes above 21, you bust."],
  },
  {
    module: "rounds",
    title: "Five Betting Rounds",
    paragraphs: ["A new community card can appear after each betting cycle."],
    bullets: ["Pre-Action", "Action", "Stage", "Show", "Caboose"],
  },
  {
    module: "rounds",
    title: "Pre-Action",
    paragraphs: ["Players act using only private cards and blind pressure."],
    bullets: [
      "Check, bet, call, raise, fold.",
      "Double Down is only available here.",
    ],
  },
  {
    module: "actions",
    title: "Core Betting Actions",
    paragraphs: ["Betting mirrors poker-style turn flow."],
    bullets: [
      "Check when there is no bet.",
      "Call to match the current bet.",
      "Raise to increase pressure.",
      "Fold to exit the hand.",
    ],
  },
  {
    module: "actions",
    title: "Standing",
    paragraphs: [
      "Stand locks your current total and you stop receiving future community cards.",
    ],
    bullets: [
      "You still make betting decisions.",
      "You can still check, call, or fold.",
    ],
  },
  {
    module: "actions",
    title: "Quick Sizes",
    paragraphs: ["Bet and raise controls provide fast presets."],
    bullets: ["Min", "1/2 Pot", "Pot"],
  },
  {
    module: "special",
    title: "Double Down Rule",
    paragraphs: ["Double Down commits a one-off stake equal to the current pot."],
    bullets: [
      "Pre-Action only.",
      "Deals a second private card immediately.",
      "Locks out future raises for that player.",
    ],
  },
  {
    module: "special",
    title: "Instant 21",
    paragraphs: ["Some first-round totals can end the hand instantly."],
    bullets: [
      "Blackjack (Ace + 10-value) is instant win.",
      "A Double Down total of 21 is also instant win.",
    ],
  },
  {
    module: "winning",
    title: "Showdown",
    paragraphs: [
      "After the Caboose betting round, remaining players compare totals.",
    ],
    bullets: [
      "Bust players cannot win.",
      "Highest legal total takes the pot.",
      "Ties split equally.",
    ],
  },
];

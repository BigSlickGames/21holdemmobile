import {
  buildShuffledDeck,
  calculateBestTotal,
  cardDisplayName,
  isBlackjack,
} from "./cards.js";
import {
  BIG_BLIND,
  MIN_BUYIN_MULTIPLIER,
  ROUND_SEQUENCE,
  SMALL_BLIND,
  STARTING_STACK,
} from "./rules.js";

const PLAYER_CONFIG = [
  { name: "You", isHuman: true, botStyle: null },
  { name: "North Bot", isHuman: false, botStyle: "conservative" },
  { name: "East Bot", isHuman: false, botStyle: "aggressive" },
];

export class Holdem21Engine {
  constructor(options = {}) {
    this.smallBlindAmount = Number(options.smallBlind) || SMALL_BLIND;
    this.bigBlindAmount = Number(options.bigBlind) || BIG_BLIND;
    if (this.bigBlindAmount <= this.smallBlindAmount) {
      this.bigBlindAmount = this.smallBlindAmount * 2;
    }

    this.players = PLAYER_CONFIG.map((config, index) =>
      this.createPlayer(index, config.name, config.isHuman, config.botStyle)
    );
    this.handNumber = 0;
    this.dealerIndex = -1;
    this.smallBlindIndex = 0;
    this.bigBlindIndex = 1;
    this.roundIndex = 0;
    this.community = [];
    this.deck = [];
    this.currentBet = 0;
    this.pot = 0;
    this.currentTurnIndex = null;
    this.handComplete = false;
    this.handResult = "";
    this.log = [];
    this.startNewHand();
  }

  setBlindStructure(smallBlind, bigBlind) {
    const sb = Math.max(1, Number(smallBlind) || SMALL_BLIND);
    let bb = Math.max(sb + 1, Number(bigBlind) || BIG_BLIND);
    if (bb <= sb) {
      bb = sb * 2;
    }
    this.smallBlindAmount = sb;
    this.bigBlindAmount = bb;
    this.logEvent(`Blind level updated to ${sb}/${bb}.`);
  }

  setPlayerName(name) {
    const cleanName = String(name || "").trim().slice(0, 12);
    this.players[0].name = cleanName || "PLAYER";
  }

  getMinBuyIn() {
    return this.bigBlindAmount * MIN_BUYIN_MULTIPLIER;
  }

  createPlayer(id, name, isHuman, botStyle = null) {
    return {
      id,
      name,
      isHuman,
      botStyle,
      chips: STARTING_STACK,
      hand: [],
      folded: false,
      busted: false,
      standing: false,
      doubleDown: false,
      raiseLocked: false,
      lockedCommunityCount: null,
      roundBet: 0,
      totalBet: 0,
      hasActed: false,
      lastAction: "Waiting",
    };
  }

  nextIndex(index) {
    return (index + 1) % this.players.length;
  }

  logEvent(message) {
    this.log.unshift(message);
    this.log = this.log.slice(0, 24);
  }

  drawCard() {
    return this.deck.pop() || null;
  }

  dealPrivateCard(player) {
    const card = this.drawCard();
    if (card) {
      player.hand.push(card);
    }
    return card;
  }

  startNewHand() {
    this.handNumber += 1;
    this.dealerIndex = this.nextIndex(this.dealerIndex);
    this.smallBlindIndex = this.nextIndex(this.dealerIndex);
    this.bigBlindIndex = this.nextIndex(this.smallBlindIndex);
    this.deck = buildShuffledDeck();
    this.community = [];
    this.roundIndex = 0;
    this.currentBet = 0;
    this.pot = 0;
    this.currentTurnIndex = null;
    this.handComplete = false;
    this.handResult = "";
    this.log = [];

    this.players.forEach((player) => {
      const minBuyIn = this.getMinBuyIn();
      if (player.chips < minBuyIn) {
        player.chips = Math.max(STARTING_STACK, minBuyIn);
      }
      player.hand = [];
      player.folded = false;
      player.busted = false;
      player.standing = false;
      player.doubleDown = false;
      player.raiseLocked = false;
      player.lockedCommunityCount = null;
      player.roundBet = 0;
      player.totalBet = 0;
      player.hasActed = false;
      player.lastAction = "Waiting";
    });

    this.logEvent(
      `Hand ${this.handNumber} begins. Dealer: ${this.players[this.dealerIndex].name}. Blinds ${this.smallBlindAmount}/${this.bigBlindAmount}.`
    );
    this.postBlind(this.smallBlindIndex, this.smallBlindAmount, "SB");
    this.postBlind(this.bigBlindIndex, this.bigBlindAmount, "BB");
    this.currentBet = Math.max(...this.players.map((player) => player.roundBet));

    let dealIndex = this.nextIndex(this.bigBlindIndex);
    for (let count = 0; count < this.players.length; count += 1) {
      const player = this.players[dealIndex];
      this.dealPrivateCard(player);
      dealIndex = this.nextIndex(dealIndex);
    }

    this.currentTurnIndex = this.findNextPlayerToAct(this.nextIndex(this.bigBlindIndex));
    this.logEvent(`${ROUND_SEQUENCE[this.roundIndex]} round starts.`);

    if (this.currentTurnIndex === null) {
      this.finishRound();
    }
  }

  postBlind(playerIndex, amount, label) {
    const player = this.players[playerIndex];
    const posted = this.applyContribution(player, amount);
    player.lastAction = `${label} ${posted}`;
    this.logEvent(`${player.name} posts ${label} (${posted}).`);
  }

  getCardsForPlayer(player) {
    if (player.folded) {
      const foldedCommunityCount =
        player.lockedCommunityCount === null
          ? 0
          : Math.min(player.lockedCommunityCount, this.community.length);
      return [...player.hand, ...this.community.slice(0, foldedCommunityCount)];
    }
    const communityCount =
      player.lockedCommunityCount === null
        ? this.community.length
        : Math.min(player.lockedCommunityCount, this.community.length);
    return [...player.hand, ...this.community.slice(0, communityCount)];
  }

  getPlayerTotal(player) {
    return calculateBestTotal(this.getCardsForPlayer(player));
  }

  getToCall(player) {
    return Math.max(0, this.currentBet - player.roundBet);
  }

  applyContribution(player, rawAmount) {
    const amount = Math.max(0, Number(rawAmount) || 0);
    const paid = Math.min(player.chips, amount);
    if (paid <= 0) {
      return 0;
    }
    player.chips -= paid;
    player.roundBet += paid;
    player.totalBet += paid;
    this.pot += paid;
    return paid;
  }

  activeContenders() {
    return this.players.filter((player) => !player.folded && !player.busted);
  }

  allActivePlayersStanding() {
    const contenders = this.activeContenders();
    if (contenders.length === 0) {
      return false;
    }
    return contenders.every((player) => player.standing);
  }

  maybeEndByLastPlayer() {
    const contenders = this.activeContenders();
    if (contenders.length === 1) {
      this.payoutWinners(contenders, `${contenders[0].name} wins by elimination.`);
      return true;
    }
    if (contenders.length === 0) {
      this.handComplete = true;
      this.handResult = "All players busted. Pot has no winner.";
      this.currentTurnIndex = null;
      this.currentBet = 0;
      this.logEvent(this.handResult);
      return true;
    }
    return false;
  }

  markBust(player) {
    if (player.folded || player.busted) {
      return false;
    }
    const total = this.getPlayerTotal(player);
    if (total > 21) {
      player.busted = true;
      player.lastAction = `Bust (${total})`;
      this.logEvent(`${player.name} busts with ${total}.`);
      return true;
    }
    return false;
  }

  refreshBusts() {
    let changed = false;
    this.players.forEach((player) => {
      if (this.markBust(player)) {
        changed = true;
      }
    });
    return changed;
  }

  resolveInstantWins() {
    if (this.roundIndex !== 0) {
      return false;
    }

    const winners = this.activeContenders().filter((player) => {
      const cards = this.getCardsForPlayer(player);
      if (cards.length !== 2) {
        return false;
      }
      const total = calculateBestTotal(cards);
      if (player.doubleDown && total === 21) {
        return true;
      }
      return isBlackjack(cards);
    });

    if (winners.length === 0) {
      return false;
    }

    const summary =
      winners.length === 1
        ? `${winners[0].name} hits instant 21.`
        : "Multiple instant 21 hands split the pot.";
    this.payoutWinners(winners, summary);
    return true;
  }

  resetRoundActed(exemptPlayerId) {
    this.players.forEach((player) => {
      if (player.id === exemptPlayerId) {
        return;
      }
      if (player.folded || player.busted || player.chips <= 0) {
        return;
      }
      player.hasActed = false;
    });
  }

  playerNeedsAction(player) {
    if (player.folded || player.busted || player.chips <= 0) {
      return false;
    }
    const toCall = this.getToCall(player);
    if (toCall > 0) {
      return true;
    }
    return !player.hasActed;
  }

  findNextPlayerToAct(startIndex) {
    let index = startIndex;
    for (let count = 0; count < this.players.length; count += 1) {
      const player = this.players[index];
      if (this.playerNeedsAction(player)) {
        return index;
      }
      index = this.nextIndex(index);
    }
    return null;
  }

  isRoundComplete() {
    const contenders = this.activeContenders();
    if (contenders.length <= 1) {
      return true;
    }

    for (const player of contenders) {
      if (player.chips <= 0) {
        continue;
      }
      const toCall = this.getToCall(player);
      if (toCall > 0 || !player.hasActed) {
        return false;
      }
    }

    return true;
  }

  getAvailableActions(player = this.players[this.currentTurnIndex]) {
    if (!player || this.handComplete || player.folded || player.busted) {
      return [];
    }

    const actions = [];
    const toCall = this.getToCall(player);
    const canStayInHand = this.activeContenders().length > 1;

    if (canStayInHand) {
      actions.push("fold");
    }

    if (toCall > 0) {
      actions.push("call");
    } else {
      actions.push("check");
    }

    if (!player.standing) {
      if (this.roundIndex < ROUND_SEQUENCE.length - 1) {
        actions.push("stand");
      }

      if (toCall === 0 && player.chips > 0) {
        actions.push("bet");
      }

      if (toCall > 0 && player.chips > toCall && !player.raiseLocked) {
        actions.push("raise");
      }

      if (
        this.roundIndex === 0 &&
        player.hand.length === 1 &&
        !player.doubleDown &&
        player.chips > 0
      ) {
        actions.push("double");
      }
    }

    if (player.standing) {
      return actions.filter((action) => ["fold", "check", "call"].includes(action));
    }

    return actions;
  }

  getWagerOptions(action, player = this.players[this.currentTurnIndex]) {
    if (!player || player.chips <= 0) {
      return [];
    }

    const presets = [
      { label: "Min", base: this.bigBlindAmount },
      { label: "1/2 Pot", base: Math.max(this.bigBlindAmount, Math.ceil(this.pot / 2)) },
      { label: "Pot", base: Math.max(this.bigBlindAmount, this.pot) },
    ];

    const options = [];
    const seen = new Set();
    const toCall = this.getToCall(player);

    presets.forEach((preset) => {
      if (action === "bet") {
        const amount = Math.min(player.chips, preset.base);
        if (amount <= 0 || seen.has(`b-${amount}`)) {
          return;
        }
        seen.add(`b-${amount}`);
        options.push({ label: preset.label, amount, cost: amount });
        return;
      }

      if (action === "raise") {
        const maxRaise = player.chips - toCall;
        if (maxRaise <= 0) {
          return;
        }
        const amount = Math.min(maxRaise, Math.max(this.bigBlindAmount, preset.base));
        if (amount <= 0 || seen.has(`r-${amount}`)) {
          return;
        }
        seen.add(`r-${amount}`);
        options.push({ label: preset.label, amount, cost: toCall + amount });
      }
    });

    return options;
  }

  performAction(action, payload = {}, source = "human") {
    if (this.handComplete || this.currentTurnIndex === null) {
      return { ok: false, reason: "Hand is not active." };
    }

    const player = this.players[this.currentTurnIndex];
    if (source === "human" && !player.isHuman) {
      return { ok: false, reason: "Not the human turn." };
    }
    if (source === "bot" && player.isHuman) {
      return { ok: false, reason: "Not the bot turn." };
    }

    const legalActions = this.getAvailableActions(player);
    if (!legalActions.includes(action)) {
      return { ok: false, reason: "Action not allowed." };
    }

    const toCall = this.getToCall(player);
    const actingIndex = this.currentTurnIndex;
    const standAfterRequested =
      Boolean(payload.standAfter) &&
      ["call", "bet", "raise"].includes(action) &&
      !player.standing &&
      this.roundIndex < ROUND_SEQUENCE.length - 1;

    const lockStanding = (followUp = false) => {
      if (player.standing) {
        return;
      }
      player.standing = true;
      player.lockedCommunityCount = this.community.length;
      const total = this.getPlayerTotal(player);
      if (followUp) {
        player.lastAction = `${player.lastAction} + Stand`;
        this.logEvent(`${player.name} stands after ${action} and locks ${total}.`);
        return;
      }
      player.lastAction = `Stand (${total})`;
      this.logEvent(`${player.name} stands on ${total}.`);
    };

    if (action === "fold") {
      player.folded = true;
      player.lockedCommunityCount = this.community.length;
      player.hasActed = true;
      player.lastAction = "Fold";
      this.logEvent(`${player.name} folds.`);
    }

    if (action === "check") {
      player.hasActed = true;
      player.lastAction = "Check";
      this.logEvent(`${player.name} checks.`);
    }

    if (action === "call") {
      const paid = this.applyContribution(player, toCall);
      player.hasActed = true;
      player.lastAction = paid < toCall ? `Call ${paid} (all-in)` : `Call ${paid}`;
      this.logEvent(`${player.name} calls ${paid}.`);
    }

    if (action === "stand") {
      player.hasActed = true;
      lockStanding(false);
    }

    if (action === "bet") {
      const wager = Math.max(this.bigBlindAmount, Number(payload.amount) || 0);
      const paid = this.applyContribution(player, wager);
      if (paid <= 0) {
        return { ok: false, reason: "Invalid bet amount." };
      }
      player.hasActed = true;
      player.lastAction = `Bet ${paid}`;
      this.currentBet = Math.max(this.currentBet, player.roundBet);
      this.resetRoundActed(player.id);
      this.logEvent(`${player.name} bets ${paid}.`);
    }

    if (action === "raise") {
      const raiseBy = Math.max(this.bigBlindAmount, Number(payload.amount) || 0);
      const totalNeeded = toCall + raiseBy;
      const paid = this.applyContribution(player, totalNeeded);
      player.hasActed = true;

      if (player.roundBet > this.currentBet) {
        this.currentBet = player.roundBet;
        this.resetRoundActed(player.id);
      }

      if (paid <= toCall) {
        player.lastAction = `Call ${paid}`;
        this.logEvent(`${player.name} calls ${paid}.`);
      } else {
        const byAmount = paid - toCall;
        player.lastAction = `Raise ${byAmount}`;
        this.logEvent(`${player.name} raises by ${byAmount}.`);
      }
    }

    if (action === "double") {
      const stake = Math.max(1, this.pot);
      const paid = this.applyContribution(player, stake);
      if (paid <= 0) {
        return { ok: false, reason: "Double Down is not available." };
      }
      player.doubleDown = true;
      player.raiseLocked = true;
      player.standing = true;
      player.lockedCommunityCount = 0;
      player.hasActed = true;
      if (player.roundBet > this.currentBet) {
        this.currentBet = player.roundBet;
        this.resetRoundActed(player.id);
      }
      const drawn = this.dealPrivateCard(player);
      player.lastAction = `Double ${paid}`;
      this.logEvent(
        `${player.name} Double Downs for ${paid} and draws ${
          drawn ? cardDisplayName(drawn) : "a card"
        }.`
      );
    }

    if (standAfterRequested && !player.folded && !player.busted) {
      lockStanding(true);
    }

    this.refreshBusts();

    if (this.resolveInstantWins()) {
      return { ok: true };
    }
    if (this.maybeEndByLastPlayer()) {
      return { ok: true };
    }

    if (this.isRoundComplete()) {
      this.finishRound();
      return { ok: true };
    }

    this.currentTurnIndex = this.findNextPlayerToAct(this.nextIndex(actingIndex));
    if (this.currentTurnIndex === null) {
      this.finishRound();
    }

    return { ok: true };
  }

  performHumanAction(action, payload = {}) {
    return this.performAction(action, payload, "human");
  }

  getOpeningValue(player) {
    const firstCard = player.hand[0];
    if (!firstCard) {
      return 0;
    }
    if (firstCard.rank === "A") {
      return 11;
    }
    if (["10", "J", "Q", "K"].includes(firstCard.rank)) {
      return 10;
    }
    return Number(firstCard.rank) || 0;
  }

  getBotWagerChoice(action, player, preference = "medium") {
    const options = this.getWagerOptions(action, player);
    if (!options.length) {
      return null;
    }
    if (preference === "min") {
      return options[0];
    }
    if (preference === "max") {
      return options[options.length - 1];
    }
    return options[Math.min(options.length - 1, 1)] || options[0];
  }

  resolveBotStyle(player, pressure) {
    if (player.chips <= Math.max(this.bigBlindAmount * 15, STARTING_STACK * 0.4)) {
      return "high-risk";
    }
    if (pressure > 0.6 && player.chips > this.bigBlindAmount * 30) {
      return "conservative";
    }
    return player.botStyle || "aggressive";
  }

  decideConservativeAction(player, actions, toCall, total, pressure) {
    const openingValue = this.getOpeningValue(player);

    if (actions.includes("double") && openingValue >= 10 && Math.random() < 0.18) {
      return { action: "double" };
    }

    if (toCall > 0) {
      if (actions.includes("fold") && total <= 12 && pressure > 0.2 && Math.random() < 0.72) {
        return { action: "fold" };
      }
      if (actions.includes("fold") && total <= 15 && pressure > 0.38 && Math.random() < 0.56) {
        return { action: "fold" };
      }
      if (actions.includes("stand") && total >= 19 && Math.random() < 0.7) {
        return { action: "stand" };
      }
      if (actions.includes("call")) {
        return { action: "call" };
      }
      if (actions.includes("check")) {
        return { action: "check" };
      }
      return { action: actions[0] || "check" };
    }

    if (actions.includes("stand") && total >= 18 && Math.random() < 0.76) {
      return { action: "stand" };
    }

    if (actions.includes("bet") && total >= 16 && Math.random() < 0.34) {
      const choice = this.getBotWagerChoice("bet", player, total >= 19 ? "medium" : "min");
      if (choice) {
        return { action: "bet", amount: choice.amount };
      }
    }

    if (actions.includes("check")) {
      return { action: "check" };
    }
    return { action: actions[0] || "check" };
  }

  decideAggressiveAction(player, actions, toCall, total, pressure) {
    const openingValue = this.getOpeningValue(player);

    if (actions.includes("double") && openingValue >= 9 && Math.random() < 0.3) {
      return { action: "double" };
    }

    if (toCall > 0) {
      if (
        actions.includes("raise") &&
        ((total >= 16 && Math.random() < 0.52) || (total >= 14 && pressure < 0.25))
      ) {
        const choice = this.getBotWagerChoice("raise", player, total >= 18 ? "max" : "medium");
        if (choice) {
          return { action: "raise", amount: choice.amount };
        }
      }
      if (actions.includes("fold") && total <= 11 && pressure > 0.5 && Math.random() < 0.48) {
        return { action: "fold" };
      }
      if (actions.includes("stand") && total >= 20 && Math.random() < 0.42) {
        return { action: "stand" };
      }
      if (actions.includes("call")) {
        return { action: "call" };
      }
      return { action: actions[0] || "check" };
    }

    if (actions.includes("bet") && total >= 13 && Math.random() < 0.7) {
      const choice = this.getBotWagerChoice("bet", player, total >= 18 ? "max" : "medium");
      if (choice) {
        return { action: "bet", amount: choice.amount };
      }
    }

    if (actions.includes("stand") && total >= 19 && Math.random() < 0.42) {
      return { action: "stand" };
    }
    if (actions.includes("check")) {
      return { action: "check" };
    }
    return { action: actions[0] || "check" };
  }

  decideHighRiskAction(player, actions, toCall, total, pressure) {
    const openingValue = this.getOpeningValue(player);

    if (actions.includes("double") && openingValue >= 7 && Math.random() < 0.42) {
      return { action: "double" };
    }

    if (toCall > 0) {
      if (actions.includes("raise") && Math.random() < 0.74) {
        const choice = this.getBotWagerChoice("raise", player, "max");
        if (choice) {
          return { action: "raise", amount: choice.amount };
        }
      }
      if (actions.includes("fold") && total <= 9 && pressure > 0.78 && Math.random() < 0.26) {
        return { action: "fold" };
      }
      if (actions.includes("call")) {
        return { action: "call" };
      }
      return { action: actions[0] || "check" };
    }

    if (actions.includes("bet") && Math.random() < 0.85) {
      const choice = this.getBotWagerChoice("bet", player, total >= 17 ? "max" : "medium");
      if (choice) {
        return { action: "bet", amount: choice.amount };
      }
    }

    if (actions.includes("stand") && total >= 20 && Math.random() < 0.28) {
      return { action: "stand" };
    }
    if (actions.includes("check")) {
      return { action: "check" };
    }
    return { action: actions[0] || "check" };
  }

  decideBotAction(player) {
    const actions = this.getAvailableActions(player);
    const toCall = this.getToCall(player);
    const total = this.getPlayerTotal(player);
    const pressure = toCall / Math.max(this.bigBlindAmount, this.pot, 1);
    const style = this.resolveBotStyle(player, pressure);

    if (style === "conservative") {
      return this.decideConservativeAction(player, actions, toCall, total, pressure);
    }
    if (style === "high-risk") {
      return this.decideHighRiskAction(player, actions, toCall, total, pressure);
    }
    return this.decideAggressiveAction(player, actions, toCall, total, pressure);
  }

  playBotTurn() {
    if (this.handComplete || this.currentTurnIndex === null) {
      return;
    }
    const player = this.players[this.currentTurnIndex];
    if (player.isHuman) {
      return;
    }
    const decision = this.decideBotAction(player);
    this.performAction(decision.action, { amount: decision.amount }, "bot");
  }

  finishRound() {
    if (this.handComplete) {
      return;
    }
    if (this.maybeEndByLastPlayer()) {
      return;
    }

    if (this.allActivePlayersStanding()) {
      this.logEvent("All remaining players are standing. Skipping to showdown.");
      this.goToShowdown();
      return;
    }

    if (this.roundIndex >= ROUND_SEQUENCE.length - 1) {
      this.goToShowdown();
      return;
    }

    const card = this.drawCard();
    if (card) {
      this.community.push(card);
      this.roundIndex += 1;
      this.logEvent(`${ROUND_SEQUENCE[this.roundIndex]} card: ${cardDisplayName(card)}.`);
    }

    this.refreshBusts();
    if (this.maybeEndByLastPlayer()) {
      return;
    }

    this.players.forEach((player) => {
      player.roundBet = 0;
      if (!player.folded && !player.busted) {
        player.hasActed = false;
      }
    });

    this.currentBet = 0;
    this.currentTurnIndex = this.findNextPlayerToAct(this.nextIndex(this.dealerIndex));

    if (this.currentTurnIndex === null) {
      this.logEvent("No betting decisions available. Advancing.");
      this.finishRound();
      return;
    }

    this.logEvent(`${ROUND_SEQUENCE[this.roundIndex]} betting begins.`);
  }

  goToShowdown() {
    const finalists = this.activeContenders().filter(
      (player) => this.getPlayerTotal(player) <= 21
    );

    if (finalists.length === 0) {
      this.handComplete = true;
      this.handResult = "Showdown: all remaining players are bust.";
      this.currentTurnIndex = null;
      this.currentBet = 0;
      this.logEvent(this.handResult);
      return;
    }

    const bestTotal = Math.max(...finalists.map((player) => this.getPlayerTotal(player)));
    const winners = finalists.filter((player) => this.getPlayerTotal(player) === bestTotal);
    const resultText =
      winners.length === 1
        ? `${winners[0].name} wins showdown with ${bestTotal}.`
        : `Split pot with ${bestTotal}.`;
    this.payoutWinners(winners, resultText);
  }

  payoutWinners(winners, reason) {
    if (!winners.length) {
      this.handComplete = true;
      this.handResult = reason;
      this.currentTurnIndex = null;
      this.currentBet = 0;
      this.logEvent(reason);
      return;
    }

    const split = Math.floor(this.pot / winners.length);
    let remainder = this.pot - split * winners.length;

    winners.forEach((player) => {
      player.chips += split;
      player.lastAction = "Winner";
    });

    let pointer = 0;
    while (remainder > 0) {
      winners[pointer % winners.length].chips += 1;
      pointer += 1;
      remainder -= 1;
    }

    this.handComplete = true;
    this.handResult = reason;
    this.currentTurnIndex = null;
    this.currentBet = 0;
    this.logEvent(reason);
  }

  getVisibleState() {
    return {
      handNumber: this.handNumber,
      roundIndex: this.roundIndex,
      roundName: ROUND_SEQUENCE[this.roundIndex],
      startingStack: STARTING_STACK,
      minBuyIn: this.getMinBuyIn(),
      smallBlindAmount: this.smallBlindAmount,
      bigBlindAmount: this.bigBlindAmount,
      dealerIndex: this.dealerIndex,
      smallBlindIndex: this.smallBlindIndex,
      bigBlindIndex: this.bigBlindIndex,
      currentTurnIndex: this.currentTurnIndex,
      currentBet: this.currentBet,
      pot: this.pot,
      community: [...this.community],
      handComplete: this.handComplete,
      handResult: this.handResult,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        isHuman: player.isHuman,
        chips: player.chips,
        hand: [...player.hand],
        folded: player.folded,
        busted: player.busted,
        standing: player.standing,
        doubleDown: player.doubleDown,
        raiseLocked: player.raiseLocked,
        lockedCommunityCount: player.lockedCommunityCount,
        roundBet: player.roundBet,
        totalBet: player.totalBet,
        total: this.getPlayerTotal(player),
        lastAction: player.lastAction,
      })),
      log: [...this.log],
    };
  }
}

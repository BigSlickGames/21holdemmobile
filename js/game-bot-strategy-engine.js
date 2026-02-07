import { STARTING_STACK } from "./rules.js";

const getOpeningValue = (player) => {
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
};

const getBotWagerChoice = (engine, action, player, preference = "medium") => {
  const options = engine.getWagerOptions(action, player);
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
};

const resolveBotStyle = (engine, player, pressure) => {
  if (player.chips <= Math.max(engine.bigBlindAmount * 15, STARTING_STACK * 0.4)) {
    return "high-risk";
  }
  if (pressure > 0.6 && player.chips > engine.bigBlindAmount * 30) {
    return "conservative";
  }
  return player.botStyle || "aggressive";
};

const pickFallbackAction = (actions, toCall) => {
  if (toCall > 0 && actions.includes("call")) {
    return { action: "call" };
  }
  if (actions.includes("check")) {
    return { action: "check" };
  }
  if (actions.includes("fold")) {
    return { action: "fold" };
  }
  return { action: actions[0] || "check" };
};

const decideConservativeAction = (engine, player, actions, toCall, total, pressure) => {
  const openingValue = getOpeningValue(player);
  const inPreAction = engine.roundIndex === 0 && player.hand.length === 1;

  if (toCall > 0) {
    if (actions.includes("call")) {
      if (inPreAction || total >= 16 || pressure <= 0.28) {
        return { action: "call" };
      }
      if (total >= 13 && pressure <= 0.45) {
        return { action: "call" };
      }
    }
    if (actions.includes("fold") && !inPreAction) {
      if (total <= 10 || (total <= 12 && pressure > 0.55)) {
        return { action: "fold" };
      }
    }
    if (actions.includes("call")) {
      return { action: "call" };
    }
    return pickFallbackAction(actions, toCall);
  }

  if (actions.includes("stand") && total >= 17) {
    return { action: "stand" };
  }

  if (actions.includes("double") && openingValue >= 10 && Math.random() < 0.16) {
    return { action: "double" };
  }

  if (actions.includes("bet") && total >= 18 && Math.random() < 0.35) {
    const choice = getBotWagerChoice(engine, "bet", player, total >= 19 ? "medium" : "min");
    if (choice) {
      return { action: "bet", amount: choice.amount };
    }
  }

  return pickFallbackAction(actions, toCall);
};

const decideAggressiveAction = (engine, player, actions, toCall, total, pressure) => {
  const openingValue = getOpeningValue(player);
  const inPreAction = engine.roundIndex === 0 && player.hand.length === 1;

  if (toCall > 0) {
    if (actions.includes("raise") && total >= 15 && pressure < 0.55 && Math.random() < 0.42) {
      const choice = getBotWagerChoice(
        engine,
        "raise",
        player,
        total >= 18 ? "max" : "medium"
      );
      if (choice) {
        return { action: "raise", amount: choice.amount };
      }
    }
    if (actions.includes("call")) {
      if (inPreAction || total >= 12 || pressure <= 0.62) {
        return { action: "call" };
      }
    }
    if (actions.includes("fold") && !inPreAction && total <= 9 && pressure > 0.72) {
      return { action: "fold" };
    }
    if (actions.includes("call")) {
      return { action: "call" };
    }
    return pickFallbackAction(actions, toCall);
  }

  if (actions.includes("stand") && total >= 18) {
    return { action: "stand" };
  }

  if (actions.includes("double") && openingValue >= 9 && Math.random() < 0.24) {
    return { action: "double" };
  }

  if (actions.includes("bet") && total >= 14 && Math.random() < 0.7) {
    const choice = getBotWagerChoice(
      engine,
      "bet",
      player,
      total >= 18 ? "max" : "medium"
    );
    if (choice) {
      return { action: "bet", amount: choice.amount };
    }
  }

  return pickFallbackAction(actions, toCall);
};

const decideHighRiskAction = (engine, player, actions, toCall, total, pressure) => {
  const openingValue = getOpeningValue(player);
  const inPreAction = engine.roundIndex === 0 && player.hand.length === 1;

  if (toCall > 0) {
    if (actions.includes("raise") && total >= 13 && pressure < 0.9 && Math.random() < 0.62) {
      const choice = getBotWagerChoice(engine, "raise", player, "max");
      if (choice) {
        return { action: "raise", amount: choice.amount };
      }
    }
    if (actions.includes("call")) {
      if (inPreAction || total >= 10 || pressure < 0.85) {
        return { action: "call" };
      }
    }
    if (actions.includes("fold") && !inPreAction && total <= 8 && pressure > 0.9) {
      return { action: "fold" };
    }
    if (actions.includes("call")) {
      return { action: "call" };
    }
    return pickFallbackAction(actions, toCall);
  }

  if (actions.includes("stand") && total >= 18 && Math.random() < 0.74) {
    return { action: "stand" };
  }

  if (actions.includes("double") && openingValue >= 8 && Math.random() < 0.35) {
    return { action: "double" };
  }

  if (actions.includes("bet") && total >= 12 && Math.random() < 0.82) {
    const choice = getBotWagerChoice(
      engine,
      "bet",
      player,
      total >= 17 ? "max" : "medium"
    );
    if (choice) {
      return { action: "bet", amount: choice.amount };
    }
  }

  return pickFallbackAction(actions, toCall);
};

export const decideBotActionForPlayer = (engine, player) => {
  const actions = engine.getAvailableActions(player);
  if (!actions.length) {
    return { action: "check" };
  }
  const toCall = engine.getToCall(player);
  const total = engine.getPlayerTotal(player);
  const pressure = toCall / Math.max(engine.bigBlindAmount, engine.pot, 1);
  const style = resolveBotStyle(engine, player, pressure);

  if (style === "conservative") {
    return decideConservativeAction(engine, player, actions, toCall, total, pressure);
  }
  if (style === "high-risk") {
    return decideHighRiskAction(engine, player, actions, toCall, total, pressure);
  }
  return decideAggressiveAction(engine, player, actions, toCall, total, pressure);
};

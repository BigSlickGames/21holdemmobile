const getActionAmount = (actionText) => {
  const match = String(actionText).match(/(\d+)/);
  return match ? match[1] : null;
};

export const buildActionVoiceLine = (playerName, actionText) => {
  const action = String(actionText || "").trim();
  const actionLower = action.toLowerCase();
  const amount = getActionAmount(action);

  if (!action || actionLower === "waiting" || actionLower === "winner") {
    return "";
  }
  if (/^sb\s+\d+/i.test(action) && amount) {
    return `${playerName} posts small blind ${amount} chips.`;
  }
  if (/^bb\s+\d+/i.test(action) && amount) {
    return `${playerName} posts big blind ${amount} chips.`;
  }
  if (/^fold$/i.test(action)) {
    return `${playerName} folds.`;
  }
  if (/^check$/i.test(action)) {
    return `${playerName} checks.`;
  }
  if (/^call\s+\d+/i.test(action) && amount) {
    return actionLower.includes("all-in")
      ? `${playerName} calls ${amount} chips, all in.`
      : `${playerName} calls ${amount} chips.`;
  }
  if (/^bet\s+\d+/i.test(action) && amount) {
    return `${playerName} bets ${amount} chips.`;
  }
  if (/^raise\s+\d+/i.test(action) && amount) {
    return `${playerName} raises ${amount} chips.`;
  }
  if (/^double\s+\d+/i.test(action) && amount) {
    return `${playerName} doubles down for ${amount} chips.`;
  }
  if (/^bust\s+\(\d+\)/i.test(action)) {
    return `${playerName} busts.`;
  }
  if (/^stand\s+\(\d+\)/i.test(action)) {
    return `${playerName} stands.`;
  }
  if (/\+\s*stand/i.test(action)) {
    const detail = action.match(/(call|bet|raise)\s+(\d+)/i);
    if (detail) {
      const verb = detail[1].toLowerCase() === "raise" ? "raises" : `${detail[1].toLowerCase()}s`;
      return `${playerName} ${verb} ${detail[2]} chips and stands.`;
    }
    return `${playerName} stands.`;
  }
  return `${playerName} ${action}.`;
};

export const buildWinnerVoiceLine = (state, winnerIds) => {
  if (!winnerIds.length) {
    return "No winner this hand.";
  }
  const winnerNames = state.players
    .filter((player) => winnerIds.includes(player.id))
    .map((player) => player.name.toUpperCase());
  if (winnerNames.length === 1) {
    return `${winnerNames[0]} wins the hand.`;
  }
  return `${winnerNames.join(" and ")} split the pot.`;
};

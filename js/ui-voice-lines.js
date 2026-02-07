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
    return `${playerName} posts small blind ${amount}.`;
  }
  if (/^bb\s+\d+/i.test(action) && amount) {
    return `${playerName} posts big blind ${amount}.`;
  }
  if (/^fold$/i.test(action)) {
    return `${playerName} folds.`;
  }
  if (/^check$/i.test(action)) {
    return `${playerName} checks.`;
  }
  if (/^call\s+\d+/i.test(action) && amount) {
    return actionLower.includes("all-in")
      ? `${playerName} calls ${amount}, all in.`
      : `${playerName} calls ${amount}.`;
  }
  if (/^bet\s+\d+/i.test(action) && amount) {
    return `${playerName} bets ${amount}.`;
  }
  if (/^raise\s+\d+/i.test(action) && amount) {
    return `${playerName} raises ${amount}.`;
  }
  if (/^double\s+\d+/i.test(action) && amount) {
    return `${playerName} doubles down for ${amount}.`;
  }
  if (/^bust\s+\(\d+\)/i.test(action) && amount) {
    return `${playerName} busts with ${amount}.`;
  }
  if (/^stand\s+\(\d+\)/i.test(action) && amount) {
    return `${playerName} stands on ${amount}.`;
  }
  if (/\+\s*stand/i.test(action)) {
    const detail = action.match(/(call|bet|raise)\s+(\d+)/i);
    if (detail) {
      const verb = detail[1].toLowerCase() === "raise" ? "raises" : `${detail[1].toLowerCase()}s`;
      return `${playerName} ${verb} ${detail[2]} and stands.`;
    }
    return `${playerName} stands.`;
  }
  return `${playerName} ${action}.`;
};

export const buildWinnerVoiceLine = (state, winnerIds) => {
  const finalists = state.players.filter((player) => !player.folded);
  const totalsSummary = finalists
    .map((player) => {
      if (player.total > 21) {
        return `${player.name} bust ${player.total}`;
      }
      return `${player.name} ${player.total}`;
    })
    .join(", ");

  if (!winnerIds.length) {
    return totalsSummary ? `No winner this hand. Totals: ${totalsSummary}.` : "No winner this hand.";
  }
  const winnerNames = finalists
    .filter((player) => winnerIds.includes(player.id))
    .map((player) => player.name.toUpperCase());
  if (winnerNames.length === 1) {
    return `${winnerNames[0]} wins. Totals: ${totalsSummary}.`;
  }
  return `${winnerNames.join(" and ")} split the pot. Totals: ${totalsSummary}.`;
};

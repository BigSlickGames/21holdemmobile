import { CARD_BACK_IMAGE, cardDisplayName } from "./cards.js";
import { BLIND_PRESETS, MIN_BUYIN_MULTIPLIER, STARTING_STACK } from "./rules.js";
import { tutorialModules, tutorialScreens } from "./tutorial-data.js";
import { createUiSpeechService } from "./ui-speech-service.js";
import { buildActionVoiceLine, buildWinnerVoiceLine } from "./ui-voice-lines.js";

const seatClassByPlayer = {
  0: "seat-bottom",
  1: "seat-top-left",
  2: "seat-top-right",
};

const actionLabel = {
  fold: "Fold",
  check: "Check",
  call: "Call",
  bet: "Bet",
  raise: "Raise",
  stand: "Stand",
  double: "Double Down",
};

const actionOrder = {
  check: 1,
  call: 1,
  bet: 2,
  raise: 2,
  stand: 3,
  double: 4,
  fold: 5,
};

const BOT_TURN_DELAY_MS = 3000;
const ACTION_LABEL_DURATION_MS = 3000;
const WINNER_REVEAL_DELAY_MS = 3000;
const MAX_SPEECH_QUEUE = 4;
const DEFAULT_SPEECH_TTL_MS = 4200;
const TURN_SPEECH_TTL_MS = 5000;

export const createAppUi = (engine) => {
  const splashScreen = document.querySelector("#splashScreen");
  const setupOverlay = document.querySelector("#setupOverlay");
  const appShell = document.querySelector(".app-shell");
  const playerNameInput = document.querySelector("#playerNameInput");
  const tableMenuGrid = document.querySelector("#tableMenuGrid");
  const selectedTableInfo = document.querySelector("#selectedTableInfo");
  const startingStackValue = document.querySelector("#startingStackValue");

  const menuToggle = document.querySelector("#menuToggle");
  const closeMenu = document.querySelector("#closeMenu");
  const menuDrawer = document.querySelector("#menuDrawer");
  const menuTabs = document.querySelectorAll(".menu-tab");
  const menuPanels = document.querySelectorAll(".menu-panel");

  const tutorialModuleTabs = document.querySelector("#tutorialModuleTabs");
  const tutorialMeta = document.querySelector("#tutorialMeta");
  const tutorialTitle = document.querySelector("#tutorialTitle");
  const tutorialBody = document.querySelector("#tutorialBody");
  const tutorialBullets = document.querySelector("#tutorialBullets");
  const tutorialPrev = document.querySelector("#tutorialPrev");
  const tutorialNext = document.querySelector("#tutorialNext");
  const tutorialCounter = document.querySelector("#tutorialCounter");

  const newHandButton = document.querySelector("#newHandButton");
  const tableTitle = document.querySelector("#tableTitle");
  const roundBadge = document.querySelector("#roundBadge");
  const potBadge = document.querySelector("#potBadge");
  const betBadge = document.querySelector("#betBadge");
  const tableFelt = document.querySelector(".table-felt");
  const communityCards = document.querySelector("#communityCards");
  const chipLayer = document.querySelector("#chipLayer");
  const playerLayer = document.querySelector("#playerLayer");
  const turnPrompt = document.querySelector("#turnPrompt");
  const actionButtons = document.querySelector("#actionButtons");
  const wagerTray = document.querySelector("#wagerTray");
  const logList = document.querySelector("#logList");
  const winnerBanner = document.querySelector("#winnerBanner");

  let activeMenuPanel = "overview";
  let activeTutorialModule = tutorialModules[0].id;
  let tutorialCursor = 0;
  let pendingWagerAction = null;
  let pendingDecision = null;
  let selectedTablePreset = BLIND_PRESETS[0];
  let botTimer = null;
  let gameStarted = false;
  const actionLabelTimers = new Map();
  const visibleActionLabels = new Map();
  const lastKnownActions = new Map();
  let winnerRevealTimer = null;
  let winnerRevealReady = false;
  let winnerRevealHandNumber = null;
  let winnerIds = [];
  let winnerAnnouncement = "";
  let lastRenderedHandNumber = null;
  let lastRenderedPot = 0;
  let lastPayoutAnimationHand = null;
  let drainedPotHandNumber = null;
  let lastSpokenWinnerHand = null;
  let lastSpokenRoundKey = "";
  let lastSpokenTurnKey = "";
  const speechService = createUiSpeechService({
    defaultTtlMs: DEFAULT_SPEECH_TTL_MS,
    maxQueue: MAX_SPEECH_QUEUE,
  });

  const getTutorialSlides = () =>
    tutorialScreens.filter((screen) => screen.module === activeTutorialModule);

  const setMenuPanel = (panelId) => {
    activeMenuPanel = panelId;
    menuTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.panel === panelId);
    });
    menuPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panelContent === panelId);
    });
  };

  const clearPendingFlow = () => {
    pendingWagerAction = null;
    pendingDecision = null;
  };

  const queueSpeechLine = (line, options = {}) => {
    speechService.queueLine(line, options);
  };

  const clearSpeechQueue = () => {
    speechService.clearQueue();
  };

  const getActionVoiceLine = (playerName, actionText) => buildActionVoiceLine(playerName, actionText);

  const getWinnerVoiceLine = (state) => buildWinnerVoiceLine(state, winnerIds);

  const clearChipLayer = () => {
    if (!chipLayer) {
      return;
    }
    chipLayer.innerHTML = "";
  };

  const ensurePotChipStack = () => {
    if (!chipLayer) {
      return null;
    }
    let stack = chipLayer.querySelector(".pot-chip-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "pot-chip-stack";
      chipLayer.appendChild(stack);
    }
    return stack;
  };

  const renderPotChipStack = (potAmount) => {
    if (!chipLayer) {
      return;
    }
    const stack = ensurePotChipStack();
    if (!stack) {
      return;
    }
    const potPoint = getPotPoint();
    if (potPoint) {
      stack.style.left = `${potPoint.x}px`;
      stack.style.top = `${potPoint.y}px`;
    }
    const count = Math.max(0, Math.min(26, Math.round(Math.sqrt(Math.max(0, potAmount)))));
    stack.classList.toggle("active", count > 0);
    if (count === 0) {
      stack.innerHTML = "";
      return;
    }
    if (stack.childElementCount === count) {
      return;
    }
    stack.innerHTML = "";
    for (let index = 0; index < count; index += 1) {
      const chip = document.createElement("span");
      chip.className = "pot-chip";
      chip.style.setProperty("--stack-x", `${(index % 6) * 4 - 10}px`);
      chip.style.setProperty("--stack-y", `${Math.floor(index / 6) * -3}px`);
      chip.style.setProperty("--stack-r", `${(index % 5) * 3 - 6}deg`);
      stack.appendChild(chip);
    }
  };

  const getPointOnChipLayer = (element) => {
    if (!chipLayer || !element) {
      return null;
    }
    const layerRect = chipLayer.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - layerRect.left,
      y: rect.top + rect.height / 2 - layerRect.top,
    };
  };

  const getSeatPoint = (playerId) => {
    if (!chipLayer || !playerLayer) {
      return null;
    }
    const seat = playerLayer.querySelector(`.${seatClassByPlayer[playerId]}`);
    if (!seat) {
      return null;
    }
    const shell = seat.querySelector(".profile-shell") || seat;
    return getPointOnChipLayer(shell);
  };

  const getPotPoint = () => {
    if (!chipLayer) {
      return null;
    }
    if (tableFelt) {
      return getPointOnChipLayer(tableFelt);
    }
    return {
      x: chipLayer.clientWidth / 2,
      y: chipLayer.clientHeight / 2,
    };
  };

  const getChipCountForAmount = (amount) => {
    const safeAmount = Math.max(1, Number(amount) || 1);
    return Math.max(3, Math.min(14, Math.round(Math.sqrt(safeAmount))));
  };

  const spawnChipBurst = (fromPoint, toPoint, amount, variant = "to-pot") => {
    if (!chipLayer || !fromPoint || !toPoint || amount <= 0) {
      return;
    }
    const chipCount = getChipCountForAmount(amount);
    for (let index = 0; index < chipCount; index += 1) {
      const chip = document.createElement("span");
      chip.className = `chip-token ${variant === "to-winner" ? "to-winner" : "to-pot"}`;
      const jitterX = (Math.random() - 0.5) * 18;
      const jitterY = (Math.random() - 0.5) * 12;
      const deltaX = toPoint.x - fromPoint.x + jitterX;
      const deltaY = toPoint.y - fromPoint.y + jitterY;
      chip.style.left = `${fromPoint.x}px`;
      chip.style.top = `${fromPoint.y}px`;
      chip.style.setProperty("--chip-dx", `${deltaX}px`);
      chip.style.setProperty("--chip-dy", `${deltaY}px`);
      chip.style.setProperty("--chip-dx-half", `${deltaX * 0.56}px`);
      chip.style.setProperty("--chip-dy-half", `${deltaY * 0.56}px`);
      chip.style.animationDelay = `${index * 44}ms`;
      chip.style.animationDuration = variant === "to-winner" ? "760ms" : "560ms";
      chip.addEventListener("animationend", () => {
        chip.remove();
      });
      chipLayer.appendChild(chip);
    }
  };

  const getContributionFromAction = (actionText) => {
    const match = String(actionText || "").match(/(?:SB|BB|Call|Bet|Raise|Double)\s+(\d+)/i);
    return match ? Math.max(0, Number(match[1]) || 0) : 0;
  };

  const animatePotIncreaseFromChanges = (changes, potDelta) => {
    if (!chipLayer || !changes.length || potDelta <= 0) {
      return;
    }
    const potPoint = getPotPoint();
    if (!potPoint) {
      return;
    }

    const contributors = changes
      .map((change) => ({
        playerId: change.player.id,
        amount: getContributionFromAction(change.action),
      }))
      .filter((entry) => entry.amount > 0);

    if (!contributors.length) {
      const fallback = changes[0];
      if (!fallback) {
        return;
      }
      const seatPoint = getSeatPoint(fallback.player.id);
      if (seatPoint) {
        spawnChipBurst(seatPoint, potPoint, potDelta, "to-pot");
      }
      return;
    }

    const knownTotal = contributors.reduce((sum, entry) => sum + entry.amount, 0);
    let remaining = Math.max(0, potDelta - knownTotal);
    contributors.forEach((entry, index) => {
      const seatPoint = getSeatPoint(entry.playerId);
      if (!seatPoint) {
        return;
      }
      const extra = remaining > 0 && index === 0 ? remaining : 0;
      remaining -= extra;
      spawnChipBurst(seatPoint, potPoint, entry.amount + extra, "to-pot");
    });
  };

  const animatePotToWinners = (state) => {
    if (!chipLayer || !winnerIds.length || state.pot <= 0) {
      return;
    }
    const potPoint = getPotPoint();
    if (!potPoint) {
      return;
    }
    const payoutEach = Math.max(1, Math.floor(state.pot / winnerIds.length));
    winnerIds.forEach((playerId, index) => {
      const seatPoint = getSeatPoint(playerId);
      if (!seatPoint) {
        return;
      }
      window.setTimeout(() => {
        spawnChipBurst(potPoint, seatPoint, payoutEach, "to-winner");
      }, index * 150);
    });
    drainedPotHandNumber = state.handNumber;
  };

  const clearWinnerReveal = () => {
    if (winnerRevealTimer) {
      window.clearTimeout(winnerRevealTimer);
      winnerRevealTimer = null;
    }
    winnerRevealReady = false;
    winnerRevealHandNumber = null;
    winnerIds = [];
    winnerAnnouncement = "";
    lastSpokenWinnerHand = null;
    lastPayoutAnimationHand = null;
    drainedPotHandNumber = null;
  };

  const startGameFromSetup = () => {
    clearPendingFlow();
    clearWinnerReveal();
    clearSpeechQueue();
    lastSpokenRoundKey = "";
    clearChipLayer();
    lastRenderedPot = 0;
    drainedPotHandNumber = null;
    lastSpokenTurnKey = "";
    engine.setPlayerName(playerNameInput?.value || "PLAYER");
    engine.setBlindStructure(selectedTablePreset.smallBlind, selectedTablePreset.bigBlind);
    engine.startNewHand();
    setupOverlay?.classList.add("hidden");
    appShell?.classList.remove("prestart");
    gameStarted = true;
    render();
  };

  const renderTableMenu = () => {
    if (!tableMenuGrid) {
      return;
    }
    tableMenuGrid.innerHTML = "";

    BLIND_PRESETS.forEach((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "table-menu-card";
      button.classList.toggle("active", preset.id === selectedTablePreset.id);
      button.innerHTML = `
        <img src="assets/images/table.png" alt="${preset.label} blind table" />
        <span class="table-selected-badge">${
          preset.id === selectedTablePreset.id ? "Selected" : "Select"
        }</span>
        <div class="table-menu-meta">
          <strong>${preset.label}</strong>
          <span>Min buy-in ${preset.bigBlind * MIN_BUYIN_MULTIPLIER}</span>
        </div>
      `;
      button.addEventListener("click", () => {
        selectedTablePreset = preset;
        startGameFromSetup();
      });
      tableMenuGrid.appendChild(button);
    });

    if (selectedTableInfo) {
      selectedTableInfo.textContent = `Selected table: ${selectedTablePreset.label} | Min buy-in ${
        selectedTablePreset.bigBlind * MIN_BUYIN_MULTIPLIER
      }`;
    }
  };

  const renderTutorialTabs = () => {
    tutorialModuleTabs.innerHTML = "";
    tutorialModules.forEach((module) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tutorial-module-tab";
      button.textContent = module.label;
      button.classList.toggle("active", module.id === activeTutorialModule);
      button.addEventListener("click", () => {
        activeTutorialModule = module.id;
        tutorialCursor = 0;
        renderTutorial();
      });
      tutorialModuleTabs.appendChild(button);
    });
  };

  const renderTutorial = () => {
    renderTutorialTabs();
    const slides = getTutorialSlides();
    const safeIndex = Math.min(Math.max(tutorialCursor, 0), slides.length - 1);
    tutorialCursor = safeIndex;
    const slide = slides[safeIndex];

    if (!slide) {
      tutorialMeta.textContent = "";
      tutorialTitle.textContent = "No tutorial content";
      tutorialBody.innerHTML = "";
      tutorialBullets.innerHTML = "";
      tutorialCounter.textContent = "";
      return;
    }

    const moduleLabel =
      tutorialModules.find((module) => module.id === slide.module)?.label || "Tutorial";

    tutorialMeta.textContent = moduleLabel;
    tutorialTitle.textContent = slide.title;
    tutorialBody.innerHTML = (slide.paragraphs || []).map((text) => `<p>${text}</p>`).join("");
    tutorialBullets.innerHTML = (slide.bullets || []).map((item) => `<li>${item}</li>`).join("");
    tutorialCounter.textContent = `${safeIndex + 1}/${slides.length}`;
    tutorialPrev.disabled = safeIndex <= 0;
    tutorialNext.disabled = safeIndex >= slides.length - 1;
  };

  const createCardNode = (card, hidden = false) => {
    const cardWrap = document.createElement("div");
    cardWrap.className = "card-tile";
    if (hidden) {
      cardWrap.classList.add("hidden-card");
    }

    const img = document.createElement("img");
    img.src = hidden ? CARD_BACK_IMAGE : card?.image || CARD_BACK_IMAGE;
    img.alt = hidden ? "Hidden card" : card ? cardDisplayName(card) : "Card back";
    img.loading = "lazy";
    img.decoding = "async";
    cardWrap.appendChild(img);

    return cardWrap;
  };

  const createProfileCardImage = (card, hidden = false) => {
    const img = document.createElement("img");
    img.className = "profile-card-image";
    if (hidden) {
      img.classList.add("hidden-profile-card");
    }
    img.src = hidden ? CARD_BACK_IMAGE : card?.image || CARD_BACK_IMAGE;
    img.alt = hidden ? "Hidden card" : card ? cardDisplayName(card) : "Card back";
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  };

  const getActionBannerText = (lastAction) => {
    if (!lastAction || lastAction === "Waiting") {
      return null;
    }
    const normalized = String(lastAction).toLowerCase();
    if (normalized.includes("+ stand") || normalized.includes("stand")) {
      return "STAND";
    }
    if (normalized.includes("raise")) {
      return "RAISE";
    }
    if (normalized.includes("bet")) {
      return "BET";
    }
    if (normalized.includes("call")) {
      return "CALL";
    }
    if (normalized.includes("check")) {
      return "CHECK";
    }
    if (normalized.includes("fold")) {
      return "FOLD";
    }
    if (normalized.includes("double")) {
      return "DOUBLE";
    }
    if (normalized.includes("bust")) {
      return "BUST";
    }
    if (normalized.includes("winner")) {
      return "WIN";
    }
    const token = String(lastAction).trim().split(" ")[0];
    return token ? token.toUpperCase() : null;
  };

  const queueActionBanner = (playerId, lastAction) => {
    const label = getActionBannerText(lastAction);
    if (!label) {
      return;
    }
    visibleActionLabels.set(playerId, label);
    const priorTimer = actionLabelTimers.get(playerId);
    if (priorTimer) {
      window.clearTimeout(priorTimer);
    }
    const timer = window.setTimeout(() => {
      visibleActionLabels.delete(playerId);
      actionLabelTimers.delete(playerId);
      render();
    }, ACTION_LABEL_DURATION_MS);
    actionLabelTimers.set(playerId, timer);
  };

  const buildWinnerAnnouncement = (state) => {
    winnerIds = state.players
      .filter((player) => player.lastAction === "Winner")
      .map((player) => player.id);

    if (winnerIds.length === 0) {
      winnerAnnouncement = "No Winner";
      return;
    }

    const winnerNames = state.players
      .filter((player) => winnerIds.includes(player.id))
      .map((player) => player.name.toUpperCase());

    winnerAnnouncement =
      winnerNames.length === 1 ? `${winnerNames[0]} WINS` : `${winnerNames.join(" & ")} SPLIT POT`;
  };

  const syncWinnerRevealState = (state) => {
    if (!state.handComplete) {
      clearWinnerReveal();
      return;
    }

    if (winnerRevealHandNumber === state.handNumber) {
      return;
    }

    winnerRevealHandNumber = state.handNumber;
    winnerRevealReady = false;
    buildWinnerAnnouncement(state);

    if (winnerRevealTimer) {
      window.clearTimeout(winnerRevealTimer);
    }
    winnerRevealTimer = window.setTimeout(() => {
      winnerRevealTimer = null;
      winnerRevealReady = true;
      render();
    }, WINNER_REVEAL_DELAY_MS);
  };

  const renderWinnerBanner = (state) => {
    if (!winnerBanner) {
      return;
    }

    winnerBanner.className = "winner-banner";
    winnerBanner.textContent = "";

    if (!state.handComplete || !winnerRevealReady) {
      return;
    }

    winnerBanner.textContent = winnerAnnouncement || state.handResult || "Hand Complete";
    winnerBanner.classList.add("show");
    if (winnerIds.length > 1) {
      winnerBanner.classList.add("split");
    }
    if (winnerIds.length === 0) {
      winnerBanner.classList.add("no-winner");
    }

    if (lastSpokenWinnerHand !== state.handNumber) {
      lastSpokenWinnerHand = state.handNumber;
      queueSpeechLine(getWinnerVoiceLine(state), {
        priority: true,
        replaceQueue: true,
        interrupt: true,
        ttlMs: 0,
      });
    }
  };

  const renderCommunity = (state) => {
    communityCards.innerHTML = "";
    for (let index = 0; index < 4; index += 1) {
      const card = state.community[index];
      const node = createCardNode(card, !card);
      communityCards.appendChild(node);
    }
  };

  const getPrimaryRoleBadge = (state, player) => {
    if (state.bigBlindIndex === player.id) {
      return "BB";
    }
    if (state.smallBlindIndex === player.id) {
      return "SB";
    }
    if (state.dealerIndex === player.id) {
      return "D";
    }
    return "P";
  };

  const getTotalBubbleValue = (state, player) => {
    if (!player.isHuman && !state.handComplete) {
      return "";
    }
    if (player.folded) {
      return "--";
    }
    if (player.busted) {
      return "B";
    }
    return String(player.total);
  };

  const renderPlayers = (state) => {
    playerLayer.innerHTML = "";
    const changes = [];

    state.players.forEach((player) => {
      const knownAction = lastKnownActions.get(player.id);
      if (player.lastAction !== knownAction) {
        lastKnownActions.set(player.id, player.lastAction);
        changes.push({ player, action: player.lastAction, previous: knownAction || "" });
        if (gameStarted) {
          queueActionBanner(player.id, player.lastAction);
        }
      }

      const seat = document.createElement("article");
      seat.className = `player-seat ${seatClassByPlayer[player.id]}`;

      if (player.folded) {
        seat.classList.add("is-folded");
      }
      if (player.busted) {
        seat.classList.add("is-busted");
      }
      if (!state.handComplete && state.currentTurnIndex === player.id) {
        seat.classList.add("is-turn");
      }
      if (winnerRevealReady && winnerIds.includes(player.id)) {
        seat.classList.add("is-winner");
      } else if (winnerRevealReady && winnerIds.length > 0) {
        seat.classList.add("is-faded");
      }

      const shell = document.createElement("div");
      shell.className = "profile-shell";

      const headerBand = document.createElement("div");
      headerBand.className = "profile-header-band";
      headerBand.innerHTML = `<strong>${player.name.toUpperCase()}</strong>`;

      const roleBadge = document.createElement("div");
      roleBadge.className = "profile-role-badge";
      roleBadge.textContent = getPrimaryRoleBadge(state, player);

      const body = document.createElement("div");
      body.className = "profile-body";

      const cards = document.createElement("div");
      cards.className = "seat-cards";
      cards.classList.toggle("single-card", player.hand.length <= 1);
      const revealCards = player.isHuman || state.handComplete;
      player.hand.forEach((card) => {
        cards.appendChild(createProfileCardImage(card, !revealCards));
      });
      if (player.hand.length === 0) {
        cards.appendChild(createProfileCardImage(null, true));
      }

      body.appendChild(cards);

      const totalBadge = document.createElement("div");
      totalBadge.className = "profile-total-badge";
      totalBadge.textContent = getTotalBubbleValue(state, player);
      totalBadge.classList.toggle("is-hidden-total", totalBadge.textContent === "");

      const seatBottom = document.createElement("div");
      seatBottom.className = "profile-footer";
      seatBottom.innerHTML = `<span>${player.chips} chips</span>`;

      const actionBannerText = visibleActionLabels.get(player.id);
      shell.appendChild(headerBand);
      shell.appendChild(roleBadge);
      shell.appendChild(body);
      shell.appendChild(totalBadge);
      seat.appendChild(shell);
      seat.appendChild(seatBottom);
      if (actionBannerText) {
        const actionBanner = document.createElement("div");
        actionBanner.className = "profile-action-label show";
        actionBanner.textContent = actionBannerText;
        seat.appendChild(actionBanner);
      }
      playerLayer.appendChild(seat);
    });
    return changes;
  };

  const buildActionSpeechLines = (changes) => {
    if (!gameStarted || !changes.length) {
      return [];
    }
    return changes
      .map((change) => getActionVoiceLine(change.player.name, change.action))
      .filter(Boolean)
      .slice(-2);
  };

  const queueActionSpeechLines = (lines) => {
    if (!lines.length) {
      return;
    }
    lines.forEach((line, index) => {
      queueSpeechLine(line, {
        replaceQueue: index === 0,
        ttlMs: DEFAULT_SPEECH_TTL_MS,
      });
    });
  };

  const createActionButton = (label, onClick, className = "", disabled = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-btn ${className}`.trim();
    button.textContent = label;
    button.disabled = disabled;
    if (!disabled) {
      button.addEventListener("click", onClick);
    }
    return button;
  };

  const runPendingDecision = (standAfter = false) => {
    if (!pendingDecision) {
      return;
    }
    const payload = {};
    if (typeof pendingDecision.amount === "number") {
      payload.amount = pendingDecision.amount;
    }
    if (standAfter) {
      payload.standAfter = true;
    }
    engine.performHumanAction(pendingDecision.action, payload);
    clearPendingFlow();
    render();
  };

  const renderPendingDecision = (state, player) => {
    if (!pendingDecision) {
      return false;
    }

    actionButtons.innerHTML = "";
    wagerTray.innerHTML = "";
    const toCall = Math.max(0, state.currentBet - player.roundBet);
    const canStandAfter =
      !player.standing &&
      !player.responseOnly &&
      state.roundIndex < 4 &&
      ["call", "bet", "raise"].includes(pendingDecision.action);

    const decisionText =
      pendingDecision.action === "call"
        ? `Call ${toCall} and choose how to proceed.`
        : pendingDecision.action === "bet"
          ? `Bet ${pendingDecision.cost} and choose how to proceed.`
          : `Raise (total ${pendingDecision.cost}) and choose how to proceed.`;

    const title = document.createElement("p");
    title.className = "wager-title";
    title.textContent = decisionText;
    wagerTray.appendChild(title);

    actionButtons.appendChild(
      createActionButton("Confirm", () => {
        runPendingDecision(false);
      }, "primary")
    );

    actionButtons.appendChild(
      createActionButton(
        "Stand",
        () => {
          runPendingDecision(true);
        },
        "",
        !canStandAfter
      )
    );

    actionButtons.appendChild(
      createActionButton("Cancel", () => {
        clearPendingFlow();
        render();
      }, "ghost")
    );

    return true;
  };

  const renderWagerOptions = (player) => {
    actionButtons.innerHTML = "";
    wagerTray.innerHTML = "";
    if (!pendingWagerAction || pendingDecision) {
      return;
    }

    const options = engine.getWagerOptions(pendingWagerAction, player);
    if (options.length === 0) {
      clearPendingFlow();
      return;
    }

    const title = document.createElement("p");
    title.className = "wager-title";
    title.textContent =
      pendingWagerAction === "bet" ? "Choose bet amount:" : "Choose raise amount:";
    wagerTray.appendChild(title);

    options.forEach((option) => {
      const button = createActionButton(`${option.label} (${option.cost})`, () => {
        pendingDecision = {
          action: pendingWagerAction,
          amount: option.amount,
          cost: option.cost,
        };
        pendingWagerAction = null;
        render();
      });
      actionButtons.appendChild(button);
    });

    actionButtons.appendChild(
      createActionButton("Cancel", () => {
        clearPendingFlow();
        render();
      }, "ghost")
    );
  };

  const renderStatusAndActions = (state) => {
    actionButtons.innerHTML = "";
    wagerTray.innerHTML = "";

    if (state.handComplete) {
      clearPendingFlow();
      turnPrompt.textContent = `${state.handResult} Press "Deal Next Hand" to continue.`;
      return;
    }

    const currentPlayer = state.players[state.currentTurnIndex];
    if (!currentPlayer) {
      clearPendingFlow();
      turnPrompt.textContent = "Resolving hand state...";
      return;
    }

    if (!currentPlayer.isHuman) {
      clearPendingFlow();
      turnPrompt.textContent = `${currentPlayer.name} is thinking...`;
      return;
    }

    const actions = engine.getAvailableActions();
    if (pendingDecision && !actions.includes(pendingDecision.action)) {
      pendingDecision = null;
    }
    if (pendingWagerAction && !actions.includes(pendingWagerAction)) {
      pendingWagerAction = null;
    }

    if (pendingDecision) {
      turnPrompt.textContent = "Confirm your action: Confirm, Stand, or Cancel.";
      renderPendingDecision(state, currentPlayer);
      return;
    } else if (pendingWagerAction) {
      turnPrompt.textContent = "Pick a wager size to continue.";
      renderWagerOptions(currentPlayer);
      return;
    } else {
      turnPrompt.textContent = `Your turn in ${state.roundName}. Blinds ${state.smallBlindAmount}/${state.bigBlindAmount}. Pot ${state.pot}.`;
    }

    const orderedActions = [...actions].sort((left, right) => {
      const leftRank = actionOrder[left] || 99;
      const rightRank = actionOrder[right] || 99;
      return leftRank - rightRank;
    });

    orderedActions.forEach((action) => {
      if (action === "bet" || action === "raise") {
        actionButtons.appendChild(
          createActionButton(actionLabel[action], () => {
            pendingWagerAction = action;
            pendingDecision = null;
            render();
          })
        );
        return;
      }

      if (action === "call") {
        const toCall = Math.max(0, state.currentBet - currentPlayer.roundBet);
        actionButtons.appendChild(
          createActionButton(actionLabel[action], () => {
            pendingDecision = { action: "call", cost: toCall };
            pendingWagerAction = null;
            render();
          })
        );
        return;
      }

      actionButtons.appendChild(
        createActionButton(actionLabel[action], () => {
          clearPendingFlow();
          engine.performHumanAction(action);
          render();
        })
      );
    });
  };

  const renderLog = (state) => {
    logList.innerHTML = "";
    state.log.forEach((line) => {
      const entry = document.createElement("li");
      entry.textContent = line;
      logList.appendChild(entry);
    });
  };

  const render = () => {
    const state = engine.getVisibleState();
    syncWinnerRevealState(state);

    if (lastRenderedHandNumber !== state.handNumber) {
      lastRenderedHandNumber = state.handNumber;
      lastKnownActions.clear();
      lastSpokenRoundKey = "";
      lastSpokenTurnKey = "";
      lastRenderedPot = 0;
      lastPayoutAnimationHand = null;
      drainedPotHandNumber = null;
      clearChipLayer();
    }

    if (gameStarted) {
      const roundKey = `${state.handNumber}-${state.roundIndex}`;
      if (lastSpokenRoundKey !== roundKey) {
        lastSpokenRoundKey = roundKey;
      }
    }

    if (tableTitle) {
      tableTitle.textContent = `21 HOLD'EM ${state.smallBlindAmount}/${state.bigBlindAmount}`;
    }
    roundBadge.textContent = `Round ${state.roundName}`;
    potBadge.textContent = `Pot ${state.pot}`;
    betBadge.textContent = `Blinds ${state.smallBlindAmount}/${state.bigBlindAmount}`;

    const potDelta = Math.max(0, state.pot - lastRenderedPot);

    renderCommunity(state);
    const actionChanges = renderPlayers(state);
    const actionSpeechLines = buildActionSpeechLines(actionChanges);
    queueActionSpeechLines(actionSpeechLines);
    renderPotChipStack(drainedPotHandNumber === state.handNumber ? 0 : state.pot);
    renderWinnerBanner(state);
    renderStatusAndActions(state);
    renderLog(state);
    renderTutorial();

    if (gameStarted && !state.handComplete && typeof state.currentTurnIndex === "number") {
      const currentTurnPlayer = state.players[state.currentTurnIndex];
      const turnKey = `${state.handNumber}-${state.roundIndex}-${state.currentTurnIndex}`;
      if (currentTurnPlayer && lastSpokenTurnKey !== turnKey) {
        lastSpokenTurnKey = turnKey;
        if (currentTurnPlayer.isHuman) {
          queueSpeechLine("Your turn.", {
            ttlMs: TURN_SPEECH_TTL_MS,
          });
        } else {
          queueSpeechLine(`${currentTurnPlayer.name} to act.`, {
            ttlMs: TURN_SPEECH_TTL_MS,
          });
        }
      }
    }

    if (gameStarted && !state.handComplete && potDelta > 0) {
      animatePotIncreaseFromChanges(actionChanges, potDelta);
    }
    if (
      gameStarted &&
      state.handComplete &&
      winnerRevealReady &&
      state.pot > 0 &&
      lastPayoutAnimationHand !== state.handNumber
    ) {
      lastPayoutAnimationHand = state.handNumber;
      animatePotToWinners(state);
    }
    lastRenderedPot = state.pot;

    if (botTimer) {
      window.clearTimeout(botTimer);
      botTimer = null;
    }

    const currentPlayer = state.players[state.currentTurnIndex];
    if (gameStarted && !state.handComplete && currentPlayer && !currentPlayer.isHuman) {
      botTimer = window.setTimeout(() => {
        engine.playBotTurn();
        render();
      }, BOT_TURN_DELAY_MS);
    }
  };

  menuToggle.addEventListener("click", () => {
    menuDrawer.classList.toggle("open");
  });

  closeMenu.addEventListener("click", () => {
    menuDrawer.classList.remove("open");
  });

  menuTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setMenuPanel(tab.dataset.panel);
    });
  });

  tutorialPrev.addEventListener("click", () => {
    tutorialCursor = Math.max(0, tutorialCursor - 1);
    renderTutorial();
  });

  tutorialNext.addEventListener("click", () => {
    const slides = getTutorialSlides();
    tutorialCursor = Math.min(slides.length - 1, tutorialCursor + 1);
    renderTutorial();
  });

  newHandButton.addEventListener("click", () => {
    clearPendingFlow();
    clearSpeechQueue();
    lastSpokenRoundKey = "";
    lastSpokenTurnKey = "";
    clearChipLayer();
    lastRenderedPot = 0;
    lastPayoutAnimationHand = null;
    drainedPotHandNumber = null;
    engine.startNewHand();
    render();
  });

  const beginSplashSequence = () => {
    if (!splashScreen) {
      setupOverlay.classList.remove("hidden");
      return;
    }
    splashScreen.classList.add("active");
    window.setTimeout(() => {
      splashScreen.classList.add("fade-out");
      window.setTimeout(() => {
        splashScreen.classList.add("hidden");
        setupOverlay.classList.remove("hidden");
      }, 700);
    }, 3000);
  };

  if (startingStackValue) {
    startingStackValue.textContent = String(STARTING_STACK);
  }
  speechService.initialize();
  renderTableMenu();
  setMenuPanel(activeMenuPanel);
  renderTutorial();
  beginSplashSequence();
  render();
};

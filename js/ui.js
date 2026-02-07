import { CARD_BACK_IMAGE, cardDisplayName } from "./cards.js";
import { tutorialModules, tutorialScreens } from "./tutorial-data.js";

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

export const createAppUi = (engine) => {
  const lobbyOverlay = document.querySelector("#lobbyOverlay");
  const startGameButton = document.querySelector("#startGameButton");
  const tableSizeButtons = document.querySelectorAll(".table-size-btn");

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
  const roundBadge = document.querySelector("#roundBadge");
  const potBadge = document.querySelector("#potBadge");
  const betBadge = document.querySelector("#betBadge");
  const communityCards = document.querySelector("#communityCards");
  const playerLayer = document.querySelector("#playerLayer");
  const turnPrompt = document.querySelector("#turnPrompt");
  const actionButtons = document.querySelector("#actionButtons");
  const wagerTray = document.querySelector("#wagerTray");
  const logList = document.querySelector("#logList");

  let activeMenuPanel = "overview";
  let activeTutorialModule = tutorialModules[0].id;
  let tutorialCursor = 0;
  let pendingWagerAction = null;
  let pendingDecision = null;
  let selectedTableSize =
    Array.from(tableSizeButtons).find((button) => button.classList.contains("active"))?.dataset
      .size || "standard";
  let botTimer = null;

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

  const applyTableSize = (size) => {
    selectedTableSize = size;
    document.body.dataset.tableSize = size;
    tableSizeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.size === size);
    });
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

  const renderCommunity = (state) => {
    communityCards.innerHTML = "";
    for (let index = 0; index < 4; index += 1) {
      const card = state.community[index];
      const node = createCardNode(card, !card);
      communityCards.appendChild(node);
    }
  };

  const playerBadges = (state, player) => {
    const badges = [];
    if (state.dealerIndex === player.id) {
      badges.push("D");
    }
    if (state.smallBlindIndex === player.id) {
      badges.push("SB");
    }
    if (state.bigBlindIndex === player.id) {
      badges.push("BB");
    }
    if (player.standing) {
      badges.push("Stand");
    }
    if (player.doubleDown) {
      badges.push("DD");
    }
    return badges;
  };

  const playerTotalLabel = (state, player) => {
    if (player.folded) {
      return "Folded";
    }
    if (player.busted) {
      return `Bust (${player.total})`;
    }
    if (player.isHuman || state.handComplete) {
      return `Total ${player.total}`;
    }
    if (player.standing) {
      return "Standing";
    }
    return "Total hidden";
  };

  const renderPlayers = (state) => {
    playerLayer.innerHTML = "";

    state.players.forEach((player) => {
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

      const seatTop = document.createElement("div");
      seatTop.className = "seat-top";
      seatTop.innerHTML = `
        <strong>${player.name}</strong>
        <span>${player.chips} chips</span>
      `;

      const badgeRow = document.createElement("div");
      badgeRow.className = "seat-badges";
      playerBadges(state, player).forEach((badgeText) => {
        const badge = document.createElement("span");
        badge.className = "chip-badge";
        badge.textContent = badgeText;
        badgeRow.appendChild(badge);
      });

      const cards = document.createElement("div");
      cards.className = "seat-cards";
      const revealCards = player.isHuman || state.handComplete;
      player.hand.forEach((card) => {
        cards.appendChild(createCardNode(card, !revealCards));
      });

      const seatBottom = document.createElement("div");
      seatBottom.className = "seat-bottom-row";
      seatBottom.innerHTML = `
        <span>${playerTotalLabel(state, player)}</span>
        <span>${player.lastAction}</span>
      `;

      seat.appendChild(seatTop);
      seat.appendChild(badgeRow);
      seat.appendChild(cards);
      seat.appendChild(seatBottom);
      playerLayer.appendChild(seat);
    });
  };

  const createActionButton = (label, onClick, className = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `action-btn ${className}`.trim();
    button.textContent = label;
    button.addEventListener("click", onClick);
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

    wagerTray.innerHTML = "";
    const toCall = Math.max(0, state.currentBet - player.roundBet);
    const canStandAfter =
      !player.standing &&
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

    const row = document.createElement("div");
    row.className = "decision-buttons";

    row.appendChild(
      createActionButton("Confirm", () => {
        runPendingDecision(false);
      }, "primary")
    );

    const standButton = createActionButton("Stand", () => {
      runPendingDecision(true);
    });
    standButton.disabled = !canStandAfter;
    if (!canStandAfter) {
      standButton.title = "Stand is not available in this spot.";
    }
    row.appendChild(standButton);

    row.appendChild(
      createActionButton("Cancel", () => {
        clearPendingFlow();
        render();
      }, "ghost")
    );

    wagerTray.appendChild(row);
    return true;
  };

  const renderWagerOptions = (player) => {
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

    const row = document.createElement("div");
    row.className = "wager-buttons";
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
      row.appendChild(button);
    });
    wagerTray.appendChild(row);

    wagerTray.appendChild(
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
    } else if (pendingWagerAction) {
      turnPrompt.textContent = "Pick a wager size to continue.";
    } else {
      turnPrompt.textContent = `Your turn in ${state.roundName}. Pot: ${state.pot}.`;
    }

    actions.forEach((action) => {
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

    if (!renderPendingDecision(state, currentPlayer)) {
      renderWagerOptions(currentPlayer);
    }
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

    roundBadge.textContent = `Round ${state.roundName}`;
    potBadge.textContent = `Pot ${state.pot}`;
    betBadge.textContent = `To Call ${state.currentBet}`;

    renderCommunity(state);
    renderPlayers(state);
    renderStatusAndActions(state);
    renderLog(state);
    renderTutorial();

    if (botTimer) {
      window.clearTimeout(botTimer);
      botTimer = null;
    }

    const currentPlayer = state.players[state.currentTurnIndex];
    if (!state.handComplete && currentPlayer && !currentPlayer.isHuman) {
      botTimer = window.setTimeout(() => {
        engine.playBotTurn();
        render();
      }, 720);
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
    engine.startNewHand();
    render();
  });

  tableSizeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyTableSize(button.dataset.size);
    });
  });

  startGameButton.addEventListener("click", () => {
    lobbyOverlay.classList.add("hidden");
  });

  applyTableSize(selectedTableSize);
  setMenuPanel(activeMenuPanel);
  renderTutorial();
  render();
};

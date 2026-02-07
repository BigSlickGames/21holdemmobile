import { CARD_BACK_IMAGE, cardDisplayName } from "./cards.js";
import { BLIND_PRESETS, MIN_BUYIN_MULTIPLIER, STARTING_STACK } from "./rules.js";
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

const actionOrder = {
  check: 1,
  call: 1,
  bet: 2,
  raise: 2,
  stand: 3,
  double: 4,
  fold: 5,
};

export const createAppUi = (engine) => {
  const splashScreen = document.querySelector("#splashScreen");
  const setupOverlay = document.querySelector("#setupOverlay");
  const startGameButton = document.querySelector("#startGameButton");
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
  let selectedTablePreset = BLIND_PRESETS[0];
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
        <div class="table-menu-meta">
          <strong>${preset.label}</strong>
          <span>Min buy-in ${preset.bigBlind * MIN_BUYIN_MULTIPLIER}</span>
        </div>
      `;
      button.addEventListener("click", () => {
        selectedTablePreset = preset;
        renderTableMenu();
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

  const getStatusText = (player) => {
    if (player.folded) {
      return "Folded";
    }
    if (player.busted) {
      return "Busted";
    }
    const tokens = [];
    if (player.standing) {
      tokens.push("Stand");
    }
    if (player.doubleDown) {
      tokens.push("DD");
    }
    if (tokens.length === 0) {
      return player.lastAction;
    }
    return `${player.lastAction} | ${tokens.join(" ")}`;
  };

  const getTotalBubbleValue = (player) => {
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
      const revealCards = true;
      player.hand.forEach((card) => {
        cards.appendChild(createCardNode(card, !revealCards));
      });
      if (player.hand.length === 0) {
        cards.appendChild(createCardNode(null, true));
      }

      body.appendChild(cards);

      const totalBadge = document.createElement("div");
      totalBadge.className = "profile-total-badge";
      totalBadge.textContent = getTotalBubbleValue(player);

      const seatBottom = document.createElement("div");
      seatBottom.className = "profile-footer";
      seatBottom.innerHTML = `
        <span>${player.chips} chips</span>
        <span>${getStatusText(player)}</span>
      `;

      shell.appendChild(headerBand);
      shell.appendChild(roleBadge);
      shell.appendChild(body);
      shell.appendChild(totalBadge);
      seat.appendChild(shell);
      seat.appendChild(seatBottom);
      playerLayer.appendChild(seat);
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

    if (tableTitle) {
      tableTitle.textContent = `21 HOLD'EM ${state.smallBlindAmount}/${state.bigBlindAmount}`;
    }
    roundBadge.textContent = `Round ${state.roundName}`;
    potBadge.textContent = `Pot ${state.pot}`;
    betBadge.textContent = `Blinds ${state.smallBlindAmount}/${state.bigBlindAmount}`;

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

  startGameButton.addEventListener("click", () => {
    clearPendingFlow();
    engine.setPlayerName(playerNameInput?.value || "PLAYER");
    engine.setBlindStructure(selectedTablePreset.smallBlind, selectedTablePreset.bigBlind);
    engine.startNewHand();
    setupOverlay.classList.add("hidden");
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
  renderTableMenu();
  setMenuPanel(activeMenuPanel);
  renderTutorial();
  beginSplashSequence();
  render();
};

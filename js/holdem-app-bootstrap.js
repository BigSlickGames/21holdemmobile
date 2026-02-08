const APP_VERSION = "53";

Promise.all([
  import(`./holdem-game-engine.js?v=${APP_VERSION}`),
  import(`./game-table-ui-controller.js?v=${APP_VERSION}`),
])
  .then(([engineModule, uiModule]) => {
    const { Holdem21Engine } = engineModule;
    const { createAppUi } = uiModule;
    const engine = new Holdem21Engine();
    createAppUi(engine);
  })
  .catch((error) => {
    console.error("Failed to bootstrap 21 Hold'em:", error);
    window.alert("Failed to load the game app. Refresh and try again.");
  });

import { Holdem21Engine } from "./js/game-engine.js";
import { createAppUi } from "./js/ui.js";

const engine = new Holdem21Engine();
createAppUi(engine);

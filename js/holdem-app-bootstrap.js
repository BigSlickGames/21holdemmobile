import { Holdem21Engine } from "./holdem-game-engine.js";
import { createAppUi } from "./game-table-ui-controller.js";

const engine = new Holdem21Engine();
createAppUi(engine);
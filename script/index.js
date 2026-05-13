import config from "./config";
import quickRoll from "./quickRoll";
import damageLog from "./damageLog";
import combatTracker from "./combatTracker";

Hooks.once("init", () => {
  // initialize settings
  config.init();

  // initialize internal modules based on settings
  quickRoll.init();
  damageLog.init();
  combatTracker.init();
});
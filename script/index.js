import * as config from "./config.js";
import * as quickRoll from "./quickRoll.js";
import * as damageLog from "./damageLog.js";
import * as combatTracker from "./combatTracker.js";
import * as token from "./tokenMods/_token.js";
import * as quickFixes from "./quickFixes.js";
import { mod } from "./utils.js";
import { socket } from "./socket.js";

Hooks.once("init", () => {
  // initialize settings
  config.init();
  quickFixes.init();

  // initialize internal modules based on settings
  quickRoll.init();
  damageLog.init();
  combatTracker.init();
  token.init();

  // initialize sockets
  socket.init();

  window.toggleHooks = () => CONFIG.debug.hooks = !CONFIG.debug.hooks;
  // toggleHooks();

  window.mod = mod;
});
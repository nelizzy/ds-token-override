import { MODULE_ID } from "./const.js";
import { mod } from "./utils.js";

export const socket = (() => {
  const emit = (action, data) => {
    if (list.get(action)) {
      game.socket.emit(`module.${MODULE_ID}`, { action, ...data })
    } else {
      mod.warn(`SOCKET: No action has been registered for ${action}`);
    }
  };

  const list = new Map();

  const register = (action, callback) => {
    list.set(action, callback);
  };

  const init = () => {
    game.socket.on(`module.${MODULE_ID}`, async (payload) => {
      const { action, ...data } = payload;
      const callback = list.get(action);
      if (callback) await callback(data);
      else mod.warn(`SOCKET: Could not run ${action}`)
    });
  }

  return { emit, register, list, init }
})();

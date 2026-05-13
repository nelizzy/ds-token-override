import { flags, modConsole, moduleId } from "./utils";

export const socket = (() => {
  const id = `module.${moduleId}`;

  const emit = (action, data) => {
    if (actions.get(action)) {
      game.socket.emit(id, { action, ...data })
    } else {
      modConsole.warn(`No socket handler for action ${action}`);
    }
  };

  const actions = new Map();

  const register = (action, callback) => {
    actions.set(action, callback);
  };

  const init = () => {
    game.socket.on(id, async ({ action, ...data }) => {
      const callback = actions.get(action);
      if (callback) await callback(data);
    });
  }

  return { emit, register, actions, init }
})();

socket.register("setUndone", async ({ messageId }) => {
  if (!game.user.isGM) return;
  const message = await game.messages.get(messageId);
  await flags(message).set("undone", true);
});


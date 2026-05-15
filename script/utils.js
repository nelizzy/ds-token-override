import { MODULE_ID } from "./const.js";

export const settings = (() => {
  const get = async (key) => await game.settings.get(MODULE_ID, key);
  const set = async (key, value) => await game.settings.set(MODULE_ID, key, value);
  return { get, set };
})();

// use e.g. const mFlag = flags(m); then mFlag.get("key") and mFlag.set("key", value)
export const flags = (obj) => {
  const get = async (key) => await obj.getFlag(MODULE_ID, key);
  const set = async (key, value) => await obj.setFlag(MODULE_ID, key, value);
  return { get, set };
}

// make it easier to find this mod's logs in the console
export const mod = ((prefix = `DS Token Override | `) => {
  const log = (...args) => console.log(prefix, ...args);
  const warn = (...args) => console.warn(prefix, ...args);
  const error = (...args) => console.error(prefix, ...args);
  return { log, warn, error };
})();

// helps quickly check permissions of current user
export const user = (() => {
  const role = (() => ({
    is: (req) => game.user.role === req,
    atLeast: (req) => game.user.role >= req,
  }))();

  const matches = (id) => game.userId === id;
  const owns = (obj) => obj?.isOwner;
  const authored = (obj) => obj?.author?.id === game.userId;

  const minimum = (obj) => {
    if (game.user.isGM) return "gm";
    if (authored(obj)) return "author";
    if (matches(obj.id)) return "matchesId";
    if (owns(obj)) return "owner";
    return "player";
  }

  return { role, minimum, matches, owns, authored };
})();

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// GRAPHICAL UTILS

// design was originally scaled around 140px
export const uiScale = (() => {
  const set = (gridSize) => gridSize / 140;
  const get = () => set(canvas.grid.size);

  return { set, get };
})();

// color1 and color2 are hex strings, ratio is 0..1 for color2
export function blendColors(color1, color2, ratio) {
  const c1 = PIXI.utils.hex2rgb(PIXI.utils.string2hex(color1));
  const c2 = PIXI.utils.hex2rgb(PIXI.utils.string2hex(color2));
  const blended = c1.map((v, i) => (1 - ratio) * v + ratio * c2[i]);

  return PIXI.utils.rgb2hex(blended);
}

const PreciseText = foundry.canvas.containers.PreciseText || PIXI.Text;
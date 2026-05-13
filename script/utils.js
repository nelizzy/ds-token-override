// used for settings, flags, and socket actions
export const moduleId = "ds-token-override";

export const settings = (() => {
  const get = async (key) => await game.settings.get(moduleId, key);
  const set = async (key, value) => await game.settings.set(moduleId, key, value);
  return { get, set };
})

// use e.g. const mFlag = flags(m); then mFlag.get("key") and mFlag.set("key", value)
export const flags = (obj) => {
  const get = async (key) => await obj.getFlag(moduleId, key);
  const set = async (key, value) => await obj.setFlag(moduleId, key, value);
  return { get, set };
}

// make it easier to find this mod's logs in the console
export const modConsole = ((prefix = `DS Token Override | `) => {
  const log = (...args) => console.log(prefix, ...args);
  const warn = (...args) => console.warn(prefix, ...args);
  const error = (...args) => console.error(prefix, ...args);
  return { log, warn, error };
})();

// helps quickly check permissions for a given object, in order of most to least permissive
export const userPerms = (() => {
  const role = (() => ({
    is: (req) => game.user.role === req,
    atLeast: (req) => game.user.role >= req,
  }))();

  const playerOwned = (actor) => actor?.hasPlayerOwner;

  const minimum = (obj) => {
    if (game.user.isGM) return "gm";
    if (obj?.author?.id === game.userId) return "author";
    if (obj?.id === game.userId) return "matchesId";
    if (obj?.isOwner) return "owner";
    return "player";
  }

  return { role, playerOwned, minimum };
})();

// helps safely? override functions
export const override = (() => {
  const map = new Map();

  // newFunc should look like
  // async function (originalFunc, args) { ... }
  const create = (obj, funcName, newFunc) => {
    const originalFunc = obj[funcName];

    const overrideCount = map.getOrInsert(originalFunc, 0);

    if (overrideCount > 0) {
      modConsole.warn(`Overriding ${funcName} which has already been overridden ${overrideCount} time(s). This may cause unexpected behavior.`);
    }

    obj[funcName] = newFunc.call(this, originalFunc, args);

    map.set(originalFunc, overrideCount + 1);
  }

  const exists = (obj, funcName) => {
    const originalFunc = obj[funcName];
    return map.has(originalFunc);
  }

  return { create, exists };
})();


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
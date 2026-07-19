import { healthLabels } from "./healthLabels.js";
import { tokenResource } from "./tokenResource.js";
import { flags, onAllCanvasTokens } from "../utils.js";
import { MODULE_ID } from "../const.js";

export const init = async () => {
  await tokenResource.init();
  await healthLabels.init();

  Hooks.on("drawToken", createOverlay);
  Hooks.on("refreshToken", checkFlags);
  Hooks.on("updateCombatantGroup", trackHealthMinions);
}

/* ---------------------------- RELEVANT SETTINGS ---------------------------
  ALLOW ONCHANGE() WITHOUT RELOAD
- enableTokenResource (boolean)
- tokenResourceSize (number)

- healthLabelPlayersMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelOtherMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelSize (number)
*/

async function anyEnabled() {
  return (await healthLabels.isEnabled() || await tokenResource.isEnabled());
}

function createOverlay(tokenObj) {
  healthLabels.create(tokenObj)
  tokenResource.create(tokenObj)
}

async function checkFlags(tokenObj, flags) {
  if (!await anyEnabled()) return;

  if (flags.refreshBars) {
    const barSize = tokenObj.bars.bar1.getLocalBounds();
    const tokenWidth = tokenObj.w;
    const tokenHeight = tokenObj.h;

    const sameGeometry =
      tokenObj._dsBarWidth === barSize.width
      && tokenObj._dsBarHeight === barSize.height
      && tokenObj._dsTokenWidth === tokenWidth
      && tokenObj._dsTokenHeight === tokenHeight;

    if (!sameGeometry) {
      tokenObj._dsBarWidth = barSize.width;
      tokenObj._dsBarHeight = barSize.height;
      tokenObj._dsTokenWidth = tokenWidth;
      tokenObj._dsTokenHeight = tokenHeight;

      tokenResource.position(tokenObj);
      healthLabels.rescale(tokenObj, { barSize });
    }
  }

}

export function makeOverlaySection({
  name,
  isEnabled,
  onInit = () => { },
  onCreate = () => { },
  onDraw = () => { },
  onRescale = () => { },
  onDestroy,
  onEnable = () => { },
  onDisable = () => { },
  onDestroyAll = () => { },
  onSetVisibility = () => { },
  hooks = [],
}) {
  function safeGet(tokenObj) {
    return tokenObj?.getChildByName?.(name)
      ?? tokenObj?.bars?.getChildByName?.(name)
      ?? tokenObj?.bars?.bar1?.getChildByName?.(name)
      ?? null;
  }

  const hookHandler = (() => {
    // expected hook entry: [hookName, function, isOnce]

    const attachedHooks = new Map();

    function attach() {
      hooks.forEach(([hookName, fn, isOnce], index) => {
        if (attachedHooks.has(index)) return;

        attachedHooks.set(index, {
          hookName,
          id: isOnce ? Hooks.once(hookName, fn) : Hooks.on(hookName, fn)
        });
      })
    }

    function detach() {
      attachedHooks.forEach(({ hookName, id }) => {
        Hooks.off(hookName, id)
      })
      attachedHooks.clear();
    }

    return { attach, detach, list: hooks }
  })();

  return {
    name,

    isEnabled,

    hookHandler,

    safeGet,

    async init() {
      if (!(await isEnabled())) return;
      hookHandler.attach();
      onInit();
    },

    async forceInit() {
      await this.init();
      onAllCanvasTokens(this.create);
    },

    async create(tokenObj) {
      if (!(await isEnabled())) return;
      if (!safeGet(tokenObj)) onCreate(tokenObj);
      onDraw(tokenObj);
      onRescale(tokenObj);
    },

    async draw(tokenObj, ...args) {
      if (!(await isEnabled())) return;
      onDraw(tokenObj, ...args);
    },

    async rescale(tokenObj, ...args) {
      if (!(await isEnabled())) return;

      onDraw(tokenObj, ...args);
      onRescale(tokenObj, ...args);
    },

    enable(user) {
      onAllCanvasTokens(this.create);
      hookHandler.attach();
      onEnable()
      onAllCanvasTokens(onSetVisibility, { disabled: false, user })
    },

    disable(user) {
      hookHandler.detach();
      onDisable()
      if (user === game.user.id) {
        onAllCanvasTokens(onSetVisibility, { disabled: true, user })
      }
    },

    destroy(tokenObj) {
      const displayObject = safeGet(tokenObj);
      if (!displayObject) return;

      if (onDestroy) onDestroy(tokenObj, displayObject);
      else displayObject.destroy();
    },

    destroyAll() {
      onAllCanvasTokens(this.destroy)
      onDestroyAll();
    },

    async setVisibility(tokenObj, ...args) {
      if (!(await isEnabled())) return;

      // expects an object { user, mockHover, disabled }
      onSetVisibility(tokenObj, ...args);
    }
  };
}

/* ------------------------------ SHARED HOOKS ------------------------------ */
// would be used for healthLabels, so brought out here

async function trackHealthMinions(combatantGroup, changed, options, evtUserId) {
  if (!(await healthLabels.isEnabled())) return;

  const grpFlags = flags(combatantGroup);
  const lastStamina = await grpFlags.get("lastStamina") ?? {};
  const minions = combatantGroup?.system?.minions;

  if (!minions) return;

  const { staminaMax, staminaValue } = combatantGroup.system;
  const staminaMaxChanged = lastStamina.staminaMax !== staminaMax;
  const staminaValueChanged = lastStamina.staminaValue !== staminaValue;

  // healthLabels
  if (lastStamina.staminaMax !== staminaMax || lastStamina.staminaValue !== staminaValue) {
    minions.forEach(minion => {
      const tokenObj = minion.token?.object;
      if (!tokenObj) return;

      healthLabels.draw(tokenObj, { staminaMax, staminaValue })
    })

  }

  // new stmaina recorded
  if (game.userId === evtUserId && combatantGroup.isOwner && (staminaMaxChanged || staminaValueChanged)) {
    return grpFlags.set("lastStamina", { staminaMax, staminaValue });
  }
}

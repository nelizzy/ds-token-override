import { healthbarTicks } from "./healthbarTicks.js";
import { healthLabels } from "./healthLabels.js";
import { tokenResource } from "./tokenResource.js";
import { flags, mod, onAllCanvasTokens } from "../utils.js";
import { MODULE_ID } from "../const.js";

export const init = async () => {
  await tokenResource.init();
  await healthbarTicks.init();
  await healthLabels.init();

  Hooks.on("drawToken", createOverlay);
  Hooks.on("refreshToken", checkFlags);
  Hooks.on("updateCombatantGroup", trackHealthMinions);
}

/* ---------------------------- RELEVANT SETTINGS ---------------------------
  ALLOW ONCHANGE() WITHOUT RELOAD
- enableTokenResource (boolean)
- tokenResourceSize (number)

- enableHealthbarTicks (boolean)
- healthLabelPlayersMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelOtherMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelSize (number)
*/

async function anyEnabled() {
  return (await healthbarTicks.isEnabled() || await healthLabels.isEnabled() || await tokenResource.isEnabled());
}

function createOverlay(tokenObj) {
  healthbarTicks.create(tokenObj)
  healthLabels.create(tokenObj)
  tokenResource.create(tokenObj)
}

async function checkFlags(tokenObj, flags) {
  if (!await anyEnabled()) return;

  if (flags.refreshBars) {
    // rescale overlay
    tokenResource.rescale(tokenObj);

    // rescale bar
    const barSize = tokenObj.bars.bar1.getLocalBounds();

    if (tokenObj._barWidth === barSize.width && tokenObj._barHeight === barSize.height) return;
    tokenObj._barWidth = barSize.width;
    tokenObj._barHeight = barSize.height;

    healthLabels.rescale(tokenObj, { barSize });
    healthbarTicks.rescale(tokenObj, { barSize });
  }

  if (flags.refreshVisibility) {
    healthbarTicks.setVisibility(tokenObj);
    // healthLabels.setVisibility(tokenObj);
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

    const attachedHooks = new Set();

    function attach() {
      hooks.forEach(([hookName, fn, isOnce]) => {
        attachedHooks.add(
          [
            hookName,
            isOnce ? Hooks.once(hookName, fn) : Hooks.on(hookName, fn)
          ]
        );
      }
      )
    }

    function detach() {
      attachedHooks.forEach(hook => {
        Hooks.off(...hook)
      })
    }

    return { attach, detach, list: hooks }
  })();

  let _isCreated = false;

  return {
    name,

    isEnabled,

    hookHandler,

    safeGet,

    async init() {
      if (!(await isEnabled())) return;
      // mod.log(`Initializing ${name}`)
      hookHandler.attach();
      onInit();
    },

    async forceInit() {
      // mod.log(`Force Initializing ${name}`)
      init();
      onAllCanvasTokens(this.create);
    },

    async create(tokenObj) {
      if (!(await isEnabled())) return;
      // mod.log(`Creating ${name}`)
      onCreate(tokenObj);
      onDraw(tokenObj);
      onRescale(tokenObj);

      _isCreated = true;
    },

    async draw(tokenObj, ...args) {
      if (!(await isEnabled())) return;
      // mod.log(`Drawing ${name}`)
      onDraw(tokenObj, ...args);
    },

    async rescale(tokenObj, ...args) {
      if (!(await isEnabled())) return;
      // mod.log(`Rescaling ${name}`)

      onDraw(tokenObj, ...args);
      onRescale(tokenObj, ...args);
    },

    enable(user) {
      if (!_isCreated) onAllCanvasTokens(this.create);
      hookHandler.attach();
      onEnable()
    },

    disable(user) {
      hookHandler.detach();
      onDisable()
      onAllCanvasTokens(onSetVisibility, false, user)
    },

    destroy(tokenObj) {
      const displayObject = safeGet(tokenObj);
      if (!displayObject) return;

      if (onDestroy) onDestroy(tokenObj, displayObject);
      else displayObject.destroy();

      // mod.log(`Destroying ${name} on ${tokenObj.name}`, tokenObj);
    },

    destroyAll() {
      mod.group(`Destroying ${name}`);
      onAllCanvasTokens(this.destroy)
      onDestroyAll();
      mod.groupEnd()
    },

    async setVisibility(tokenObj, ...args) {
      if (!(await isEnabled())) return;
      // mod.log(`Setting visibility on ${name}`)

      onSetVisibility(tokenObj, ...args);
    }
  };
}

/* ------------------------------ SHARED HOOKS ------------------------------ */
// woulod be used for healthLabels and healthbarTicks, so brought out here

async function trackHealthMinions(combatantGroup, changed, options, evtUserId) {
  if (!(await healthbarTicks.isEnabled() || await healthLabels.isEnabled())) return;

  const grpFlags = flags(combatantGroup);
  const lastStamina = await grpFlags.get("lastStamina") ?? {};
  const minions = combatantGroup?.system?.minions;

  if (!minions) return;

  const { staminaMax, staminaValue } = combatantGroup.system;
  const staminaMaxChanged = lastStamina.staminaMax !== staminaMax;
  const staminaValueChanged = lastStamina.staminaValue !== staminaValue;

  // healthbarTicks
  if (staminaMaxChanged) {
    minions.forEach(minion => {
      const tokenObj = minion.token?.object;
      if (tokenObj) healthbarTicks.draw(tokenObj, { setCount: combatantGroup.system.minions.size })
    })
  }

  // healthLabels
  if (staminaMaxChanged || staminaValueChanged) {
    minions.forEach(minion => {
      const tokenObj = minion.token?.object;
      if (tokenObj) healthLabels.draw(tokenObj, { staminaMax, staminaValue })
    })

  }

  // new stmaina recorded
  if (game.userId === evtUserId && combatantGroup.isOwner && (staminaMaxChanged || staminaValueChanged)) {
    return grpFlags.set("lastStamina", { staminaMax, staminaValue });
  }
}

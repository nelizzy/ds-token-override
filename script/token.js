import { mod as mod, settings } from "./utils.js";

export const init = async () => {
  tokenResource.init();
  hudRolls.init();
  healthLabels.init();
  minionHealthbarFix();
}

/* ---------------------------- RELEVANT SETTINGS ---------------------------
  ALLOW ONCHANGE() WITHOUT RELOAD
- enableHudRolls (boolean)

- enableTokenResource (boolean)
- tokenResourceSize (number)

- healthbarTicks (boolean)
- healthLabelPlayersMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelOtherMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelSize (number)
*/

// Might refactor to split these three out further? :thonk:

export const tokenResource = (() => {
  const init = () => { };

  return { init };
})();

export const hudRolls = (() => {
  const init = () => { };

  return { init };
})();

export const healthLabels = (() => {
  const init = () => { };

  return { init };
})();


// delete when fixed in base foundry!!
const minionHealthbarFix = () => {
  // fix initial load
  Hooks.on("drawTokenLayer", (tokenLayer) => {
    tokenLayer.ownedTokens.forEach(token => {
      if (token?.actor?.system?.combatGroups?.size === 1) {
        token.document._prepareBars();
        token.animate(token._getAnimationData(), { duration: 0 });
      }
    })
  });

  // fix health updates
  (() => {
    const old = CONFIG.Combatant.documentClass.prototype.refreshCombatant;
    CONFIG.Combatant.documentClass.prototype.refreshCombatant = function () {
      if (this.actor.system.combatGroups.size === 1) {
        this.token?._prepareBars();
        this.token?.object?.animate(this.token?.object?._getAnimationData());
      }

      old.call(this);
    }
  })();
}

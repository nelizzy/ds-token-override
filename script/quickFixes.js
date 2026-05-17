import { settings } from "./utils.js";

export const init = () => {
  if (!settings.get("enableQuickFixes")) return;

  minionHealthbarFix();
  highGroundAutomation();
}

// delete when fixed in base foundry!!
function minionHealthbarFix() {
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

function highGroundAutomation() {

}
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
  // CREDIT TO COLINGREENLEAF (https://github.com/ColinGreenleaf)
  const AbilitySystem = CONFIG.Item.dataModels?.ability;

  const _original = AbilitySystem.prototype.getTargetModifiers;

  AbilitySystem.prototype.getTargetModifiers = function (target) {
    const modifiers = _original.call(this, target);

    const userToken = canvas.tokens.controlled.find(t => t.actor === this.actor)
      ?? canvas.tokens.placeables.find(t => t.actor === this.actor);

    if (userToken && target) {
      const userElevation = userToken.document.elevation ?? 0;
      const targetElevation = target.document?.elevation ?? target.elevation ?? 0;
      const targetSize = target.actor?.system?.combat?.size?.value ?? 1;

      if ((targetElevation + targetSize) <= userElevation) {
        modifiers.edges += 1;
        ui.notifications.info(`${userToken.actor.name} attacks ${target.actor.name} from high ground, gaining an edge on the attack.`);
      }
    }
    return modifiers;
  };

}
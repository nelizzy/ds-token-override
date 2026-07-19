import { settings } from "./utils.js";

export const init = () => {
  if (settings.get("highGroundAutomation")) highGroundAutomation();
  if (settings.get("combatGroupDeletion")) deleteCombatantGroupRecursive();
}

// CREDIT TO COLINGREENLEAF (https://github.com/ColinGreenleaf)
function highGroundAutomation() {
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

// Deleting combat groups from a combat now also removes all combatants from combat instead of popping them out to be a solo fighter.
function deleteCombatantGroupRecursive() {
  Hooks.on("deleteCombatantGroup", fn)

  function fn(group) {
    const combat = group.parent;
    const members = group.members.map(x => x.id);
    combat.deleteEmbeddedDocuments("Combatant", [...members]);
  }
}

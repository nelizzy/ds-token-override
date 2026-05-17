import { MODULE_ID } from "../const.js";
import { mod, PreciseText, settings, uiScale } from "../utils.js";
import { makeOverlaySection } from "./_token.js";

export const healthLabels = makeOverlaySection({
  name: "ds-health-labels",
  isEnabled,
  onInit: init,
  onCreate: create,
  onDraw: draw,
  onRescale: rescale,
  // onDestroy: destroy,
  onDestroyAll: disable,
  onSetVisibility: setVisibility,
  hooks: [
    ["updateActor", updateHealthActors],
    ["highlightObjects", highlightAll]
  ]
})

const perm = (role) => {
  return {
    role,
    canSee: game?.user?.hasRole(role) && role > 0
  }
}

/* ----------------------------- GENERIC HANDLER ---------------------------- */

healthLabels._enabledStatus = undefined;

async function isEnabled({ players, others } = {}) {
  if (healthLabels._enabledStatus !== undefined) return healthLabels._enabledStatus;
  const perms = await permCheck({ players, others });
  return perms.both.canSee ?? perms.both.role !== 0
}

function init() {
  healthLabels._enabledStatus = true;
}

function disable() {
  healthLabels._enabledStatus = false;
}

function create(tokenObj) {
  if (!tokenObj) return;

  const label = new PreciseText("TEST", {
    ...CONFIG.canvasTextStyle, // <- foundry defaults
    fontSize: game.settings.get("ds-token-override", "healthLabelSize") * uiScale.get(),
    fill: "#FFF",
    align: "center",
  });
  label.name = healthLabels.name;
  label.anchor.set(0.5, 0.5);
  label.zIndex = Infinity;

  tokenObj.addChild(label);
};

function draw(tokenObj, { staminaMax, staminaValue } = {}) {
  const actor = tokenObj.actor;
  if (actor.isMinion && actor.system.combatGroup) {
    const x = actor.system.combatGroup.system;
    staminaMax ??= x.staminaMax;
    staminaValue ??= x.staminaValue;
  }
  else {
    const x = actor.system.stamina;
    staminaMax ??= x.max;
    staminaValue ??= `${x.value}`
    if (x.temporary) staminaValue += `[${x.temporary}]`;
  }

  const label = healthLabels.safeGet(tokenObj);
  label.text = `${staminaValue} / ${staminaMax}`

}

function rescale(tokenObj) {
  const label = healthLabels.safeGet(tokenObj);
  const bar = tokenObj.bars.bar1;
  const barBounds = bar.getLocalBounds();

  label.x = tokenObj.w / 2;
  label.y = tokenObj.h - (barBounds.height / 2);
}

let _isForced = false;

async function setVisibility(tokenObj, force) {
  if (force != undefined) _isForced = force;
  if (_isForced && force === undefined) return;

  const shouldSee = force || tokenObj.hover;
  const perms = await permCheck();
  const relevantPerm = tokenObj.document.hasPlayerOwner ? perms.players : perms.others;
  const label = healthLabels.safeGet(tokenObj);
  label.visibility = shouldSee && relevantPerm.canSee && relevantPerm.role > 0;
  label.renderable = shouldSee && relevantPerm.canSee && relevantPerm.role > 0;
}

/* ---------------------------- SPECIAL FUNCTION ---------------------------- */

async function permCheck({ players, others } = {}) {
  players ??= await settings.get("healthLabelPlayersMinimumPerm");
  others ??= await settings.get("healthLabelOtherMinimumPerm");
  const both = ((a, b) => (a === 0 ? b : b === 0 ? a : Math.min(a, b)))(players, others);

  return {
    players: perm(players),
    others: perm(others),
    both: perm(both)
  }
}

function updateHealthActors(actor, diff) {
  if (diff?.system?.stamina) healthLabels.draw(actor);
}

export function resizeText(tokenObj, size) {
  healthLabels.safeGet(tokenObj).style.fontSize = size * uiScale.get();
}

function highlightAll(highlighted) {
  canvas.tokens.placeables.forEach(obj => healthLabels.setVisibility(obj, highlighted))
}
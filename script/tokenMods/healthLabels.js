import { MODULE_ID } from "../const.js";
import { mod, onAllCanvasTokens, PreciseText, settings, uiScale } from "../utils.js";
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
    ["highlightObjects", highlightAll],
    ["hoverToken", (token) => setVisibility(token)],
    ["renderDrawSteelTokenHUD", (app) => {
      const token = app.object;
      setVisibility(token, true);
      Hooks.once("closeDrawSteelTokenHUD", () => {
        setVisibility(token, false)
      });
    }],
  ]
})

const perm = (role) => {
  return {
    role,
    canSee: game?.user?.hasRole(role) && role > 0
  }
}

const ALIGNMENT_CONFIG = {
  top: {
    anchor: [0.5, 0.8],
    y: (tokenObj, barBounds) => tokenObj.h - (barBounds.height * 1)
  },
  middle: {
    anchor: [0.5, 0.5],
    y: (tokenObj, barBounds) => tokenObj.h - (barBounds.height * 0.5)
  },
  // bottom: {
  //   anchor: [0.5, 0.5],
  //   y: (tokenObj, barBounds) => tokenObj.h
  // },
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

  const label = new PreciseText("", {
    ...CONFIG.canvasTextStyle, // <- foundry defaults
    fontSize: settings.get("healthLabelSize") * uiScale.get(),
    fill: "#FFF",
    align: "center",
  });
  label.name = healthLabels.name;
  label.zIndex = Infinity;
  tokenObj.addChild(label);
  setVisibility(tokenObj, false);
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
    if (x.temporary) staminaValue += `+${x.temporary}`;
  }

  const label = healthLabels.safeGet(tokenObj);
  label.text = `${staminaValue} / ${staminaMax}`
}

function rescale(tokenObj, { align, barSize } = {}) {
  const label = healthLabels.safeGet(tokenObj);
  barSize ??= tokenObj.bars.bar1.getLocalBounds();

  if (healthLabels._alignment === undefined) healthLabels.setAlignment();
  if (align) healthLabels.setAlignment(align);

  label.anchor.set(...healthLabels._alignment.anchor);
  label.x = tokenObj.w / 2;
  label.y = healthLabels._alignment.y(tokenObj, barSize);
}

let _isForced = false;

async function setVisibility(tokenObj, force) {
  const label = healthLabels.safeGet(tokenObj);
  if (!label) return;

  if (force != undefined) _isForced = force;
  if (_isForced && force === undefined) return;

  const shouldSee = force || tokenObj.hover;
  const perms = await permCheck();
  const relevantPerm = tokenObj.document.hasPlayerOwner ? perms.players : perms.others;
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
  if (diff?.system?.stamina) {
    onAllCanvasTokens((tokenObj) => {
      if (foundry.utils.equals(tokenObj.actor, actor))
        draw(tokenObj);
    })
  }
}

healthLabels.resizeText = (tokenObj, size) => {
  healthLabels.safeGet(tokenObj).style.fontSize = size * uiScale.get();
}

healthLabels.setAlignment = (userAlignment) => {
  userAlignment ??= settings.get("healthLabelAlignment");
  const alignment = ALIGNMENT_CONFIG[userAlignment];
  healthLabels._alignment = alignment;
}

function highlightAll(highlighted) {
  onAllCanvasTokens(healthLabels.setVisibility, highlighted)
}

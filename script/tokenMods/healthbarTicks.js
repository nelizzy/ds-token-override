import { flags, mod, settings, uiScale } from "../utils.js";
import { makeOverlaySection } from "./_token.js";

export const healthbarTicks = makeOverlaySection({
  name: "ds-ticks",
  isEnabled: async () => await settings.get("enableHealthbarTicks"),
  onCreate: create,
  onDraw: draw,
  onSetVisibility: visibility,
})

/* ----------------------------- GENERIC HANDLER ---------------------------- */

function create(tokenObj) {
  const ticks = new PIXI.Graphics();
  ticks.name = healthbarTicks.name;
  tokenObj.bars.addChild(ticks);

  const actor = tokenObj.actor;
  let count = 2;
  if (["hero", "retainer"].includes(actor.type)) count = 3;
  if (actor.isMinion) count = actor?.system?.combatGroup?.system?.minions?.size ?? 0;

  tokenObj.bars._tickCount = count;
};

function draw(tokenObj, { barSize, setCount } = {}) {
  const ticks = tokenObj.bars.getChildByName(healthbarTicks.name);
  barSize ??= tokenObj.bars.bar1.getLocalBounds();

  if (setCount) tokenObj.bars._tickCount = setCount;
  const count = tokenObj.bars._tickCount;

  ticks.clear();
  ticks.lineStyle({ color: "#000", width: 2 * uiScale.get() });

  const minionSpacing = barSize.width / count;

  for (let index = 1; index < count; index++) {
    if (tokenObj.actor.type === "npc" && !tokenObj.actor.isMinion
    ) index++

    const y = tokenObj.actor.isMinion ?
      minionSpacing * index :
      getSpacing(tokenObj.actor)[index] * barSize.width;

    drawTick(ticks, y, tokenObj.bars.bar1.y, barSize.height);
  }
};

function visibility(tokenObj) {
  const ticks = healthbarTicks.safeGet(tokenObj);
  const bar = tokenObj.bars.bar1;
  ticks.renderable = bar.renderable;
  ticks.visibility = bar.visbility;
}

/* ---------------------------- SPECIAL FUNCTION ---------------------------- */

function drawTick(ticks, x, y, height) {
  const offset = 1 * uiScale.get();
  ticks.moveTo(x, y)
  ticks.lineTo(x, y + height - offset * 2);
}

function getSpacing(actor) {
  const { winded, max, min } = actor.system.stamina;
  const offset = Math.abs(min);
  return [min, 0, winded, max].map(x => (x + offset) / (offset + max))
}
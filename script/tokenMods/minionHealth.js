import { settings } from "../utils.js";

export const init = () => {
  if (game.version < 14) return;
  if (settings.get("minionHealthbars")) minionHealthbarFix();
}

function minionHealthbarFix() {
  const ogFn = CONFIG.Token.objectClass.prototype._drawBar;
  CONFIG.Token.objectClass.prototype._drawBar = function (index, bar, data) {
    const og = ogFn.call(this, index, bar, data);

    if (!data.minionStamina) return;

    const minions = this.combatant.group.members.filter(c => c.actor.isMinion);
    if (minions.size <= 1) return;

    const { width, height } = this.document.getSize();
    const s = canvas.dimensions.uiScale;
    const bw = width;
    const bh = 8 * (this.document.height >= 2 ? 1.5 : 1) * s;

    const interval = bw / minions.size;
    for (let i = 1; i <= minions.size; i++) {
      bar.moveTo(interval * i, 0).lineTo(interval * i, bh);
    }
  }
}
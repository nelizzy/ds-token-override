import { MODULE_ID } from "../const.js";
import { settings } from "../utils.js";

export const init = () => {
  if (game.version < 14) return;
  if (settings.get("minionHealthbars")) {
    if (typeof libWrapper === 'function') {
      // libwrapper is present, use it to wrap the function
      libWrapper.register(MODULE_ID, 'CONFIG.Token.objectClass.prototype._drawBar', function (wrapped, index, bar, data) {
        const og = wrapped(index, bar, data);
        minionHealthbarFix.call(this, index, bar, data);
      })
    } else {
      // libwrapper is not present, override the function directly
      const og = CONFIG.Token.objectClass.prototype._drawBar;
      CONFIG.Token.objectClass.prototype._drawBar = function (index, bar, data) {
        og.call(this, index, bar, data);
        minionHealthbarFix.call(this, index, bar, data);
      }
    }
  }
}

function minionHealthbarFix(index, bar, data) {
  if (!data.minionStamina) return;
  if (!this?.combatant?.group?.members) return;

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



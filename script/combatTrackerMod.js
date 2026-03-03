export function combatTrackerMod() {
  const updateTokens = CONFIG.CombatantGroup.documentClass.prototype.updateTokens;
  CONFIG.CombatantGroup.documentClass.prototype.updateTokens = async function (...args) {
    updateTokens.apply(this, args);
    if (!game.settings.get("ds-token-override", "groupColor")) return;

    await this.setFlag("ds-token-override", "groupColor", args[1]);

    ui.combat.render();
  };

  const renderTracker = (app, html, data) => {
    if (!game.combat) return;

    const shouldColor = game.settings.get("ds-token-override", "groupColor");

    if (shouldColor) {
      game.combat.groups.forEach((group) => {
        const color = group.getFlag("ds-token-override", "groupColor");
        const el = html.querySelector(`[data-group-id="${group.id}"]`);
        el.style.setProperty("--group-color", color);

        const staminaEl = el.querySelector(".squad-stamina");

        if (staminaEl) {
          const wrapper = document.createElement("div");
          staminaEl.parentElement.appendChild(wrapper);
          staminaEl.insertAdjacentText("beforeend", ` stamina`);
          wrapper.appendChild(staminaEl);
          wrapper.style = `font-size: 0.95em`;
          const maxMinions = group.system.minions.size;
          const minionThreshold = group.system.staminaMax / maxMinions;
          const remainMinions = Math.min(Math.ceil(group.system.staminaValue / minionThreshold), maxMinions);
          wrapper.insertAdjacentText("beforeend", `${remainMinions} / ${maxMinions} minions`);
        }
      });
    }
  };

  Hooks.on("renderDrawSteelCombatTracker", renderTracker);
}

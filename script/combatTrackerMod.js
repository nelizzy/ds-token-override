export function combatTrackerMod() {
  const highlighted = [];

  const updateTokens = CONFIG.CombatantGroup.documentClass.prototype.updateTokens;
  CONFIG.CombatantGroup.documentClass.prototype.updateTokens = async function (...args) {
    updateTokens.apply(this, args);
    if (!game.settings.get("ds-token-override", "groupColor")) return;

    await this.setFlag("ds-token-override", "groupColor", args[1]);

    ui.combat.render();
  };

  const hoverIn = (evt) => {
    if (evt.target.closest(".combatant[data-combatant-id]")) return;

    const { groupId } = evt.target.closest(`[data-group-id]`)?.dataset ?? {};

    if (!groupId) return;

    const grp = game.combat?.groups?.get(groupId);

    if (!grp) return;

    grp.members.forEach((el) => {
      const { tokenId } = el ?? {};
      if (!tokenId) return;
      const token = canvas.tokens.get(tokenId);
      token?._onHoverIn(evt);
      highlighted.push(token);
    });
  };

  const hoverOut = (evt) => {
    if (evt.target.closest(".combatant[data-combatant-id]")) return;
    highlighted.forEach((el) => {
      const { id } = el ?? {};
      if (!id) return;
      const token = canvas.tokens.get(id);
      token?._onHoverOut(evt);
    });

    highlighted.length = 0;
  };

  const renderTracker = (app, html, data) => {
    if (!game.combat) return;

    const shouldColor = game.settings.get("ds-token-override", "groupColor");

    if (shouldColor) {
      game.combat.groups.forEach((group) => {
        const color = group.getFlag("ds-token-override", "groupColor");
        const el = html.querySelector(`[data-group-id="${group.id}"]`);
        el.style.setProperty("--group-color", color);
        const wrapper = document.createElement("div");
        const staminaEl = el.querySelector(".squad-stamina");
        staminaEl.parentElement.appendChild(wrapper);
        staminaEl.insertAdjacentText("beforeend", ` stamina`);
        wrapper.appendChild(staminaEl);
        wrapper.style = `font-size: 0.95em`;
        const maxMinions = group.system.minions.size;
        const minionThreshold = group.system.staminaMax / maxMinions;
        const remainMinions = Math.ceil((group.system.staminaValue / group.system.staminaMax) * minionThreshold);
        wrapper.insertAdjacentText("beforeend", `${remainMinions} / ${maxMinions} minions`);
      });
    }

    const shouldHover = game.settings.get("ds-token-override", "groupHover");
    if (shouldHover) {
      html.addEventListener("pointerover", hoverIn);
      html.addEventListener("pointerout", hoverOut);
    }
  };

  Hooks.on("renderDrawSteelCombatTracker", renderTracker);
}

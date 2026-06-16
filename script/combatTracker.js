import { flags, mod, settings } from "./utils.js";

export const init = async () => {
  if (!await settings.get("enableTrackerMods")) return;

  override();

  Hooks.on("renderDrawSteelCombatTracker", modifyRender);

}

function override() {
  const fn = CONFIG.CombatantGroup.documentClass.prototype.updateTokens;

  CONFIG.CombatantGroup.documentClass.prototype.updateTokens = async function (...args) {
    const result = await fn.apply(this, args);

    if (game.user.isGM && ["ring.colors.ring", "texture.tint"].includes(args[0])) {
      await this.setFlag("ds-token-override", "groupColor", args[1]);
    }

    return result;
  };
}

function modifyRender(_, html, evtData) {
  game?.combat?.groups?.forEach(group => {
    const el = html.querySelector(`[data-group-id="${group.id}"]`)
    if (!el) return;

    const color = flags(group).get("groupColor").then(color => {
      if (color) el.style.setProperty("--group-color", color)
    })

    const staminaEl = el.querySelector(".squad-stamina");
    if (!staminaEl) return;

    // adds clarification that the current num is stamina
    const wrapper = document.createElement("div");
    staminaEl.parentElement.appendChild(wrapper);
    staminaEl.insertAdjacentHTML("afterbegin", `<i class="fa-solid fa-heart-pulse"></i>`);
    wrapper.appendChild(staminaEl);
    wrapper.classList.add('ds-override', 'minion-wrap');

    // changes minion stamina display to be GM only
    staminaEl.classList.toggle('can-see', evtData.user.isGM);

    const maxMinions = group?.system?.minions?.size;
    if (!maxMinions) return;

    // adds minion count e.g. (3/5 minions)
    const minionThreshold = group.system.staminaMax / maxMinions;
    const remainMinions = Math.min(Math.ceil(group.system.staminaValue / minionThreshold), maxMinions);
    wrapper.insertAdjacentHTML("beforeend", `<i class="fa-duotone fa-solid fa-people-group"></i> ${remainMinions} / ${maxMinions}`);
  })
}

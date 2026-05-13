import { settings } from "./utils";

export const init = async () => {
  if (!await settings.get("enableQuickRoll")) return;
  Hooks.on("renderChatMessageHTML", handleQuickRoll);
}

/* -------------------------------------------------------------------------- */

const buttons = (roll, flavor) => {
  const result = roll.result;

  const damageTypes = flavor ? [flavor] : [];

  return [
    {
      label: "dmg",
      tooltip: "Shift+Click: Halve Damage",
      onClick: (evt) => handleDamage(result, evt, {
        types: damageTypes,
        isHeal: false,
        ignoredImmunities: [""],
      }),
    },
    {
      label: "heal",
      tooltip: "Shift+Click: Halve Healing",
      onClick: (evt) => handleDamage(result, evt, {
        type: "value",
        types: ["value"],
        isHeal: true,
        ignoredImmunities: [""],
        flavor: "Stamina",
      }),
    },
    {
      label: "temp",
      tooltip: "Shift+Click: Halve Temp Stamina",
      onClick: (evt) => handleDamage(result, evt, {
        type: "temporary",
        types: ["temporary"],
        isHeal: true,
        ignoredImmunities: [""],
        flavor: "Temporary Stamina",
      }),
    },
    {
      label: "resource",
      tooltip: "Gain Malice or Heroic Resource",
      onClick: (evt) => handleResource(result, evt),
    },
  ];
}

function createButton({ label, tooltip, onClick }) {
  const button = document.createElement("button");
  button.classList.add("ds-override", "quickroll-button");
  button.innerHTML = label;
  button.dataset.tooltip = tooltip;
  button.dataset.tooltipDirection = "UP";
  button.addEventListener("click", onClick);
  return button;
};

async function handleDamage(result, evt, options) {
  await new ds.rolls.DamageRoll(result, {}, options)
    .evaluate()
    .then(r => r.applyDamage(null, { halfDamage: evt.shiftKey }))
}

async function handleResource(result, evt) {
  const tokens = canvas.tokens.controlled;
  const heroes = tokens.filter(token => token?.actor?.type === "hero");
  const delta = parseInt(result) * (evt.shiftKey ? -1 : 1);

  // grant gm malice as long as no heroes are selected
  if (heroes.length === 0 && game.user.isGM) {
    const malice = game.actors.malice;
    await game.settings.set(systemID, "malice", { value: malice.value + delta });

    ChatMessage.create({
      author: game.user,
      content: `GM ${delta > 0 ? "gained" : "lost"} ${Math.abs(delta)} malice.`,
    });
  }

  // otherwise, give selected heroes a heroic resource
  for (const token of heroes) {
    const actor = token.actor;
    actor.system.updateResource(delta);

    ChatMessage.create({
      author: game.user,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `${actor.name} ${delta > 0 ? "gained" : "lost"} ${Math.abs(delta)} ${actor.system.hero.primary.label}.`,
    });
  }
}

async function handleQuickRoll(data, el) {
  if (data.type !== "base" || !data.isRoll) return;

  const roll = data.rolls?.[0];

  if (!roll || roll.constructor.name !== "DSRoll" || data.flavor === "Start of turn resource gain") return;

  const flavor = roll.terms?.[0]?.options?.flavor ?? "untyped";

  const diceRoll = el.querySelector(".dice-roll");
  if (diceRoll) {
    diceRoll.insertAdjacentHTML(
      "afterbegin",
      `<div class="dice-flavor" style="">${flavor.titleCase()}</div>`,
    );
  }

  const footer = document.createElement("footer");
  footer.classList.add("ds-override", "quickroll-footer");
  buttons(roll, flavor).forEach(buttonData => footer.appendChild(createButton(buttonData)))
  el.appendChild(footer);
}
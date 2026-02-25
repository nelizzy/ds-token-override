export function chat() {
  Hooks.on("renderChatMessageHTML", async (data, el, opts) => {
    if (data.type === "base" && data.isRoll) {
      const roll = data.rolls[0];

      if (roll.constructor.name !== "DSRoll") return;

      const footer = document.createElement("footer");
      footer.style = "display: grid; grid-template-columns: repeat(auto-fit, minmax(5ch, 1fr)); gap: 0.5ch; margin-top: 0.2ch; order: 100;";
      // footer.style = "display: grid; grid-template-columns: minmax(5ch, 1.5fr) repeat(auto-fit, minmax(5ch, 1fr)); gap: 0.5ch; margin-top: 0.2ch; order: 100;";
      let type = roll.terms[0].options.flavor ?? "untyped";

      if (type) el.querySelector(".dice-roll").insertAdjacentHTML("afterbegin", `<div class="dice-flavor" style="margin-bottom: 0; color: var(--dsp-text); font-size: 0.9em;" >${type.titleCase()}</div>`);

      const buttons = [
        {
          // label: `dmg<br>${type}`,
          label: `dmg`,
          tooltip: `Shift+Click: Halve Damage`,
          onClick: (evt) => {
            let types = [];
            if (type) types.push(type);

            const dsRoll = new ds.rolls.DamageRoll(
              roll.result,
              {},
              {
                types,
                isHeal: false,
                ignoredImmunities: [""],
              },
            );

            dsRoll.evaluate().then((r) => r.applyDamage(null, { halfDamage: evt.shiftKey }));
          },
        },
        {
          label: "heal",
          tooltip: `Shift+Click: Halve Healing`,
          onClick: (evt) => {
            const dsRoll = new ds.rolls.DamageRoll(
              roll.result,
              {},
              {
                type: "value",
                types: ["value"],
                isHeal: true,
                ignoredImmunities: [""],
                flavor: "Stamina",
              },
            );
            dsRoll.evaluate().then((r) => r.applyDamage(null, { halfDamage: evt.shiftKey }));
          },
        },
        {
          label: "temp",
          tooltip: `Shift+Click: Halve Temp Stamina`,
          onClick: (evt) => {
            const dsRoll = new ds.rolls.DamageRoll(
              roll.result,
              {},
              {
                type: "temporary",
                types: ["temporary"],
                isHeal: true,
                ignoredImmunities: [""],
                flavor: "Temporary Stamina",
              },
            );
            dsRoll.evaluate().then((r) => r.applyDamage(null, { halfDamage: evt.shiftKey }));
          },
        },
        {
          label: "heroic",
          tooltip: `Shift+Click: Lose Resource`,
          onClick: (evt) => {
            const val = parseInt(roll.result);
            let newVal = (evt.shiftKey ? -1 : 1) * val;
            const actors = canvas.tokens.controlled.map((t) => t.actor);

            actors
              .filter((actor) => actor.type === "hero")
              .forEach(async (actor) => {
                let oldVal = actor.system.hero.primary.value;
                newVal = Math.max(oldVal + newVal, actor.system.coreResource.minimum);
                await actor.update({ "system.hero.primary.value": newVal });

                ChatMessage.create({
                  author: game.user,
                  speaker: ChatMessage.getSpeaker({ actor }),
                  content: `${actor.name}'s Heroic Resource changed from ${oldVal} to ${newVal}.`,
                });
              });
          },
        },
      ];

      buttons.forEach((btn) => {
        const button = document.createElement("button");
        button.style = `font-size: 0.8em; text-transform: uppercase`;
        button.innerHTML = btn.label;
        button.dataset.tooltip = btn.tooltip;
        button.dataset.tooltipDirection = "UP";
        button.addEventListener("click", btn.onClick);
        footer.appendChild(button);
      });
      el.appendChild(footer);
    }
  });
}

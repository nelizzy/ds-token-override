export function chat() {
  Hooks.on("renderChatMessageHTML", async (data, el, opts) => {
    if (data.type === "base" && data.isRoll) {
      const roll = data.rolls[0];

      if (roll.constructor.name !== "DSRoll" || data.flavor === "Start of turn resource gain") return;

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

    // handle per client rendering
    (() => {
      const isGM = game.user.isGM;
      const isAuthor = data.author.id === game.userId;
      const isOwner = data.speaker?.actor ? game.actors.get(data.speaker.actor)?.isOwner : false;

      if (!isGM) el.querySelectorAll(".gm-only").forEach((el) => el.remove());
      if (!isAuthor && !isGM) el.querySelectorAll(".author-only").forEach((el) => el.remove());
      if (!isOwner && !isGM) el.querySelectorAll(".owner-only").forEach((el) => el.remove());
    })();

    if (data.flags["ds-token-override"]?.undone) {
      el.querySelectorAll(".damage-log").forEach((el) => {
        el.classList.add("disabled");
        const undoBtn = el.querySelector(".ds-override-undo");
        if (undoBtn) undoBtn.disabled = true;
      });
    }
  });

  const ogApplyDamage = ds.rolls.DamageRoll.prototype.applyDamage;
  ds.rolls.DamageRoll.prototype.applyDamage = async function (...args) {
    if (canvas.tokens.controlled.length) {

    Hooks.once("updateActor", async (actor, newData, updateData, userId) => {
      if (!game.settings.get("ds-token-override", "showDamageLog")) return;
      if (newData.system?.stamina === undefined) return;

      const tokenId = updateData.parent?.id;
      const actorId = actor.id;

      const postData = newData.system.stamina;
      const preData = updateData.ds.previousStamina;

      const tempPost = postData?.temporary ?? 0;
      const tempPre = preData?.temporary ?? 0;
      const staminaPost = postData?.value ?? 0;
      const staminaPre = preData?.value ?? 0;

      const delta = (tempPost + staminaPost) - (tempPre + staminaPre);
      const tempDelta = tempPost - tempPre;
      const staminaDelta = staminaPost - staminaPre;

      const undoBtn = `<button data-action="undoDamage" class="ds-override-undo owner-only"><i class="fa-solid fa-rotate-left"></i></button>`;

      const x = await ChatMessage.create({
        author: game.users.get(userId),
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<span class="damage-log">${undoBtn} ${actor.name} ${delta < 0 ? `took` : `healed`} <span class="${actor.hasPlayerOwner ? "" : "gm-only"}">${Math.abs(delta)}</span> damage
        <span class="small ${actor.hasPlayerOwner ? "" : "gm-only"}">(${staminaPre}${tempPre > 0 ? ` [${tempPre}]` : ``} -> ${staminaPost}${tempPost > 0 ? ` [${tempPost}]` : ``})</span></span>
        `,
      });

      x.setFlag("ds-token-override", "undoData", {
        tokenId, actorId, tempDelta, staminaDelta
      });
    });

  }

    await ogApplyDamage.apply(this, args);
  };

  // Handle undo damage button
  ( () => {
    document.body.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action='undoDamage']");
      if (!btn || btn.disabled) return;

      const messageId = btn.closest("[data-message-id]").dataset.messageId;
      const message = await game.messages.get(messageId);

      undoDmg(message);
    })
  } )();
}

async function undoDmg(message) {
  const undoData = message.getFlag("ds-token-override", "undoData");
  if (!undoData) return;
  const { tokenId, actorId, staminaDelta, tempDelta } = undoData;

  let actor;

  if (tokenId) {
    const token = await game.scenes.current.tokens.get(tokenId);
    actor = token.actor;
  } else {
    actor = await game.actors.get(actorId);
  }

  const {value: oldStamina = 0, min = 0, max = 0, temporary = 0} = actor.system.stamina;
  const newVal = Math.min(Math.max(oldStamina - staminaDelta, min), max);
  const newTemp = Math.max(temporary - tempDelta, 0);

  const updateData = {};

  if (newVal !== oldStamina) updateData["system.stamina.value"] = newVal;
  if (newTemp !== temporary) updateData["system.stamina.temporary"] = newTemp;

  const r = await actor.update(updateData);

   if (game.user.isGM) {
    // GM can do it directly
    await message.setFlag("ds-token-override", "undone", true);
  } else {
    // Player asks the GM to do it
    game.socket.emit("module.ds-token-override", { action: "setUndone", messageId: message.id });
  }
}
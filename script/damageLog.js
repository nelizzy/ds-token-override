import { socket } from "./socket.js";
import { clamp, flags, mod, settings } from "./utils.js";

export const init = async () => {
  if (!await settings.get("enableDamageLog")) return;

  Hooks.on("renderChatMessageHTML", renderLogMessage);
  Hooks.on("updateActor", updateStamina);
  Hooks.on("updateCombatantGroup", updateStamina);

  // gm receives the undone flag and edits the message on their end
  socket.register("setUndone", async ({ messageId }) => {
    if (!game.user.isGM) return;

    const message = game.messages.get(messageId);
    if (!message) return;

    await flags(message).set("undone", true);
  });
}

/* ---------------------- Message Creation and Rendering --------------------- */

const visTag = `data-visibility="if-player-owned"`;

async function renderLogMessage(message, messageEl, evtData) {
  const el = messageEl.querySelector(".ds-override.damage-log")
  if (!el) return;

  if (await flags(message).get("undone")) {
    el.classList.add("disabled");
    el.querySelector(".ds-override.undo-button").setAttribute('disabled', true);
  } else {
    const button = el.querySelector(".ds-override.undo-button");
    button.addEventListener("click", (evt) => {
      undoDamage({ message, messageEl, messageEvt: evtData, clickEvt: evt });
    });
  }

  if (evtData?.speakerActor) {
    const { hasPlayerOwner, isOwner } = evtData.speakerActor;
    el.classList.toggle("can-see", hasPlayerOwner || isOwner);
    el.classList.toggle("can-use", isOwner);
  }
}

function damageLogContent(logData) {
  const { name, preValue, postValue, minionsDelta, delta } = logData;
  let { tempDelta } = logData.flags;

  let content = `<div class="ds-override damage-log">
    <button data-action="undoDamage" class="ds-override undo-button" ${visTag}><i class="fa-solid fa-rotate-left"></i></button>
    ${name} ${delta < 0 ? "took" : tempDelta > 0 ? "gained" : "healed"} <b><span ${visTag}>${Math.abs(delta)} </span>${delta < 0 ? "damage" : tempDelta > 0 ? "temp stamina" : "stamina"}</b> <span class="small" ${visTag}>(${preValue} → ${postValue}) </span>`

  if (Math.abs(minionsDelta) > 0)
    content += `<div class="small" ${visTag}>This ${minionsDelta < 0 ? "defeats" : "restores"} ${Math.abs(minionsDelta)} minion${Math.abs(minionsDelta) > 1 ? "s" : ""}.</div>`

  content += `</div>`

  return content;
}

/* ---------------- Hooks: updateActor, updateCombatantGroup ---------------- */

async function updateStamina(...args) {
  const [, , evtData, evtUserId] = args;

  // only run once no matter how many users!
  if (game.userId !== evtUserId) return;

  // ignore changes made by undo button
  if (evtData.isUndo) return;

  // expected data output
  let logData = {
    speaker: undefined, // ChatMessage.getSpeaker()
    name: undefined, // token name
    delta: undefined, // integer
    preValue: undefined, // string
    postValue: undefined, // string
    minionsDelta: undefined, // integer
    flags: undefined, // obj of flags
  }

  switch (evtData.documentName) {
    case 'Actor':
      logData = logActors(...args)
      break;

    case 'CombatantGroup':
      logData = logMinions(...args)
      break;
  }

  if (!logData) return;

  logData.flags.type = evtData.documentName;

  const logMessage = await ChatMessage.create({
    author: game.users.get(evtUserId),
    speaker: logData.speaker,
    content: damageLogContent(logData)
  });

  flags(logMessage).set("undoData", logData.flags);
}

function logMinions(group, diffData, evtData) {
  if (group?.system?.combat?.round === 0 && diffData?.system?.staminaValue === group?.system?.staminaMax) return; // don't log pre-combat HP changes that set the initial HP value for a group

  const minions = group.system?.minions;

  if (minions?.size < 1) return;

  if (!evtData?.ds?.staminaDiff) return;

  const delta = evtData.ds.staminaDiff;
  const staminaPost = diffData.system.staminaValue;
  const staminaPre = staminaPost + delta;

  if (delta === 0) return;

  const minionThreshold = group.system.staminaMax / minions.size;

  const minionsPost = Math.min(Math.ceil(staminaPost / minionThreshold), minions.size);
  const minionsPre = Math.min(Math.ceil(staminaPre / minionThreshold), minions.size);
  const minionsDelta = clamp(minionsPost - minionsPre, minions.size * -1, minions.size);

  return {
    speaker: ChatMessage.getSpeaker({ combatant: group }), // ChatMessage.getSpeaker()
    name: group.name, // token name
    delta: delta * -1, // integer
    preValue: staminaPre, // string
    postValue: staminaPost, // string
    minionsDelta, // integer
    flags: {
      delta
    }, // obj of flags
  }
}

function logActors(actor, diffData, evtData) {

  if (diffData.system?.stamina === undefined) return;

  const postData = diffData.system.stamina;
  const preData = evtData.ds.previousStamina;

  const tempPre = preData?.temporary ?? 0;
  const tempPost = postData?.temporary ?? 0;
  const staminaPre = preData?.value ?? 0;
  const staminaPost = postData?.value ?? staminaPre;

  const delta = tempPost + staminaPost - (tempPre + staminaPre);
  const tempDelta = tempPost - tempPre;
  const staminaDelta = staminaPost - staminaPre;

  const preValue = `${staminaPre}${tempPre > 0 ? ` [${tempPre}]` : ``}`;
  const postValue = `${staminaPost}${tempPost > 0 ? ` [${tempPost}]` : ``}`;

  if (delta === 0) return;

  return {
    speaker: ChatMessage.getSpeaker({ actor }), // ChatMessage.getSpeaker()
    name: actor.name, // token name
    delta, // integer
    preValue, // string
    postValue, // string
    flags: {
      tempDelta,
      staminaDelta
    }, // obj of flags
  }
}

/* ------------------------------- Undo Logic ------------------------------- */

async function undoDamage(opts) {
  // logic for actually undoing the damage
  const msgFlags = flags(opts.message)
  const data = await msgFlags.get("undoData");

  switch (data.type) {
    case 'Actor':
      await undoActor(opts.messageEvt.speakerActor, data);
      break;

    case 'CombatantGroup':
      await undoMinions(opts.messageEvt.speakerActor, data)
      break;
  }

  if (game.user.isGM) return msgFlags.set("undone", true);
  socket.emit("setUndone", { messageId: opts.message.id });
}

async function undoMinions(speakerActor, { delta }) {
  const group = speakerActor?.system?.combatGroup;
  return await group.update({ ["system.staminaValue"]: group.system.staminaValue - delta }, { isUndo: true })
}

async function undoActor(speakerActor, { tempDelta, staminaDelta }) {
  const updateData = {};

  const { value: oldStamina = 0, min = 0, max = 0, temporary: oldTemp = 0 } = speakerActor.system.stamina;
  const newStamina = clamp(oldStamina - staminaDelta, min, max);
  const newTemp = Math.max(oldTemp - tempDelta, 0);

  if (newStamina !== oldStamina) updateData["system.stamina.value"] = newStamina;
  if (newTemp !== oldTemp) updateData["system.stamina.temporary"] = newTemp;

  return await speakerActor.update(updateData, { isUndo: true });
}
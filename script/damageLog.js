import { socket } from "./socket.js";
import { clamp, flags, mod, settings, user } from "./utils.js";

export const init = async () => {
  if (!await settings.get("enableDamageLog")) return;

  // happens on loading and also when editing a message (including setting a flag ;3c)
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

  if (evtData?.speakerActor?.isOwner)
    el.classList.add("can-see");
}

function undoDamage(opts) {
  // logic for actually undoing the damage
  mod.log(opts);
  if (game.user.isGM) return flags(opts.message).set("undone", true)
  socket.emit("setUndone", { messageId: opts.message.id });
}

function damageLogContent(logData) {
  let content = `<div class="ds-override damage-log">
    <button data-action="undoDamage" class="ds-override undo-button" ${visTag}><i class="fa-solid fa-rotate-left"></i></button>
    ${logData.name} ${logData.delta < 0 ? "took" : "healed"} <b><span ${visTag}>${Math.abs(logData.delta)} </span>damage</b> <span class="small" ${visTag}>(${logData.preValue} → ${logData.postValue})</span>`

  if (Math.abs(logData?.minionsDelta) > 0)
    content += `<div class="small" ${visTag}>This ${logData.minionsDelta < 0 ? "defeats" : "restores"} ${Math.abs(logData.minionsDelta)} minion${Math.abs(logData.minionsDelta) > 1 ? "s" : ""}.</div>`

  content += `</div>`

  return content;
}

async function updateStamina(...args) {
  const [actor, diffData, evtData, evtUserId] = args;

  // only run once no matter how many users!
  if (!user.matches(evtUserId)) return;

  // ignore changes made by undo button
  if (diffData.isUndo) return;

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
      logData = handleActors(...args)
      break;

    case 'CombatantGroup':
      logData = handleMinions(...args)
      break;
  }

  if (!logData) return;

  const logMessage = await ChatMessage.create({
    author: game.users.get(evtUserId),
    speaker: logData.speaker,
    content: damageLogContent(logData)
  });

  flags(logMessage).set("undoData", logData.flags);
}

function handleMinions(group, diffData, evtData) {
  if (group.system.combat.round === 0 && diffData.system.staminaValue === group.system.staminaMax) return; // don't log pre-combat HP changes that set the initial HP value for a group

  const minions = group.system?.minions;

  if (minions.size < 1) return;

  if (evtData.ds?.staminaDiff === undefined) return;

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
      groupId: group.id,
      staminaDelta: delta
    }, // obj of flags
  }
}

function handleActors(actor, diffData, evtData) {

  if (diffData.system?.stamina === undefined) return;

  const tokenId = evtData.parent?.id;
  const actorId = actor.id;

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
      tokenId,
      actorId,
      tempDelta,
      staminaDelta
    }, // obj of flags
  }
}
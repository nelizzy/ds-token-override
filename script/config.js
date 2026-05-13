import { reRender } from "./index.js";

const config = {
  enableTokenResource: {
    name: "Show Token Resources",
    hint: "Toggle the circular resource display on tokens. Players only see it on tokens owned by at least 1 player.",
    type: Boolean,
    scope: "user",
    default: true,
    requiresReload: true,
  },

  tokenResourceSize: {
    name: "Token Resource Size",
    type: Number,
    default: 15,
    range: {
      min: 10,
      step: 1,
      max: 18,
    },
    onChange: () => {
      reRender();
    },
  },

  enableHudRolls: {
    name: "Rollable Characteristics",
    hint: "Adds column of Rollable Characteristics to Token HUD.",
    type: Boolean,
    scope: "user",
    default: false,
    requiresReload: true,
  },

  healthLabelPlayersMinimumPerm: {
    name: "Health Label on Player Owned Actors",
    hint: "Appears on hovering a token owned by at least 1 player, for users of this role or higher.",
    type: new foundry.data.fields.StringField({
      nullable: false,
      required: true,
      choices: CONST.USER_ROLE_NAMES,
    }),
    default: CONST.USER_ROLES.PLAYER,
    scope: "world",
    onChange: () => {
      reRender();
    },
  },

  healthLabelOtherMinimumPerm: {
    name: "Health Label on Non-Player Owned Actors",
    hint: "Appears on hovering any token, for users of this role or higher.",
    type: new foundry.data.fields.StringField({
      nullable: false,
      required: true,
      choices: CONST.USER_ROLE_NAMES,
    }),
    default: CONST.USER_ROLES.ASSISTANT,
    scope: "world",
    onChange: () => {
      reRender();
    },
  },

  healthLabelSize: {
    name: "Health Label Size",
    type: Number,
    default: 18,
    range: {
      min: 12,
      step: 1,
      max: 24,
    },
    onChange: () => {
      reRender();
    },
  },

  enableTrackerMods: {
    name: "Extra Combat Tracker Details",
    hint: "Adds group colors and minion count to default combat tracker.",
    type: Boolean,
    scope: "world",
    default: false,
    requiresReload: true,
  },

  enableQuickRoll: {
    name: "Quick Rolls",
    hint: "Appends extra buttons to generic /roll messages to quickly deal damage, heal, or gain resources.",
    type: Boolean,
    scope: "world",
    default: false,
    requiresReload: true,
  },

  enableDamageLog: {
    name: "Damage Log",
    hint: "Sends a message when token health changes, along with undo button for token owner.",
    type: Boolean,
    scope: "world",
    default: false,
    requiresReload: true,
  },
};

export const init = () => {
  for (const key in config) {
    const opts = config[key];

    game.settings.register("ds-token-override", key, {
      ...opts,
      config: true,
    });
  }
}
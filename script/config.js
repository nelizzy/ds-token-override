import { MODULE_ID } from "./const.js";
import { mod } from "./utils.js";

const config = {
  _TOKEN: {
    label: "Token",
    divider: 1
  },

  enableTokenResource: {
    name: "Show Token Resources",
    hint: "Toggle the circular resource display on tokens. Players only see party-owned tokens.",
    type: Boolean,
    scope: "user",
    default: true,
    onChange: () => {
      // ...
    },
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
      // ...
    },
  },

  enableHudRolls: {
    name: "Characteristic Buttons",
    hint: "Adds buttons to token HUD to quick roll that token's characteristics.",
    type: Boolean,
    scope: "user",
    default: false,
    onChange: () => {
      // ...
    },
  },

  _HEALTHBAR: {
    label: "Healthbar",
    divider: 2
  },

  enableHealthbarTicks: {
    name: "Healthbar Ticks",
    type: Boolean,
    scope: "user",
    default: true,
    onChange: () => {
      // ...
    },
  },

  healthLabelPlayersMinimumPerm: {
    name: "Health Label: Player Actors",
    hint: "Minimum permission needed to hover party-owned tokens and see health labels.",
    type: new foundry.data.fields.StringField({
      nullable: false,
      required: true,
      choices: CONST.USER_ROLE_NAMES,
    }),
    default: CONST.USER_ROLES.PLAYER,
    scope: "world",
    onChange: () => {
      // ...
    },
  },

  healthLabelOtherMinimumPerm: {
    name: "Health Label: Other Actors",
    hint: "Minimum permission needed to hover any token and see health labels.",
    type: new foundry.data.fields.StringField({
      nullable: false,
      required: true,
      choices: CONST.USER_ROLE_NAMES,
    }),
    default: CONST.USER_ROLES.ASSISTANT,
    scope: "world",
    onChange: () => {
      // ...
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
      // ...
    },
  },

  _MISC: {
    label: "Miscellaneous Mods",
    divider: 1
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
    hint: "Appends extra buttons to generic /roll messages.",
    type: Boolean,
    scope: "world",
    default: false,
    requiresReload: true,
  },

  enableDamageLog: {
    name: "Damage Log",
    hint: "Sends a message when token health changes.",
    type: Boolean,
    scope: "world",
    default: false,
    requiresReload: true,
  },
};

const sections = (() => {
  const list = new Array();

  const render = (container) => {
    list.forEach(opts => {
      const { label, divider } = opts[0];
      const [settingTarget,] = opts[1];

      container.querySelector(`.form-group:has([id="settings-config-${MODULE_ID}.${settingTarget}"])`)
        .insertAdjacentHTML("beforebegin", `<div class="ds-override settings-header" style="--size: ${divider}">${label}</div}`);
    })
  }

  const add = (...args) => list.push(args)

  return { render, add }

})();

export const init = () => {
  Hooks.on("renderSettingsConfig", (obj, el) => {
    sections.render(el);
  })

  Object.entries(config).forEach(([key, opts], index, array) => {
    if (opts.divider) return sections.add(opts, array[index + 1])

    game.settings.register(MODULE_ID, key, {
      ...opts,
      config: true,
    });
  })
}
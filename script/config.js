import { MODULE_ID } from "./const.js";
import { healthbarTicks } from "./tokenMods/healthbarTicks.js";
import { healthLabels } from "./tokenMods/healthLabels.js";
import { tokenResource } from "./tokenMods/tokenResource.js";
import { mod, onAllCanvasTokens } from "./utils.js";

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
    onChange: (enabled, data, user) => {
      if (enabled) {
        tokenResource.enable(user);
      } else {
        tokenResource.disable(user);
      }
    },
  },

  tokenResourceSize: {
    name: "Token Resource Size",
    type: Number,
    default: 15,
    scope: "user",
    range: {
      min: 10,
      step: 1,
      max: 18,
    },
    onChange: (val) => {
      onAllCanvasTokens(tokenResource.rescale)
    },
  },

  _HEALTHTICKS: {
    label: "Healthbar Ticks",
    divider: 2
  },

  enableHealthbarTicks: {
    name: "Show Healthbar Ticks",
    type: Boolean,
    scope: "user",
    default: true,
    onChange: function (enabled, data, user) {
      mod.log(arguments);
      if (enabled) {
        healthbarTicks.enable(user);
      } else {
        healthbarTicks.disable(user);
      }
    },
  },

  tickColor: {
    name: "Set Tick Color",
    type: new foundry.data.fields.ColorField({
      nullable: false,
      required: true,
    }),
    scope: "user",
    default: "#000",
    onChange: (color) => {
      onAllCanvasTokens(healthbarTicks.draw, { color })
    },
  },

  _HEALTHLABEL: {
    label: "Healthbar Label",
    divider: 2
  },
  healthLabelAlignment: {
    name: "Label Alignment",
    type: new foundry.data.fields.StringField({
      nullable: false,
      required: true,
      choices: {
        "top": "Above Health Bar",
        "middle": "Overlaying Health Bar",
      },
    }),
    default: "top",
    scope: "user",
    onChange: (align) => {
      onAllCanvasTokens(healthLabels.rescale, { align })
    }
  },

  healthLabelSize: {
    name: "Label Size",
    type: Number,
    scope: "user",
    default: 18,
    range: {
      min: 12,
      step: 1,
      max: 24,
    },
    onChange: (val) => {
      onAllCanvasTokens(healthLabels.resizeText, val)
    },
  },

  healthLabelPlayersMinimumPerm: {
    name: "Health Label: Player Actors",
    hint: "Minimum permission needed to hover party-owned tokens and see health labels.",
    type: new foundry.data.fields.NumberField({
      nullable: false,
      required: true,
      choices: CONST.USER_ROLE_NAMES,
    }),
    default: CONST.USER_ROLES.PLAYER,
    scope: "world",
    onChange: async (players) => {
      healthLabels.clearPermissionCache();
      if (await healthLabels.isEnabled({ players })) {
        if (healthLabels._enabledStatus) return;
        healthLabels.forceInit();
      } else {
        healthLabels.destroyAll();
      }
    },
  },

  healthLabelOtherMinimumPerm: {
    name: "Health Label: Other Actors",
    hint: "Minimum permission needed to hover any token and see health labels.",
    type: new foundry.data.fields.NumberField({
      nullable: false,
      required: true,
      choices: CONST.USER_ROLE_NAMES,
    }),
    default: CONST.USER_ROLES.ASSISTANT,
    scope: "world",
    onChange: async (others) => {
      healthLabels.clearPermissionCache();
      if (await healthLabels.isEnabled({ others })) {
        if (healthLabels._enabledStatus) return;
        healthLabels.forceInit();
      } else {
        healthLabels.destroyAll();
      }
    },
  },

  _MISC: {
    label: "Miscellaneous Mods",
    divider: 1,
    gmOnly: true
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
    hint: "Sends a message with undo button when token health changes.",
    type: Boolean,
    scope: "world",
    default: false,
    requiresReload: true,
  },

  minionHealthbars: {
    name: "Fix Minion Healthbars",
    hint: `Smoothly animates minion squad healthbars when updating health (will be removed when implemented by system)`,
    type: Boolean,
    scope: "world",
    default: true,
    requiresReload: true,
  },

  highGroundAutomation: {
    name: "Automate High Ground Edges",
    hint: `Automatically adds per-target edges for high ground, with an alert`,
    type: Boolean,
    scope: "world",
    default: true,
    requiresReload: true,
  },

  combatGroupDeletion: {
    name: "Combat Group Deletion+",
    hint: `Deleting combat groups from a combat now also removes all combatants from combat instead of popping them out to be a solo fighter`,
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

      const { gmOnly, divider, label } = opts[0];
      if (gmOnly && !game.user.isGM) return;

      const [settingTarget,] = opts[1];

      container.querySelector(`.form-group:has([id="settings-config-${MODULE_ID}.${settingTarget}"])`)
        .insertAdjacentHTML("beforebegin", `<div class="ds-override settings-header" style="--size: ${divider}">${label}</div}`);
    })
  }

  const add = (...args) => list.push(args)

  return { render, add }

})();

const markdown = (el) => {
  const domWalk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (domWalk.nextNode()) {
    const node = domWalk.currentNode;

    // looking for md links as [text](url)
    const regex = /\[(.*?)\]\((.*?)\)/g;
    if (!regex.test(node.nodeValue)) continue;

    const span = document.createElement("span");
    span.innerHTML = node.nodeValue.replace(regex, `<a href="$2">$1</a>`)

    node.replaceWith(...span.childNodes);
  }

}

export const init = () => {
  Hooks.on("renderSettingsConfig", (obj, el) => {
    const tab = el.querySelector(`.tab[data-category="ds-token-override"]`);
    sections.render(tab);
    markdown(tab);
  })

  Object.entries(config).forEach(([key, opts], index, array) => {
    if (opts.divider) return sections.add(opts, array[index + 1])

    game.settings.register(MODULE_ID, key, {
      ...opts,
      config: true,
    });
  })
}

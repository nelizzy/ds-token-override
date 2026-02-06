import { icons } from "./icons.js";
import { reRender } from "./index.js";
import { ResourceData } from "./resource.js";

const displayModes = {
  [CONST.TOKEN_DISPLAY_MODES.NONE]: "Never Displayed",
  [CONST.TOKEN_DISPLAY_MODES.CONTROL]: "When Controlled",
  [CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER]: "Hovered by Owner",
  [CONST.TOKEN_DISPLAY_MODES.HOVER]: "Hovered by Anyone",
  [CONST.TOKEN_DISPLAY_MODES.OWNER]: "Always for Owner",
  [CONST.TOKEN_DISPLAY_MODES.ALWAYS]: "Always for Everyone",
};

const settings = {
  showResources: {
    name: "Show Resources",
    hint: "Toggle the circular resource display on Hero tokens.",
    type: Boolean,
    scope: "user",
    default: true,
    onChange: (value) => {
      reRender();
    },
  },

  resourceLabelSize: {
    name: "Resource Label Size",
    type: Number,
    default: 15,
    range: {
      min: 10,
      step: 1,
      max: 18,
    },
    onChange: (value) => {
      reRender();
    },
  },

  showCharacteristics: {
    name: "Rollable Characteristics",
    hint: "Adds column of Rollable Characteristics to Token HUD. Token HUD must be closed and reopened to see change.",
    type: Boolean,
    scope: "user",
    onChange: (value) => {
      reRender();
    },

    default: true,
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
    onChange: (value) => {
      reRender();
    },
  },

  // healthLabelHero: {
  //   name: "Health Label (Heroes)",
  //   type: new foundry.data.fields.StringField({
  //     nullable: false,
  //     required: true,
  //     choices: displayModes,
  //   }),
  //   default: CONST.TOKEN_DISPLAY_MODES.HOVER,
  //   scope: "world",
  //   onChange: (value) => {
  //     reRender();
  //   },
  // },

  // healthLabelNPC: {
  //   name: "Health Label (NPCs)",
  //   type: new foundry.data.fields.StringField({
  //     nullable: false,
  //     required: true,
  //     choices: displayModes,
  //   }),
  //   default: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
  //   scope: "world",
  //   onChange: (value) => {
  //     reRender();
  //   },
  // },

  tempStaminaColor: {
    name: "Temp Stamina Color",
    type: new foundry.data.fields.ColorField(),
    default: "#5ac1e0",
    scope: "user",
    onChange: (value) => {
      reRender();
    },
  },
};

const resourceDefaults = [
  {
    path: "recoveries.value",
    max: "recoveries.max",
    icon: "",
    color: "#85c4dc",
  },
  {
    path: "hero.surges",
    max: "",
    icon: "",
    color: "#cd8eee",
  },
  {
    path: "hero.primary.value",
    max: "",
    icon: "",
    color: "#ffe493",
  },
];

// class ResourceMenuClass extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
//   static DEFAULT_OPTIONS = {
//     id: "resource-menu",
//     tag: "form",
//     template: "modules/ds-token-override/templates/resource-menu.hbs",
//     window: {
//       title: "Hero Token Resources",
//       resizable: true,
//     },
//     form: {
//       handler: ResourceMenuClass._onSubmit,
//       submitOnChange: false,
//     },
//     position: {
//       width: 600,
//       height: 400,
//     },
//   };

//   async _prepareContext(options) {
//     const context = await super._prepareContext(options);
//     context.resources = game.settings.get("ds-token-override", "resources").map((r, i) => ({ ...r, index: i + 1 }));
//     return context;
//   }

//   _activateListeners(html) {
//     super._activateListeners(html);
//     html.querySelectorAll('[data-action="pickIcon"]').forEach((btn) => {
//       btn.addEventListener("click", (ev) => {
//         const index = ev.currentTarget.dataset.index;
//         this.showIconPicker(index, html);
//       });
//     });
//   }

//   showIconPicker(index, formElement) {
//     const iconPickerHtml = `
//       <div class="icon-picker">
//         <style>
//         .icon-list {
//           margin-top: 1em;
//           display: grid;
//           grid-template-columns: repeat(auto-fit, minmax(2rem, 1fr));
//           gap: 3px;
//         }
//         </style>

//         <input type="text" class="search-icons" placeholder="Filter icons" />
//         <section class="icon-list">
//           ${icons
//             .map(
//               (icon) => `
//           <button type="button" class="inline-control icon fa-solid fa-${icon.main}" data-values="${[icon.main, icon.alt].join(" ")}" data-glyph="${icon.glyph}" data-action="selectIcon"></button>
//           `,
//             )
//             .join("\n")}
//         </section>
//       </div>
//     `;

//     const dialog = new Dialog({
//       title: "Pick Icon",
//       content: iconPickerHtml,
//       buttons: {},
//       render: (html) => {
//         const searchInput = html.querySelector(".search-icons");
//         const iconButtons = html.querySelectorAll('[data-action="selectIcon"]');

//         searchInput.addEventListener("input", (ev) => {
//           const filter = ev.target.value.toLowerCase();
//           iconButtons.forEach((btn) => {
//             const values = btn.dataset.values;
//             btn.style.display = values.includes(filter) ? "" : "none";
//           });
//         });

//         iconButtons.forEach((btn) => {
//           btn.addEventListener("click", (ev) => {
//             const glyph = ev.currentTarget.dataset.glyph;
//             formElement.querySelector(`[name="resources.${index}.icon"]`).value = glyph;
//             dialog.close();
//           });
//         });
//       },
//     });
//     dialog.render(true);
//   }

//   static async _onSubmit(event, form, formData) {
//     const resources = [];
//     for (let i = 0; i < 3; i++) {
//       resources.push({
//         path: formData[`resources.${i}.path`],
//         max: formData[`resources.${i}.max`],
//         icon: formData[`resources.${i}.icon`],
//         color: formData[`resources.${i}.color`],
//       });
//     }
//     await game.settings.set("ds-token-override", "resources", resources);
//   }
// }

export function initializeSettings() {
  for (const key in settings) {
    const opts = settings[key];

    game.settings.register("ds-token-override", key, {
      ...opts,
      config: true,
    });
  }

  game.settings.register("ds-token-override", "resources", {
    name: "Resources",
    scope: "world",
    type: new foundry.data.fields.ArrayField(new foundry.data.fields.EmbeddedDataField(ResourceData)),
    default: resourceDefaults.map((x) => new ResourceData(x)),
    config: false,
  });

  // game.settings.registerMenu("ds-token-override", "resourceMenu", {
  //   name: "Hero Token Resources",
  //   label: "Configure",
  //   hint: "Manage details about the circular resources on hero tokens",
  //   icon: "fas fa-gears",
  //   type: ResourceMenuClass,
  //   restricted: true,
  // });
}

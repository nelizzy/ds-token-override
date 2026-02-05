const { StringField, ColorField } = foundry.data.fields;
const { DataModel } = foundry.abstract;
const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

// export class ResourceConfig extends HandlebarsApplicationMixin(ApplicationV2) {
//   static DEFAULT_OPTIONS = {
//     id: "resource-settings-config",
//     tag: "form",
//     window: {
//       title: "Configure Token Resources",
//       contentClasses: ["standard-form"],
//     },
//     form: {
//       closeOnSubmit: true,
//       handler: ResourceConfig.#onSubmit,
//     },
//     position: { width: 600 },
//     actions: {
//       reset: ResourceConfig.#onReset,
//     },
//   };
// }

export class ResourceData extends DataModel {
  static defineSchema() {
    return {
      path: new StringField({ required: true, trim: true }),
      max: new StringField({ nullable: true, trim: true }),
      icon: new IconField({ required: true, label: "Icon Glyph e.g. " }),
      color: new ColorField({ required: true, initial: "#9b9a98ff" }),
    };
  }
}

import { icons } from "./icons.js";

export class IconField extends StringField {
  static icons = icons;

  _toInput(config) {
    const el = super._toInput();
    el.classList.add("icon-input-group");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-picker-btn fa-solid fa-list";
    btn.title = "Pick Icon";
    btn.addEventListener("click", () => this._openIconDialog(el));
    el.parentElement.style.display = "flex";
    el.parentElement.style.gap = "0.5rem";
    el.style.flex = "1";
    el.parentElement.appendChild(btn);
  }

  async _openIconDialog(inputEl) {
    const content = IconField.getDialogContent(inputEl.dataset.index);

    const dialog = new DialogV2({
      title: "Select Icon",
      content,
      buttons: {
        none: { icon: "fa-solid fa-times", label: "Cancel" },
      },
      default: "none",
    });

    await dialog.render(true);
  }

  static getDialogContent(idx) {
    return `
    <div class="icon-picker">
        <style>
        .icon-list {
          margin-top: 1em;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(2rem, 1fr));
          gap: 3px;
        }
        </style>

        <style id="icon-filtering"></style>

        <input type="text" class="search-icons" placeholder="Filter icons" />

        <section class="icon-list">
          ${icons
            .map(
              (icon) => `
          <button type="button" class="inline-control icon fa-solid fa-${icon.main}" data-values="${[icon.main, icon.alt].join(" ")}" data-glyph="${icon.glyph}" data-action="selectIcon"></button>
          `,
            )
            .join("\n")}
        </section>

        <script>
          document.querySelector(".icon-list").addEventListener("click", (e) => {
            const btn = e.target;
            if (btn.dataset.action !== "selectIcon") return;

            const glyph = btn.dataset.glyph;
            const inputEl = document.querySelector(\`[name='resource-${idx}-icon']\`);
            inputEl.value = glyph;
          });

        document.querySelector("input.search-icons").addEventListener('input', (e) => {
          const filter = e.target.value;
          const styleSheet = document.querySelector("#icon-filtering").sheet;
          styleSheet.textContent = \`[data-action="selectIcon"]:not([data-values*="\${filter}"]) { display: none; }\`;})
        </script>
      </div>
      `;
  }
}

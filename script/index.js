import { initializeSettings } from "./config.js";

const PreciseText = foundry.canvas.containers.PreciseText || PIXI.Text;

const HERO = {
  RECOVERIES: {
    path: "recoveries.value",
    max: "recoveries.max",
    icon: "fa-solid fa-heart-pulse",
    color: "#85c4dc",
  },
  SURGES: {
    path: "hero.surges",
    icon: "fa-solid fa-chevrons-up",
    color: "#cd8eee",
  },
  HEROIC_RESOURCE: {
    path: "hero.primary.value",
    icon: "fa-solid fa-sparkles",
    color: "#ffe493",
  },
};

const uiScale = (() => {
  const set = (gridSize) => gridSize / 140;

  const get = () => set(canvas.grid.size);

  return { set, get };
})();

Hooks.once("init", () => {
  initializeSettings();

  const originalDrawBars = Token.prototype.drawBars;
  Token.prototype.drawBars = async function (...args) {
    const result = await originalDrawBars.apply(this, args);

    if (this.actor && this.actor.type === "hero") {
      renderAttributes(this);
    }

    drawHealthAdds(this);

    return result;
  };
});

export function reRender() {
  canvas.scene.tokens.forEach((token) => {
    token.object.drawBars();
  });
}

function drawHealthAdds(token) {
  // Draw stamina ticks above bar1
  const stamina = foundry.utils.getProperty(token.actor.system, "stamina");
  const thresholds = [];
  if (stamina.min < 0) thresholds.push(0);
  thresholds.push(stamina.winded);

  const ratios = thresholds.map((val) => (stamina.max - val) / (stamina.max + Math.abs(stamina.min)));

  if (token.bars?.bar1) {
    const bar = token.bars.bar1;

    const barBounds = bar.getLocalBounds();
    const barWidth = canvas.grid.size;
    const barHeight = barBounds.height;

    (() => {
      if (bar.tempStamina) {
        const temp = bar.getChildByName(bar.tempStamina.name);
        temp.visible = stamina.temporary > 0;
        const fg = temp.getChildByName("fg");
        drawTemp(fg, fg.height - 1);
        return;
      }

      const group = new PIXI.Container();
      group.name = "tempStamina";
      var tempHeight = barHeight / 2;
      const barBg = new PIXI.Graphics();
      barBg.beginFill(PIXI.utils.string2hex("#000"), 0.5);
      barBg.lineStyle(1 * uiScale.get(), PIXI.utils.string2hex("#000"), 1);
      barBg.drawRoundedRect(0, 0, barWidth, tempHeight, 2 * uiScale.get());
      barBg.endFill();
      barBg.x = 0;
      barBg.y = 0;
      group.addChild(barBg);

      const barFg = new PIXI.Graphics();

      function drawTemp(fg = barFg, height = tempHeight) {
        fg.clear();
        fg.beginFill(PIXI.utils.string2hex(game.settings.get("ds-token-override", "tempStaminaColor")), 0.95);
        fg.lineStyle(1 * uiScale.get(), PIXI.utils.string2hex("#000"), 1);
        fg.drawRoundedRect(0, 0, (stamina.temporary / stamina.max) * barWidth, height, 2 * uiScale.get());
        fg.endFill();
        fg.x = 0;
        fg.y = 0;
        fg.name = "fg";
      }

      drawTemp();
      group.addChild(barFg);

      group.y = -1 * tempHeight; // above the bar
      group.visible = stamina.temporary > 0;

      bar.addChild(group);
      bar.tempStamina = group;
    })();

    (() => {
      if (bar.staminaTicks) {
        return;
      }

      const tickCount = ratios.length;
      const tickWidth = 2 * uiScale.get();
      const tickHeight = barHeight - 2 * uiScale.get();
      const group = new PIXI.Container();
      group.name = "staminaTicks";
      for (let i = 0; i < tickCount; i++) {
        const tick = new PIXI.Graphics();
        tick.beginFill(i === 0 ? blendColors("#000", "orange", 0.5) : blendColors("#000", "red", 0.5));
        tick.drawRect(0, 0, tickWidth, tickHeight);
        tick.endFill();
        // Position ticks evenly spaced along the bar
        tick.pivot.set(tickWidth / 2, tickHeight / 2);
        const x = barWidth * ratios[i] - tickWidth / 2;
        tick.x = x;
        tick.y = barHeight / 2;
        group.addChild(tick);
      }
      bar.addChild(group);
      bar.staminaTicks = group;
    })();

    (() => {
      if (token.labelled) {
        token.getChildByName(token.labelled.name).destroy();
      }

      if (token.document.actor.type !== "hero") return;

      const group = new PreciseText("", { ...CONFIG.canvasTextStyle, fontSize: game.settings.get("ds-token-override", "healthLabelSize") * uiScale.get(), fill: blendColors("#ffffff", "#fff", 0.1) });
      group.name = "labelled";
      group.text = getFraction(stamina);
      group.anchor.set(0.5, 0.55);
      group.x = barWidth / 2;
      group.y = canvas.grid.size - bar.getChildByName("staminaTicks").getLocalBounds().height / 2;
      group.zIndex = Infinity;
      group.visible = false;
      token.addChild(group);
      token.labelled = group;
    })();
  }
}

function getFraction(stamina) {
  return `${stamina.value}${stamina.temporary > 0 ? ` + ${stamina.temporary}` : ""} / ${stamina.max}`;
}

function showFraction(token, state) {
  if (token.actor && token.actor.type === "hero") {
    const label = token.getChildByName("labelled");

    if (label) {
      label.visible = token.hudOpen || state;
    }
  }
}

Hooks.on("hoverToken", showFraction);

Hooks.on("renderTokenHUD", onHudRender);

Hooks.on("updateActor", (doc, updateData) => {
  // check if updateData includes any HERO paths
  const changedPaths = Object.keys(updateData?.system || {});
  const heroPaths = Object.values(HERO).map((stat) => stat.path);
  const shouldUpdate = heroPaths.some((path) => {
    // path like "hero.primary.value" => ["hero", "primary", "value"]
    const [first] = path.split(".");
    return changedPaths.includes(first);
  });
  if (!shouldUpdate) return;
});

function onHudRender(app, html, context) {
  const token = app.document.object;

  (() => {
    const stats = foundry.utils.getProperty(token.actor.system, "characteristics");
    if (!game.settings.get("ds-token-override", "showCharacteristics")) return;
    if (!stats) return;

    const container = html.querySelector(".col.right");
    let testHud = container.querySelector(".col.right.test-hud");

    if (!testHud) {
      testHud = document.createElement("div");
      container.insertAdjacentElement("beforeend", testHud);

      testHud.classList.add("col", "right", "test-hud");
      testHud.style = `
      position: absolute;
      right: -8px;
      transform: translateX(100%);
      z-index: -1;
      `;
    }

    const buttons = [];

    for (const key in stats) {
      const stat = stats[key];
      const val = stat.value;
      const button = document.createElement("button");
      button.classList.add("control-icon");
      button.style = `font-size: var(--font-size-16);`;
      button.textContent = `${key[0].toUpperCase()}${val}`;

      button.dataset.tooltip = `${key} (${val})`.capitalize();

      button.addEventListener("click", (evt) => {
        token.actor.rollCharacteristic(key);
      });
      buttons.push(button);
    }

    testHud.replaceChildren(...buttons);
  })();

  if ("hero" in app.document.actor.system) {
    token.hudOpen = true;

    Hooks.once("closeTokenHUD", () => {
      token.hudOpen = false;
      showFraction(token, false);
    });

    const container = html.querySelector(".attribute.bar2");

    let heroHud = container.querySelector(".hero-hud");
    if (!heroHud) {
      heroHud = document.createElement("div");
      container.insertAdjacentElement("afterbegin", heroHud);
      heroHud.classList.add("hero-hud");
      heroHud.style.display = "flex";
      heroHud.style.gap = "4px";
      container.style.display = "flex";
      container.style.gap = "8px";
      container.style.flexWrap = "wrap";
      container.style.height = "var(--control-size)";
      container.style.alignContent = "end";
    }

    const inputs = [];

    for (const key in HERO) {
      const stat = HERO[key];
      const val = foundry.utils.getProperty(app.document.actor.system, stat.path);
      const input = document.createElement("input");
      input.type = "text";
      input.name = stat.path;
      input.value = val;
      if (stat.max) {
        const maxVal = foundry.utils.getProperty(app.document.actor.system, stat.max);
        input.dataset.max = maxVal;
      }
      input.style = `
      flex: 1;
      padding: 0.2em;
      border-color: ${stat.color};
      width: 100%;
      box-shadow: 0 0 10px var(--color-shadow-dark);
      height: var(--control-size);
      line-height: var(--control-size);
      border-radius: 8px;
      font-size: var(--font-size-16);
      font-weight: bold;
      text-align: center;
      `;
      input.addEventListener("keypress", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          evt.target.blur();
        }
      });
      input.addEventListener("change", (evt) => {
        changeHudInput(evt, app, val);
      });
      input.addEventListener("focus", (evt) => evt.target.select());
      inputs.push(input);
    }

    heroHud.replaceChildren(...inputs);
  }
}

function changeHudInput(evt, app, oldValue) {
  evt.preventDefault();
  evt.stopPropagation();
  evt.stopImmediatePropagation();

  // handle deltas
  const input = evt.target.value;
  let newValue;

  if (input.startsWith("+") || input.startsWith("-")) {
    const delta = parseInt(input);
    newValue = oldValue + delta;
  } else {
    newValue = parseInt(input);
  }

  if (evt.target.dataset.max) {
    const max = parseInt(evt.target.dataset.max);
    if (newValue > max) newValue = max;
  }

  evt.target.value = isNaN(newValue) ? oldValue : newValue;
  app.document.actor.update({ ["system." + evt.target.name]: newValue });
}

function renderAttributes(token) {
  if (token.alpha < 1) return; // don't render on the ghosts you get when dragging your token

  const existing = token?.getChildByName?.("attribute-circles");
  if (existing) existing.destroy();

  if (!game.settings.get("ds-token-override", "showResources")) {
    return;
  }

  const container = new PIXI.Container();
  container.name = "attribute-circles";

  const userScale = game.settings.get("ds-token-override", "resourceLabelSize");
  const circleRadius = userScale * uiScale.get();
  const gap = Math.min(5, circleRadius * 0.4);
  const totalHeight = circleRadius * 2 * Object.keys(HERO).length + gap * (Object.keys(HERO).length - 1);
  const startY = (canvas.grid.size - totalHeight) / 2;
  const startX = canvas.grid.size - circleRadius; // right of token

  let i = 0;
  for (const key in HERO) {
    const stat = HERO[key];
    const value = foundry.utils.getProperty(token.actor.system, stat.path);
    const y = startY + i * (circleRadius * 2 + gap) + circleRadius;

    const circle = new PIXI.Graphics();
    circle.beginFill(blendColors("#000", stat.color, 0.25), 0.7);
    circle.lineStyle(1.5 * uiScale.get(), PIXI.utils.string2hex(stat.color), 1);
    circle.drawCircle(0, 0, circleRadius);
    circle.endFill();
    circle.x = startX;
    circle.y = y;

    const icon = new PreciseText("\uf004", {
      ...CONFIG.canvasTextStyle,
      fontFamily: "Font Awesome 6 Pro",
      fontSize: circleRadius * 1.05,
      fontWeight: "900",
      fill: PIXI.utils.string2hex(stat.color),
    });

    if (stat.icon) {
      icon.text = getFontAwesomeUnicode(stat.icon);
    }
    icon.anchor.set(0.5, 1);
    icon.x = -1 * circleRadius;
    icon.y = 0;
    circle.addChild(icon);

    const valueText = new PreciseText(value, {
      ...CONFIG.canvasTextStyle,
      fontSize: circleRadius * 1.25,
      fill: blendColors("#ffffff", stat.color, 0.1),
    });
    valueText.anchor.set(0.48, 0.53);
    valueText.x = 0;
    valueText.y = 0;
    circle.addChild(valueText);

    container.addChild(circle);
    i++;
  }

  token.addChild(container);
}

// Map FontAwesome class to unicode
function getFontAwesomeUnicode(className) {
  const map = {
    "fa-solid fa-heart-pulse": "\uf21e",
    "fa-solid fa-chevrons-up": "\uf325",
    "fa-solid fa-sparkles": "\uf890",
  };
  return map[className] || "\uf128"; // fallback: question mark
}

function blendColors(color1, color2, ratio) {
  // color1 and color2 are hex strings, ratio is 0..1 for color2
  const c1 = PIXI.utils.hex2rgb(PIXI.utils.string2hex(color1));
  const c2 = PIXI.utils.hex2rgb(PIXI.utils.string2hex(color2));
  const blended = c1.map((v, i) => (1 - ratio) * v + ratio * c2[i]);

  return PIXI.utils.rgb2hex(blended);
}

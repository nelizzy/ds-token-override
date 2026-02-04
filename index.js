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

Hooks.once("ready", () => {
  console.log("DS Token Override | Initializing DS Token Override");

  const originalDrawBars = Token.prototype.drawBars;
  Token.prototype.drawBars = async function (...args) {
    const result = await originalDrawBars.apply(this, args);
    if (this.actor && this.actor.type === "hero") {
      renderAttributes(this);
    }
    return result;
};
});

Hooks.on("renderTokenHUD", onHudRender);
Hooks.on("updateActor", (doc, updateData) => {
  // Check if updateData includes any HERO paths
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
  if ("hero" in app.document.actor.system) {
    const container = html.querySelector(".attribute.bar2");

    container.style.display = "flex";
    container.style.gap = "4px";
    container.style.width = "calc(100% - 8px)";

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

    container.replaceChildren(...inputs);
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
  // Ensure flags object exists
  if (!Object.hasOwn(window, "dsTokenOverride")) {
    window.dsTokenOverride = {};
  }

  if (window.dsTokenOverride[token.document.id]) return;

  if (token.alpha !== 1) return;

  console.log("Rendering attributes for token:", token);

  // Remove previous attribute circles if any
  const existing = token?.getChildByName?.("attribute-circles");
  if (existing) existing.destroy();

  // Create a container for the circles
  const container = new PIXI.Container();
  container.name = "attribute-circles";

  // Layout constants
  const circleRadius = 15;
  const gap = 4;
  const totalHeight = circleRadius * 2 * Object.keys(HERO).length + gap * (Object.keys(HERO).length - 1);
  const startY = (token.bars._bounds.maxY - totalHeight) / 2 - 2;
  const startX = token.bars._bounds.maxX - circleRadius; // right of token

  let i = 0;
  for (const key in HERO) {
    const stat = HERO[key];
    const value = foundry.utils.getProperty(token.actor.system, stat.path);
    const y = startY + i * (circleRadius * 2 + gap) + circleRadius;

    // Draw circle
    const circle = new PIXI.Graphics();
    circle.beginFill(blendColors("#000", stat.color, 0.25), 0.7);
    circle.lineStyle(1.5, PIXI.utils.string2hex(stat.color), 1);
    circle.drawCircle(0, 0, circleRadius);
    circle.endFill();
    circle.x = startX;
    circle.y = y;

    const PreciseText = foundry.canvas.containers.PreciseText || PIXI.Text;

    // Add icon (using FontAwesome SVG)
    const icon = new PreciseText(
      "\uf004",
      PreciseText.getTextStyle({
        fontFamily: "Font Awesome 6 Pro",
        fontSize: 16,
        fontWeight: "900",
        fill: PIXI.utils.string2hex(stat.color),
      }),
    );
    // Use stat.icon if available
    if (stat.icon) {
      icon.text = getFontAwesomeUnicode(stat.icon);
    }
    icon.anchor.set(0.5, 1);
    icon.x = -13;
    icon.y = 0;
    circle.addChild(icon);

    const valueText = new PreciseText(
      value,
      PreciseText.getTextStyle({
        fontSize: 20,
        fill: blendColors("#ffffff", stat.color, 0.1),
      }),
    );
    valueText.anchor.set(0.5, 0.5);
    valueText.x = 0;
    valueText.y = 0;
    circle.addChild(valueText);

    container.addChild(circle);
    i++;
  }

  // Add to token's icon container
  token.addChild(container);

  window.dsTokenOverride[token.document.id] = false;
}

// Helper: Map FontAwesome class to unicode (minimal, extend as needed)
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
  // Convert to hex
  return PIXI.utils.rgb2hex(blended);
}

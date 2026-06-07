import { ATTRIBUTES, ICON_GLYPH } from "../const.js";
import { blendColors, mod, settings, uiScale, PreciseText, onAllCanvasTokens } from "../utils.js";
import { makeOverlaySection } from "./_token.js";

export const tokenResource = makeOverlaySection({
  name: "ds-resources",
  isEnabled: async () => await settings.get("enableTokenResource"),
  // onInit: init,
  onCreate: create,
  onDraw: draw,
  onRescale: rescale,
  // onDestroy: destroy,
  onSetVisibility: setVisibility,
  hooks: [
    ["updateActor", onUpdate],
    ["renderDrawSteelTokenHUD", onRenderHUD]
  ]
})

tokenResource.position = position;

// trying classes just to see?

function create(tokenObj) {
  if (!tokenObj) return;
  const data = ATTRIBUTES[tokenObj.actor.type];
  if (!data) return;

  const container = new PIXI.Container();
  container.name = tokenResource.name;
  container.zIndex = Infinity;

  tokenObj.addChild(container);
  container._dsResource = new Set();

  const resources = Object.values(data).map((attribute, index) => {
    const resource = new Resource({ token: tokenObj, ...attribute, index });
    container._dsResource.add(resource);
    container.addChild(resource.circle);
  })
}

function draw(tokenObj) {
  const container = tokenResource.safeGet(tokenObj);

  container._dsResource.forEach(circle => {
    circle.draw();
    circle.update();
  })

  setVisibility(tokenObj);
}

function position(tokenObj) {
  const container = tokenResource.safeGet(tokenObj);
  if (!container) return;

  const radius = settings.get("tokenResourceSize") * uiScale.get();
  const count = container._dsResource?.size ?? 0;
  const gap = Math.min(5, radius * 0.4);
  const height = count > 0 ? (radius * 2 * count) + (gap * (count - 1)) : 0;

  container.x = tokenObj.w - radius;
  container.y = (tokenObj.h - height) / 2 + radius;
}

function rescale(tokenObj) {
  const container = tokenResource.safeGet(tokenObj);
  if (!container) return;

  container._dsResource.forEach(circle => {
    circle.draw();
  });

  position(tokenObj);
}

function setVisibility(tokenObj, force, user) {
  const container = tokenResource.safeGet(tokenObj);
  if (!container) return;

  const forceVisibilityFor = user === game.user.id ? force : undefined;
  const isPlayerOwned = tokenObj.document.hasPlayerOwner && tokenObj.actor?.type !== "npc";
  const isDirectlyOwned = tokenObj.document.isOwner && tokenObj.actor?.type !== "npc";
  const isActiveNpc = tokenObj.actor?.type === "npc" && (tokenObj.hover || tokenObj.controlled);
  const shouldSee = isPlayerOwned || isDirectlyOwned || isActiveNpc;
  const visible = forceVisibilityFor ?? shouldSee;

  container.visible = visible;
  container.renderable = visible;
}

function hasTrackedPath(type, diff) {
  const tracked = ATTRIBUTES[type];
  if (!tracked) return false;

  return Object.values(tracked).find(({ path }) => {
    return foundry.utils.getProperty(diff.system, path) !== undefined
  })
}

function getResourceByPath(tokenObj, path) {
  const container = tokenResource.safeGet(tokenObj);
  if (!container?._dsResource) return null;

  return Array.from(container._dsResource).find(resource => resource.path === path) ?? null;
}

function onUpdate(actor, diff) {
  const path = hasTrackedPath(actor.type, diff)?.path;
  if (!path) return;

  onAllCanvasTokens((tokenObj) => {
    if (!foundry.utils.equals(tokenObj.actor, actor)) return;

    const resource = getResourceByPath(tokenObj, path);
    resource?.update();
  })
}

function onRenderHUD(app, el, data, opts) {
  const tokenObj = app.object;
  const hud = tokenResource.safeGet(tokenObj)._dsResource._extraHUD;

  el.querySelector(".attribute.bar2").insertAdjacentElement("afterBegin", hud);
}

class Resource {
  constructor({ token, color, path, max, icon, index } = {}) {
    this.token = token;
    this.color = color;
    this.path = path;

    this.hudField = new HUDField(color, this);
    this.icon = new Icon(icon, color, this);
    this.label = new Label(color, this);

    const circle = new PIXI.Graphics();
    circle.addChild(this.icon.item)
    circle.addChild(this.label.item)

    this.circle = circle;
    this.index = index;
  }

  get gap() { return Math.min(5, this.radius * 0.4); }

  get radius() { return game?.settings?.get("ds-token-override", "tokenResourceSize") * uiScale.get() }

  adjustSpacing() {
    this.circle.y = (this.gap + this.radius * 2) * this.index;
  }

  get value() { return foundry.utils.getProperty(this.token.actor.system, this.path) }

  update() {
    this.label.text = this.value;
    this.hudField.value = this.value;
  }

  draw() {
    this.circle.clear();
    this.circle.beginFill(blendColors("#000", this.color, 0.25), 0.7);
    this.circle.lineStyle(1.5 * uiScale.get(), this.color);
    this.circle.drawCircle(0, 0, this.radius);
    this.circle.endFill()
    this.adjustSpacing();

    this.icon.draw(this.radius);
    this.label.draw(this.radius);
    this.label.text = this.value;
  }
}

class HUDField {
  constructor(color, resource) {
    const { path, value, token } = resource;
    this.path = path;
    this.token = token;

    this.el = document.createElement("input");
    this.el.type = "number"
    this.el.name = path;
    this.el.style.setProperty("--color", color);

    this.el.addEventListener("keypress", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        evt.target.blur();
      }
    });
    this.el.addEventListener("change", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      evt.stopImmediatePropagation();
      resource.token.actor.update({ [`system.${path}`]: evt.target.value });
    });
    this.el.addEventListener("focus", (evt) => evt.target.select());

    this.container;
  }

  get container() {
    const flag = tokenResource.safeGet(this.token);

    let el = flag._dsResource._extraHUD;
    if (!el) {
      el = document.createElement("div");
      el.classList.add("ds-override", "hero-hud");
    }

    el.appendChild(this.el);
    flag._dsResource._extraHUD = el;
    return el;
  }

  get tokenHud() { }

  set value(value) {
    this.el.value = value
  }
}

class Icon {
  constructor(glyph, color, circle) {
    const item = new PreciseText(ICON_GLYPH["default"], {
      ...CONFIG.canvasTextStyle,
      fontFamily: ["Font Awesome 7 Pro", "Font Awesome 6 Pro"],
      fontSize: circle.radius * 1.05,
      fontWeight: "900",
      fill: color
    });

    if (glyph) item.text = glyph;

    item.anchor.set(0.5, 1);
    item.x = -1 * circle.radius;
    item.y = 0;

    this.item = item;
  }

  draw(radius) {
    this.item.style.fontSize = radius * 1.05
  }
}

class Label {
  constructor(color, circle) {
    const item = new PreciseText("", {
      ...CONFIG.canvasTextStyle,
      fontSize: circle.radius * 1.25,
      fill: blendColors("#fff", color, 0.1),
    });

    item.anchor.set(0.48, 0.53);
    item.x = 0;
    item.y = 0;

    this.item = item;
  }

  draw(radius) {
    this.item.style.fontSize = radius * 1.25
  }

  set text(text) {
    this.item.text = text;
  }
}

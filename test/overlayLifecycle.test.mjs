import assert from "node:assert/strict";
import test from "node:test";

function installFoundryMocks() {
  const calls = [];
  const listeners = new Map();
  let nextId = 1;

  globalThis.Hooks = {
    on(name, fn) {
      const id = nextId++;
      listeners.set(id, { name, fn, once: false });
      calls.push(["on", name, fn]);
      return id;
    },
    once(name, fn) {
      const id = nextId++;
      listeners.set(id, { name, fn, once: true });
      calls.push(["once", name, fn]);
      return id;
    },
    off(name, id) {
      const existing = listeners.get(id);
      if (existing?.name === name) listeners.delete(id);
      calls.push(["off", name, id]);
    },
    _calls: calls,
    _listeners: listeners
  };

  globalThis.foundry = {
    canvas: { containers: {} },
    utils: {
      getProperty(source, path) {
        return path.split(".").reduce((value, key) => value?.[key], source);
      },
      equals(left, right) {
        return left === right;
      }
    }
  };

  globalThis.PIXI = {
    Text: class Text {},
    Container: class Container {
      constructor() {
        this.children = [];
        this.name = "";
      }
      addChild(child) {
        this.children.push(child);
        return child;
      }
      getChildByName(name) {
        return this.children.find((child) => child.name === name) ?? null;
      }
    },
    Graphics: class Graphics {},
    utils: {
      hex2rgb() {
        return [0, 0, 0];
      },
      string2hex() {
        return 0;
      },
      rgb2hex() {
        return 0;
      }
    }
  };

  globalThis.CONFIG = {
    canvasTextStyle: {},
    Combatant: { documentClass: class CombatantDocument {} },
    CombatantGroup: { documentClass: class CombatantGroupDocument {} },
    Item: { dataModels: { ability: class AbilityModel {} } }
  };
  globalThis.CONFIG.Item.dataModels.ability.prototype.getTargetModifiers = () => ({ edges: 0 });

  globalThis.game = {
    settings: {
      get() {
        return true;
      }
    },
    user: {
      id: "user-1",
      isGM: true,
      hasRole() {
        return true;
      }
    }
  };

  globalThis.canvas = {
    grid: { size: 140 },
    tokens: { placeables: [] }
  };
}

function makeToken() {
  return {
    children: [],
    bars: {
      children: [],
      bar1: {
        children: [],
        getChildByName(name) {
          return this.children.find((child) => child.name === name) ?? null;
        }
      },
      getChildByName(name) {
        return this.children.find((child) => child.name === name) ?? null;
      }
    },
    addChild(child) {
      this.children.push(child);
      return child;
    },
    getChildByName(name) {
      return this.children.find((child) => child.name === name) ?? null;
    }
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("makeOverlaySection attaches each hook only once", async () => {
  installFoundryMocks();
  const { makeOverlaySection } = await import("../script/tokenMods/_token.js?hooks");
  const handler = () => {};
  const section = makeOverlaySection({
    name: "test-overlay-hooks",
    isEnabled: () => true,
    hooks: [["updateActor", handler]]
  });

  await section.init();
  section.enable("user-1");
  section.enable("user-1");

  let onCalls = Hooks._calls.filter(([kind, name]) => kind === "on" && name === "updateActor");
  assert.equal(onCalls.length, 1);

  section.disable("user-1");

  const offCalls = Hooks._calls.filter(([kind, name]) => kind === "off" && name === "updateActor");
  assert.equal(offCalls.length, 1);
  assert.equal(Hooks._listeners.size, 0);

  section.enable("user-1");

  onCalls = Hooks._calls.filter(([kind, name]) => kind === "on" && name === "updateActor");
  assert.equal(onCalls.length, 2);
  assert.equal(Hooks._listeners.size, 1);
});

test("makeOverlaySection creates one display object per token", async () => {
  installFoundryMocks();
  const { makeOverlaySection } = await import("../script/tokenMods/_token.js?create");
  const tokenA = makeToken();
  const tokenB = makeToken();
  let createCalls = 0;
  let drawCalls = 0;
  let rescaleCalls = 0;

  const section = makeOverlaySection({
    name: "test-overlay-create",
    isEnabled: () => true,
    onCreate(tokenObj) {
      createCalls += 1;
      tokenObj.addChild({ name: "test-overlay-create", destroy() {} });
    },
    onDraw() {
      drawCalls += 1;
    },
    onRescale() {
      rescaleCalls += 1;
    }
  });

  await section.create(tokenA);
  await section.create(tokenA);
  await section.create(tokenB);
  await section.create(tokenB);

  assert.equal(createCalls, 2);
  assert.equal(drawCalls, 4);
  assert.equal(rescaleCalls, 4);
  assert.equal(tokenA.children.filter((child) => child.name === "test-overlay-create").length, 1);
  assert.equal(tokenB.children.filter((child) => child.name === "test-overlay-create").length, 1);
});

test("makeOverlaySection forceInit does not register global token hooks", async () => {
  installFoundryMocks();
  const { makeOverlaySection } = await import("../script/tokenMods/_token.js?forceInit");
  const token = makeToken();
  canvas.tokens.placeables = [token];
  let createCalls = 0;

  const section = makeOverlaySection({
    name: "test-overlay-force",
    isEnabled: () => true,
    onCreate(tokenObj) {
      createCalls += 1;
      tokenObj.addChild({ name: "test-overlay-force", destroy() {} });
    },
    hooks: [["updateActor", () => {}]]
  });

  await section.forceInit();
  await section.forceInit();
  await flushAsyncWork();

  const globalHookCalls = Hooks._calls.filter(([, name]) =>
    ["drawToken", "refreshToken", "updateCombatantGroup"].includes(name)
  );
  const sectionHookCalls = Hooks._calls.filter(([kind, name]) => kind === "on" && name === "updateActor");

  assert.equal(globalHookCalls.length, 0);
  assert.equal(sectionHookCalls.length, 1);
  assert.equal(createCalls, 1);
  assert.equal(token.children.filter((child) => child.name === "test-overlay-force").length, 1);
});

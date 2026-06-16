import assert from "node:assert/strict";
import test from "node:test";

function installFoundryMocks({ isGM = false, settings = {} } = {}) {
  const listeners = [];

  globalThis.Hooks = {
    on(name, fn) {
      listeners.push({ name, fn });
      return listeners.length;
    },
    once(name, fn) {
      listeners.push({ name, fn, once: true });
      return listeners.length;
    },
    off() {},
    _listeners: listeners
  };

  globalThis.foundry = {
    canvas: { containers: {} },
    utils: {
      equals(left, right) {
        return left === right;
      },
      getProperty(source, path) {
        return path.split(".").reduce((value, key) => value?.[key], source);
      }
    }
  };

  globalThis.PIXI = {
    Text: class Text {},
    Graphics: class Graphics {},
    Container: class Container {}
  };

  globalThis.CONFIG = {
    canvasTextStyle: {},
    CombatantGroup: {
      documentClass: class CombatantGroupDocument {}
    }
  };

  globalThis.game = {
    user: {
      id: "player-1",
      isGM,
      hasRole() {
        return true;
      }
    },
    settings: {
      get(_moduleId, key) {
        return settings[key] ?? false;
      }
    }
  };

  globalThis.canvas = {
    grid: { size: 140 },
    tokens: { placeables: [] }
  };
}

function importFresh(path) {
  return import(`${path}?test=${crypto.randomUUID()}`);
}

test("player clients redraw minion stamina without writing CombatantGroup flags", async () => {
  installFoundryMocks({
    isGM: false,
    settings: {
      enableHealthbarTicks: false,
      enableHealthbarLabels: true,
      healthLabelPlayersMinimumPerm: 1,
      healthLabelOtherMinimumPerm: 1
    }
  });

  const label = { text: "" };
  const minionActor = {
    isMinion: true,
    system: {
      combatGroup: {
        system: { staminaMax: 12, staminaValue: 10 }
      }
    }
  };
  const tokenObject = {
    actor: minionActor,
    getChildByName(name) {
      return name === "ds-health-labels" ? label : null;
    },
    bars: {
      getChildByName() {
        return null;
      },
      bar1: {
        getChildByName() {
          return null;
        }
      }
    }
  };
  const minions = new Map([["minion-1", { token: { object: tokenObject } }]]);
  const setFlagCalls = [];
  const combatantGroup = {
    system: { minions, staminaMax: 12, staminaValue: 10 },
    async getFlag(_moduleId, key) {
      assert.equal(key, "lastStamina");
      return { staminaMax: 12, staminaValue: 12 };
    },
    async setFlag(_moduleId, key, value) {
      setFlagCalls.push({ key, value });
      throw new Error("player lacks permission to update CombatantGroup");
    }
  };

  const tokenModule = await importFresh("../script/tokenMods/_token.js");
  await tokenModule.init();

  const groupUpdate = Hooks._listeners.find(({ name }) => name === "updateCombatantGroup");
  assert.ok(groupUpdate);

  await assert.doesNotReject(() => groupUpdate.fn(combatantGroup));
  assert.equal(label.text, "10 / 12");
  assert.deepEqual(setFlagCalls, []);
});

test("player clients preserve group token updates without writing CombatantGroup color flags", async () => {
  installFoundryMocks({
    isGM: false,
    settings: { enableTrackerMods: true }
  });

  const originalCalls = [];
  CONFIG.CombatantGroup.documentClass.prototype.updateTokens = async function (...args) {
    originalCalls.push(args);
    return "updated";
  };

  const setFlagCalls = [];
  const combatTracker = await importFresh("../script/combatTracker.js");
  await combatTracker.init();

  const group = new CONFIG.CombatantGroup.documentClass();
  group.setFlag = async function (_moduleId, key, value) {
    setFlagCalls.push({ key, value });
    throw new Error("player lacks permission to update CombatantGroup");
  };

  const result = await group.updateTokens("texture.tint", "#ff0000");

  assert.equal(result, "updated");
  assert.deepEqual(originalCalls, [["texture.tint", "#ff0000"]]);
  assert.deepEqual(setFlagCalls, []);
});

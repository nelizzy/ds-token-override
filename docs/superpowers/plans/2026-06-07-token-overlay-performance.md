# Token Overlay Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore stable FPS on Draw Steel scenes with more than 10 tokens by removing unnecessary token overlay redraws, preventing duplicate overlay lifecycle work, and limiting always-visible NPC resource overlays.

**Architecture:** Keep the existing Foundry module structure and `makeOverlaySection` abstraction, but make overlay creation idempotent, hook attachment idempotent, and refresh handling dirty-based. Resource overlays should update values only when actor data changes, reposition only when token/bar geometry changes, and avoid rendering all GM-owned NPC resource bubbles all the time.

**Tech Stack:** Foundry VTT v13/v14 ES modules, Draw Steel system APIs, PIXI display objects, Foundry Hooks, Node.js built-in syntax checks and `node:test` for lifecycle unit tests with mocked Foundry globals.

---

## File Structure

- Modify `package.json`
  - Change package mode to ESM for local Node checks.
  - Add `check:syntax` and `test` scripts.
- Create `test/overlayLifecycle.test.mjs`
  - Unit-test the overlay lifecycle helper with mocked `Hooks`, `game`, `foundry`, `PIXI`, `CONFIG`, and `canvas`.
- Modify `script/tokenMods/_token.js`
  - Make hook attachment/detachment idempotent.
  - Make overlay `create()` idempotent per token.
  - Split draw-heavy refresh work from geometry-only reposition work.
  - Fix missing `await` in minion stamina flag lookup.
- Modify `script/tokenMods/tokenResource.js`
  - Add a geometry-only position function.
  - Stop redrawing resource circles during token refresh.
  - Fix `Set.find()` runtime error.
  - Limit constant NPC resource visibility for GMs to hover/controlled/HUD, while keeping player-owned and owned character tokens visible.
- Modify `script/tokenMods/healthLabels.js`
  - Cache permission checks used by hover/highlight visibility.
  - Keep highlight visibility changes synchronous after cache refresh.
- Modify `script/quickFixes.js`
  - Guard minion healthbar animation so it only runs when a minion group stamina update actually changes bar data.

## Baseline Commands

Run these before editing and paste the output into the implementation notes for comparison:

```bash
git status --short --branch
git remote -v
```

Expected:

```text
## codex/perf-token-overlays
fork    git@github.com:CrownBerry/ds-token-override.git (fetch)
fork    git@github.com:CrownBerry/ds-token-override.git (push)
origin  git@github.com:nelizzy/ds-token-override.git (fetch)
origin  git@github.com:nelizzy/ds-token-override.git (push)
```

In Foundry, open a scene with at least 10 NPC/minion tokens as GM and run:

```js
(() => {
  const countByName = (root, name) => {
    let count = 0;
    root?.children?.forEach?.((child) => {
      if (child.name === name) count += 1;
      count += countByName(child, name);
    });
    return count;
  };

  const tokenCount = canvas.tokens.placeables.length;
  const resources = canvas.tokens.placeables.reduce((sum, token) => sum + countByName(token, "ds-resources"), 0);
  const labels = canvas.tokens.placeables.reduce((sum, token) => sum + countByName(token, "ds-health-labels"), 0);
  const ticks = canvas.tokens.placeables.reduce((sum, token) => sum + countByName(token, "ds-ticks"), 0);

  console.table({ tokenCount, resources, labels, ticks });
})();
```

Expected before fixes on a large GM scene:

```text
tokenCount is greater than 10.
resources is close to the number of hero, retainer, and npc tokens with supported attributes.
FPS is around 20-25 according to Foundry's performance display or browser devtools.
```

### Task 1: Add Local Test and Syntax Tooling

**Files:**
- Modify: `package.json`
- Create: `test/overlayLifecycle.test.mjs`

- [ ] **Step 1: Replace `package.json` with ESM-aware scripts**

Use this exact content:

```json
{
  "name": "ds-token-override",
  "version": "1.0.0",
  "description": "Provide an intuitive overlay for Foundry Draw Steel tokens",
  "main": "script/index.js",
  "scripts": {
    "check:syntax": "find script -name '*.js' -print0 | xargs -0 -n1 node --check",
    "test": "node --test test/*.test.mjs"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module"
}
```

- [ ] **Step 2: Create the failing lifecycle tests**

Create `test/overlayLifecycle.test.mjs` with this exact content:

```js
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

  const onCalls = Hooks._calls.filter(([kind, name]) => kind === "on" && name === "updateActor");
  assert.equal(onCalls.length, 1);
});

test("makeOverlaySection creates one display object per token", async () => {
  installFoundryMocks();
  const { makeOverlaySection } = await import("../script/tokenMods/_token.js?create");
  const token = makeToken();
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

  await section.create(token);
  await section.create(token);

  assert.equal(createCalls, 1);
  assert.equal(drawCalls, 2);
  assert.equal(rescaleCalls, 2);
  assert.equal(token.children.filter((child) => child.name === "test-overlay-create").length, 1);
});
```

- [ ] **Step 3: Run tests to verify current behavior fails**

Run:

```bash
npm test
```

Expected:

```text
not ok 1 - makeOverlaySection attaches each hook only once
not ok 2 - makeOverlaySection creates one display object per token
```

- [ ] **Step 4: Commit tooling and failing tests**

Run:

```bash
git add package.json test/overlayLifecycle.test.mjs
git commit -m "test: add overlay lifecycle regression tests"
```

Expected:

```text
[codex/perf-token-overlays ...] test: add overlay lifecycle regression tests
```

### Task 2: Make Overlay Lifecycle Idempotent

**Files:**
- Modify: `script/tokenMods/_token.js`
- Test: `test/overlayLifecycle.test.mjs`

- [ ] **Step 1: Replace `hookHandler` in `makeOverlaySection`**

In `script/tokenMods/_token.js`, replace the current `hookHandler` block with:

```js
  const hookHandler = (() => {
    const attachedHooks = new Map();

    function keyFor(hookName, fn, isOnce) {
      return `${hookName}:${isOnce ? "once" : "on"}:${fn.name || "anonymous"}`;
    }

    function attach() {
      hooks.forEach(([hookName, fn, isOnce]) => {
        const key = keyFor(hookName, fn, isOnce);
        if (attachedHooks.has(key)) return;

        attachedHooks.set(key, {
          hookName,
          id: isOnce ? Hooks.once(hookName, fn) : Hooks.on(hookName, fn)
        });
      });
    }

    function detach() {
      attachedHooks.forEach(({ hookName, id }) => {
        Hooks.off(hookName, id);
      });
      attachedHooks.clear();
    }

    return { attach, detach, list: hooks }
  })();
```

- [ ] **Step 2: Replace `create()` in returned overlay object**

In `script/tokenMods/_token.js`, replace the returned object's `create` method with:

```js
    async create(tokenObj) {
      if (!(await isEnabled())) return;

      if (!safeGet(tokenObj)) {
        onCreate(tokenObj);
      }

      onDraw(tokenObj);
      onRescale(tokenObj);

      _isCreated = true;
    },
```

- [ ] **Step 3: Run lifecycle tests**

Run:

```bash
npm test
```

Expected:

```text
ok 1 - makeOverlaySection attaches each hook only once
ok 2 - makeOverlaySection creates one display object per token
```

- [ ] **Step 4: Run syntax checks**

Run:

```bash
npm run check:syntax
```

Expected:

```text
No output and exit code 0.
```

- [ ] **Step 5: Commit lifecycle fix**

Run:

```bash
git add script/tokenMods/_token.js test/overlayLifecycle.test.mjs
git commit -m "fix: make token overlay lifecycle idempotent"
```

Expected:

```text
[codex/perf-token-overlays ...] fix: make token overlay lifecycle idempotent
```

### Task 3: Remove Resource Redraws From Token Refresh

**Files:**
- Modify: `script/tokenMods/_token.js`
- Modify: `script/tokenMods/tokenResource.js`

- [ ] **Step 1: Add a position-only method to `tokenResource`**

In `script/tokenMods/tokenResource.js`, replace the current `rescale` function with these functions:

```js
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
```

Then add this export assignment after the `makeOverlaySection` call:

```js
tokenResource.position = position;
```

- [ ] **Step 2: Replace resource redraw during `refreshToken`**

In `script/tokenMods/_token.js`, replace the `if (flags.refreshBars)` block with:

```js
  if (flags.refreshBars) {
    const barSize = tokenObj.bars.bar1.getLocalBounds();
    const tokenWidth = tokenObj.w;
    const tokenHeight = tokenObj.h;

    const sameGeometry =
      tokenObj._dsBarWidth === barSize.width
      && tokenObj._dsBarHeight === barSize.height
      && tokenObj._dsTokenWidth === tokenWidth
      && tokenObj._dsTokenHeight === tokenHeight;

    if (sameGeometry) return;

    tokenObj._dsBarWidth = barSize.width;
    tokenObj._dsBarHeight = barSize.height;
    tokenObj._dsTokenWidth = tokenWidth;
    tokenObj._dsTokenHeight = tokenHeight;

    tokenResource.position(tokenObj);
    healthLabels.rescale(tokenObj, { barSize });
    healthbarTicks.rescale(tokenObj, { barSize });
  }
```

- [ ] **Step 3: Run syntax checks**

Run:

```bash
npm run check:syntax
```

Expected:

```text
No output and exit code 0.
```

- [ ] **Step 4: Commit refresh-path optimization**

Run:

```bash
git add script/tokenMods/_token.js script/tokenMods/tokenResource.js
git commit -m "perf: avoid resource redraws during token refresh"
```

Expected:

```text
[codex/perf-token-overlays ...] perf: avoid resource redraws during token refresh
```

### Task 4: Fix Resource Updates and NPC Visibility

**Files:**
- Modify: `script/tokenMods/tokenResource.js`

- [ ] **Step 1: Add resource lookup helper**

In `script/tokenMods/tokenResource.js`, add this function below `hasTrackedPath`:

```js
function getResourceByPath(tokenObj, path) {
  const container = tokenResource.safeGet(tokenObj);
  if (!container?._dsResource) return null;

  return Array.from(container._dsResource).find(resource => resource.path === path) ?? null;
}
```

- [ ] **Step 2: Replace `onUpdate` with Set-safe lookup**

Replace the current `onUpdate` function with:

```js
function onUpdate(actor, diff) {
  const path = hasTrackedPath(actor.type, diff)?.path;
  if (!path) return;

  onAllCanvasTokens((tokenObj) => {
    if (!foundry.utils.equals(tokenObj.actor, actor)) return;

    const resource = getResourceByPath(tokenObj, path);
    resource?.update();
  });
}
```

- [ ] **Step 3: Replace `setVisibility` to avoid always-rendered GM NPC overlays**

Replace the current `setVisibility` function with:

```js
function setVisibility(tokenObj, force, user) {
  const container = tokenResource.safeGet(tokenObj);
  if (!container) return;

  const forceVisibilityFor = user === game.user.id ? force : undefined;
  const isPlayerOwned = tokenObj.document.hasPlayerOwner;
  const isDirectlyOwned = tokenObj.document.isOwner && tokenObj.actor?.type !== "npc";
  const isActiveNpc = tokenObj.actor?.type === "npc" && (tokenObj.hover || tokenObj.controlled);
  const shouldSee = isPlayerOwned || isDirectlyOwned || isActiveNpc;
  const visible = forceVisibilityFor ?? shouldSee;

  container.visible = visible;
  container.renderable = visible;
}
```

- [ ] **Step 4: Run syntax checks**

Run:

```bash
npm run check:syntax
```

Expected:

```text
No output and exit code 0.
```

- [ ] **Step 5: Commit resource update and visibility fix**

Run:

```bash
git add script/tokenMods/tokenResource.js
git commit -m "perf: limit npc resource overlay visibility"
```

Expected:

```text
[codex/perf-token-overlays ...] perf: limit npc resource overlay visibility
```

### Task 5: Cache Health Label Visibility Permissions

**Files:**
- Modify: `script/tokenMods/healthLabels.js`

- [ ] **Step 1: Add cached permission state**

In `script/tokenMods/healthLabels.js`, add this block above `healthLabels._enabledStatus = undefined;`:

```js
let _permissionCache = null;

function clearPermissionCache() {
  _permissionCache = null;
}
```

- [ ] **Step 2: Replace `permCheck` with cached settings reads**

Replace the current `permCheck` function with:

```js
async function permCheck({ players, others } = {}) {
  if (players === undefined && others === undefined && _permissionCache) {
    return _permissionCache;
  }

  players ??= settings.get("healthLabelPlayersMinimumPerm");
  others ??= settings.get("healthLabelOtherMinimumPerm");
  const both = ((a, b) => (a === 0 ? b : b === 0 ? a : Math.min(a, b)))(players, others);

  const result = {
    players: perm(players),
    others: perm(others),
    both: perm(both)
  };

  if (players !== undefined && others !== undefined) {
    _permissionCache = result;
  }

  return result;
}
```

- [ ] **Step 3: Clear cache on disable and alignment/size setting paths**

Replace `disable()` with:

```js
function disable() {
  healthLabels._enabledStatus = false;
  clearPermissionCache();
}
```

Then replace `healthLabels.setAlignment` with:

```js
healthLabels.setAlignment = (userAlignment) => {
  userAlignment ??= settings.get("healthLabelAlignment");
  const alignment = ALIGNMENT_CONFIG[userAlignment];
  healthLabels._alignment = alignment;
}
```

This keeps alignment behavior unchanged while making the cache lifecycle explicit in the file.

- [ ] **Step 4: Run syntax checks**

Run:

```bash
npm run check:syntax
```

Expected:

```text
No output and exit code 0.
```

- [ ] **Step 5: Commit health label permission cache**

Run:

```bash
git add script/tokenMods/healthLabels.js
git commit -m "perf: cache health label permission checks"
```

Expected:

```text
[codex/perf-token-overlays ...] perf: cache health label permission checks
```

### Task 6: Stabilize Minion Group Refresh Work

**Files:**
- Modify: `script/tokenMods/_token.js`
- Modify: `script/quickFixes.js`

- [ ] **Step 1: Fix async flag lookup in `trackHealthMinions`**

In `script/tokenMods/_token.js`, replace:

```js
  const lastStamina = grpFlags.get("lastStamina");
```

with:

```js
  const lastStamina = await grpFlags.get("lastStamina") ?? {};
```

- [ ] **Step 2: Guard minion healthbar animation by stamina updates**

In `script/quickFixes.js`, replace the monkey-patched `refreshCombatant` body with:

```js
    CONFIG.Combatant.documentClass.prototype.refreshCombatant = function (...args) {
      const hasMinionGroup = this.actor.system.combatGroups.size === 1;
      const previousBarValue = this.token?.object?.bars?.bar1?.value;

      old.call(this, ...args);

      const nextBarValue = this.token?.object?.bars?.bar1?.value;
      const barChanged = previousBarValue !== nextBarValue;

      if (hasMinionGroup && barChanged) {
        this.token?._prepareBars();
        this.token?.object?.animate(this.token?.object?._getAnimationData());
      }
    }
```

- [ ] **Step 3: Run syntax checks**

Run:

```bash
npm run check:syntax
```

Expected:

```text
No output and exit code 0.
```

- [ ] **Step 4: Commit minion refresh stabilization**

Run:

```bash
git add script/tokenMods/_token.js script/quickFixes.js
git commit -m "perf: reduce minion healthbar refresh work"
```

Expected:

```text
[codex/perf-token-overlays ...] perf: reduce minion healthbar refresh work
```

### Task 7: Foundry Manual Verification

**Files:**
- No code changes unless verification exposes a regression.

- [ ] **Step 1: Run local checks**

Run:

```bash
npm test
npm run check:syntax
```

Expected:

```text
All node:test tests pass.
Syntax check exits with code 0.
```

- [ ] **Step 2: Install the branch module in Foundry**

Use the local module checkout or a symlink from Foundry's module directory to this repository. Start Foundry, enable `Draw Steel: Token Override`, and open a scene with more than 10 NPC/minion tokens as GM.

- [ ] **Step 3: Verify overlay counts and FPS**

Run the baseline console snippet again.

Expected after fixes:

```text
resources count remains one container per supported token, not duplicate containers.
NPC resource containers exist but are not renderable until the NPC token is hovered or controlled.
FPS is materially higher than the 20-25 FPS baseline on the same scene.
```

- [ ] **Step 4: Verify resource behavior**

As GM:

```text
Hover an NPC token.
Expected: speed, stability, and free strike resource bubbles become visible.

Move the cursor away from the NPC token.
Expected: NPC resource bubbles stop rendering.

Select or hover a hero token.
Expected: hero resource bubbles remain visible as before.

Change a hero's surges or heroic resource value.
Expected: only that displayed value updates; no duplicate resource containers appear.
```

- [ ] **Step 5: Verify health labels and ticks**

As GM and as a player:

```text
Hover a token with stamina bar 1.
Expected: health label visibility follows module permission settings.

Target multiple tokens so Foundry fires highlight hooks.
Expected: labels show or hide without visible stutter on scenes with more than 10 tokens.

Damage a minion group.
Expected: healthbar ticks and labels update once and remain aligned with the stamina bar.
```

- [ ] **Step 6: Commit verification notes if docs are updated**

If verification notes are added to `README.md`, run:

```bash
git add README.md
git commit -m "docs: document token overlay performance behavior"
```

Expected when docs are changed:

```text
[codex/perf-token-overlays ...] docs: document token overlay performance behavior
```

Expected when docs are not changed:

```text
No commit is needed for this step.
```

### Task 8: Push Branch and Prepare Upstream PR

**Files:**
- No code changes.

- [ ] **Step 1: Inspect final branch state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -n 8
```

Expected:

```text
## codex/perf-token-overlays
Working tree is clean.
Recent commits include the test, lifecycle, refresh, visibility, health label, and minion performance commits.
```

- [ ] **Step 2: Push to fork**

Run:

```bash
git push -u fork codex/perf-token-overlays
```

Expected:

```text
branch 'codex/perf-token-overlays' set up to track 'fork/codex/perf-token-overlays'
```

- [ ] **Step 3: Create draft PR from fork to upstream**

Run:

```bash
gh pr create \
  --repo nelizzy/ds-token-override \
  --head CrownBerry:codex/perf-token-overlays \
  --base main \
  --draft \
  --title "Improve token overlay performance on large scenes" \
  --body "Reduces token overlay redraw work on large Draw Steel scenes by making overlay lifecycle hooks idempotent, removing resource redraws from token refresh, limiting always-rendered GM NPC resource bubbles, caching health label visibility permissions, and reducing minion healthbar refresh work."
```

Expected:

```text
https://github.com/nelizzy/ds-token-override/pull/<number>
```

## Self-Review

- Spec coverage: The plan covers the confirmed large-scene GM FPS problem, resource overlay redraws, duplicate lifecycle work, NPC visibility, health label visibility overhead, and minion group refresh spikes.
- Placeholder scan: The plan uses concrete files, commands, code snippets, and expected results. It does not use deferred implementation markers.
- Type consistency: Function names used across tasks are consistent: `position`, `rescale`, `getResourceByPath`, `permCheck`, and `clearPermissionCache`.
- Scope check: This is one focused performance plan for token overlays and directly related minion refresh work. Combat tracker, quick roll, damage log, and high-ground automation remain out of scope unless verification shows a separate performance issue.

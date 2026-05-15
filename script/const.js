// used for settings, flags, and socket actions
export const MODULE_ID = "ds-token-override";

const ICON_GLYPH = {
  "heart-pulse": "\uf21e",
  "chevrons-up": "\uf325",
  "sparkles": "\uf890",
  "boot": "\uf782",
  "anchor": "\uf13d",
  "sword": "\uf71c",
  "default": "\uf128",
};

export const ATTRIBUTES = {
  hero: {
    recoveries: {
      path: "recoveries.value",
      max: "recoveries.max",
      icon: ICON_GLYPH["heart-pulse"],
      color: "#85c4dc",
    },
    surges: {
      path: "hero.surges",
      icon: ICON_GLYPH["fa-chevrons-up"],
      color: "#cd8eee",
    },
    heroic_resource: {
      path: "hero.primary.value",
      icon: ICON_GLYPH["fa-sparkles"],
      color: "#ffe493",
    },
  },

  npc: {
    speed: {
      path: "movement.value",
      icon: ICON_GLYPH["fa-boot"],
      color: "#74c578ff",
    },
    stability: {
      path: "combat.stability",
      icon: ICON_GLYPH["fa-anchor"],
      color: "#e28c53ff",
    },
    freestrike: {
      path: "monster.freeStrike",
      icon: ICON_GLYPH["fa-sword"],
      color: "#d04444ff",
    },
  },

  retainer: {
    recoveries: {
      path: "recoveries.value",
      max: "recoveries.max",
      icon: ICON_GLYPH["fa-heart-pulse"],
      color: "#85c4dc",
    },
    speed: {
      path: "movement.value",
      icon: ICON_GLYPH["fa-boot"],
      color: "#74c578ff",
    },
    stability: {
      path: "combat.stability",
      icon: ICON_GLYPH["fa-anchor"],
      color: "#e28c53ff",
    },
  },
};
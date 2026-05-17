import { mod, settings } from "../utils.js";
import { makeOverlaySection } from "./_token.js";

export const tokenResource = makeOverlaySection({
  name: "ds-resources",
  isEnabled: async () => await settings.get("enableTokenResource"),
  // onInit: init,
  // onCreate: create,
  // onDraw: draw,
  // onRescale: rescale,
  // onDestroy: destroy,
  // onSetVisibility: setVisibility,
  hooks: []
})
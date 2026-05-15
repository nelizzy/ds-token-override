import { settings } from "./utils.js";

export const init = async () => {
  if (!await settings.get("enableTrackerMods")) return;

}

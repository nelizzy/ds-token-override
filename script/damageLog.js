import { settings } from "./utils";

export const init = async () => {
  if (!await settings.get("enableDamageLog")) return;

}
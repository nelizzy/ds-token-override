import { settings } from "./utils";

export const init = async () => {
  tokenResource.init();
  hudRolls.init();
  healthLabels.init();
}

/* ---------------------------- RELEVANT SETTINGS ---------------------------
  ALLOW ONCHANGE() WITHOUT RELOAD
- enableHudRolls (boolean)

- enableTokenResource (boolean)
- tokenResourceSize (number)

- healthLabelPlayersMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelOtherMinimumPerm (string: CONST.USER_ROLE_NAMES)
- healthLabelSize (number)
*/

// Might refactor to split these three out further? :thonk:

export const tokenResource = (() => {

  return { init };
})();

export const hudRolls = (() => {

  return { init };
})();

export const healthLabels = (() => {

  return { init };
})();
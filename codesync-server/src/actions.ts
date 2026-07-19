/**
 * Server-side re-export of shared Socket.IO action constants.
 *
 * DO NOT add actions here — add them in shared/actions.ts instead.
 * This file exists so server imports stay local: `./actions.js`.
 */
export { ACTIONS, type ActionsType as ACTIONS_TYPE } from "../../shared/actions.js";

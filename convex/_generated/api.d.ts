/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as admin from "../admin.js";
import type * as avatars from "../avatars.js";
import type * as bots from "../bots.js";
import type * as engine from "../engine.js";
import type * as game from "../game.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_phases from "../lib/phases.js";
import type * as lib_promptUtils from "../lib/promptUtils.js";
import type * as lib_utils from "../lib/utils.js";
import type * as lobby from "../lobby.js";
import type * as scenarios from "../scenarios.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  admin: typeof admin;
  avatars: typeof avatars;
  bots: typeof bots;
  engine: typeof engine;
  game: typeof game;
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/phases": typeof lib_phases;
  "lib/promptUtils": typeof lib_promptUtils;
  "lib/utils": typeof lib_utils;
  lobby: typeof lobby;
  scenarios: typeof scenarios;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

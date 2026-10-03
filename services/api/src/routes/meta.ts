import { PROTOCOL_VERSION } from "@etchess/realtime-protocol";
import { PRODUCT_RULES, TIME_CONTROLS } from "@etchess/types";
import { Hono } from "hono";
import type { HonoVariables } from "../middleware/session";
import type { Env } from "../types";

export const metaRoute = new Hono<{
  Bindings: Env;
  Variables: HonoVariables;
}>().get("/", (c) => {
  return c.json({
    serverVersion: "0.1.0",
    minProtocolVersion: PROTOCOL_VERSION,
    rules: PRODUCT_RULES,
    timeControls: TIME_CONTROLS,
  });
});

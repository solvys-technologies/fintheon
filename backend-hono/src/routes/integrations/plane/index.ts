// [claude-code 2026-05-06] S60-T4: Plane integration barrel — mounts inbound webhook route
// [claude-code 2026-05-06] S60-T5: Added outbound relay route
import { Hono } from "hono";
import { createPlaneInboundRoute } from "./inbound.js";
import { createPlaneOutboundRoute } from "./outbound.js";

export function createPlaneIntegrationRoutes(): Hono {
  const router = new Hono();
  router.route("/", createPlaneInboundRoute());
  router.route("/", createPlaneOutboundRoute());
  return router;
}

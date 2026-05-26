import { Hono } from "hono";
import { z } from "zod";
import {
  listFileRoom,
  readFileRoomItem,
} from "../../services/file-room/index.js";

const querySchema = z.object({
  deskId: z.string().trim().max(120).optional(),
});

export function createFileRoomRoutes(): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const parsed = querySchema.safeParse({
      deskId: c.req.query("deskId") || undefined,
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: "Invalid file room query" }, 400);
    }
    const fileRoom = await listFileRoom(parsed.data.deskId);
    return c.json({ ok: true, fileRoom });
  });

  app.get("/item", async (c) => {
    const itemId = c.req.query("id");
    if (!itemId) return c.json({ ok: false, error: "id is required" }, 400);
    const item = await readFileRoomItem(
      itemId,
      c.req.query("deskId") || undefined,
    );
    if (!item)
      return c.json({ ok: false, error: "file room item not found" }, 404);
    return c.json({ ok: true, item });
  });

  return app;
}

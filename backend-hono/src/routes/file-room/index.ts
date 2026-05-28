// [Codex 2026-05-27] S102 manager-gated FileRoom write path for forecasting models.
import { Hono } from "hono";
import { z } from "zod";
import {
  listFileRoom,
  readFileRoomItem,
  writeFileRoomItem,
} from "../../services/file-room/index.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { isLocalDevActor } from "../../services/coliseum/db.js";
import type { FileRoomSectionId } from "../../services/file-room/types.js";

const querySchema = z.object({
  deskId: z.string().trim().max(120).optional(),
});

const writeSchema = z.object({
  id: z.string().optional(),
  deskId: z.string().trim().max(120).optional(),
  sectionId: z.literal("forecasting-models"),
  title: z.string().trim().min(1).max(160),
  content: z.string().min(1).max(80_000),
  source: z.enum(["manual", "approved-refinement"]).default("manual"),
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

  app.put("/item", async (c) => {
    const userId = (c as any).get("userId") as string | undefined;
    const parsed = writeSchema.safeParse(await c.req.json());
    if (!parsed.success)
      return c.json({ ok: false, error: parsed.error.message }, 400);
    const canEdit = await canEditForecastingModels(
      parsed.data.deskId ?? "priced-in-capital",
      userId ?? null,
    );
    if (!canEdit) return c.json({ ok: false, error: "Desk Manager only" }, 403);
    const item = await writeFileRoomItem({
      deskId: parsed.data.deskId,
      itemId: parsed.data.id ?? null,
      sectionId: parsed.data.sectionId as FileRoomSectionId,
      title: parsed.data.title,
      content: parsed.data.content,
      editorId: userId ?? "unknown",
      source: parsed.data.source,
    });
    return c.json({ ok: true, item });
  });

  return app;
}

async function canEditForecastingModels(
  deskId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId || userId === "anonymous") return false;
  if (isLocalDevActor(userId)) return true;
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { data: membership } = await sb
    .from("narrative_desk_members")
    .select("role")
    .eq("desk_id", deskId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = membership?.role ? String(membership.role) : null;
  if (role && ["owner", "manager", "desk_manager", "admin"].includes(role)) {
    return true;
  }

  const { data: user } = await sb
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return user?.role === "admin";
}

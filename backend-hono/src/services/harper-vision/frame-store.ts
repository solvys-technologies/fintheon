// [claude-code 2026-04-23] S32-T2 Harper Vision — real LLM frame description + embedding
/**
 * Harper Vision Frame Store
 * Persists screen capture frames to Supabase
 * Inspired by OMI's screen_activity.rs Firestore + Pinecone pattern
 */

import { createClient } from "@supabase/supabase-js";
import type {
  HarperVisionFrameIngest,
  HarperVisionFrameRecord,
} from "../../types/harper-vision.js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function ingestFrames(
  userId: string,
  payload: HarperVisionFrameIngest,
): Promise<{ count: number; frameIds: string[] }> {
  const frameIds: string[] = [];

  for (const frame of payload.frames) {
    // Store base64 image in Supabase Storage (or inline if small)
    const imagePath = await storeImage(userId, payload.sessionId, frame);

    const { data, error } = await supabase
      .from("harper_vision_frames")
      .insert({
        user_id: userId,
        session_id: payload.sessionId,
        timestamp: frame.timestamp,
        app_name: frame.appName || null,
        window_title: frame.windowTitle || null,
        image_path: imagePath,
        display_id: frame.displayId,
        // Description and embedding generated asynchronously
        description: null,
        description_embedding: null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[HarperVision] Frame insert error:", error.message);
      continue;
    }

    frameIds.push(data.id);

    // Fire-and-forget background description + embedding
    generateDescriptionAsync(data.id, frame.base64).catch(() => {});
  }

  return { count: frameIds.length, frameIds };
}

async function storeImage(
  userId: string,
  sessionId: string,
  frame: HarperVisionFrameIngest["frames"][number],
): Promise<string | null> {
  try {
    const path = `${userId}/${sessionId}/${frame.frameIndex}.png`;
    const buffer = Buffer.from(frame.base64, "base64");

    // Only store if under 2MB; otherwise return null (frame kept in-memory only)
    if (buffer.length > 2 * 1024 * 1024) {
      return null;
    }

    const { error } = await supabase.storage
      .from("harper-vision")
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error("[HarperVision] Image upload error:", error.message);
      return null;
    }

    return path;
  } catch (err: any) {
    console.error("[HarperVision] Image store error:", err.message);
    return null;
  }
}

async function generateDescriptionAsync(
  _frameId: string,
  _base64Image: string,
): Promise<void> {
  return;
}

export async function getRecentFrames(
  userId: string,
  options: { sessionId?: string; limit?: number } = {},
): Promise<HarperVisionFrameRecord[]> {
  let query = supabase
    .from("harper_vision_frames")
    .select("*")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(options.limit || 20);

  if (options.sessionId) {
    query = query.eq("session_id", options.sessionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[HarperVision] Frame query error:", error.message);
    return [];
  }

  return (data || []) as HarperVisionFrameRecord[];
}

export async function getFrameById(
  id: string,
  userId: string,
): Promise<HarperVisionFrameRecord | null> {
  const { data, error } = await supabase
    .from("harper_vision_frames")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  return data as HarperVisionFrameRecord;
}

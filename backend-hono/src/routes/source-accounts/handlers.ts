// [claude-code 2026-04-12] Source accounts CRUD handlers

import type { Context } from "hono";
import {
  getAccounts,
  addAccount,
  updateAccount,
  removeAccount,
} from "../../services/source-accounts/source-accounts-service.js";
import { SOURCE_ACCOUNT_CATEGORIES } from "../../types/source-account.js";
import type { SourceAccountCategory } from "../../types/source-account.js";

// GET /api/source-accounts
export async function handleGetAccounts(c: Context) {
  const accounts = await getAccounts();
  return c.json({ accounts });
}

// POST /api/source-accounts
export async function handleAddAccount(c: Context) {
  const body = await c.req.json<{
    handle: string;
    displayName?: string;
    category?: string;
  }>();

  if (!body.handle?.trim()) {
    return c.json({ error: "handle is required" }, 400);
  }

  const category = (body.category ?? "Custom") as SourceAccountCategory;
  if (!SOURCE_ACCOUNT_CATEGORIES.includes(category)) {
    return c.json(
      {
        error: `Invalid category. Must be one of: ${SOURCE_ACCOUNT_CATEGORIES.join(", ")}`,
      },
      400,
    );
  }

  const account = await addAccount(
    body.handle.trim(),
    body.displayName?.trim() ?? null,
    category,
  );

  if (!account) {
    return c.json({ error: "Failed to add source account" }, 500);
  }
  return c.json({ account }, 201);
}

// PUT /api/source-accounts/:id
export async function handleUpdateAccount(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const body = await c.req.json<Record<string, unknown>>();
  await updateAccount(id, body);
  return c.json({ ok: true });
}

// DELETE /api/source-accounts/:id
export async function handleDeleteAccount(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  await removeAccount(id);
  return c.json({ ok: true });
}

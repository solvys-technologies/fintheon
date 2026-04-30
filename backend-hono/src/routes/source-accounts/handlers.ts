// [claude-code 2026-04-28] S47-T1: Normalized body keys, method validation, field-specific errors.
// Source accounts CRUD handlers

import type { Context } from "hono";
import {
  getAccounts,
  addAccount,
  updateAccount,
  removeAccount,
  triggerMandatoryRescore,
} from "../../services/source-accounts/source-accounts-service.js";
import {
  SOURCE_ACCOUNT_CATEGORIES,
  SOURCE_ACCOUNT_METHODS,
} from "../../types/source-account.js";
import type {
  SourceAccountCategory,
  SourceAccountMethod,
} from "../../types/source-account.js";
import { isBannedPublisher } from "../../services/riskflow/content-guard.js";

// X handle regex: 1-15 chars, alphanumeric + underscore, optional leading @
const X_HANDLE_RE = /^@?[a-zA-Z0-9_]{1,15}$/;

// Blocked handles that must never be added as source accounts
const BLOCKED_ADD_HANDLES = new Set([
  "overton_news",
  "reuters", "reutersbiz", "reutersworld",
  "bloomberg", "business", "markets", "bloombergtv", "bloombergradio", "bloombergpolitics",
  "cnbc", "cnbcnow", "squawkcnbc",
  "foxnews", "foxbusiness", "msnbc", "cnn", "cnnbusiness",
  "marketwatch", "wsj", "ft", "financialtimes", "barronsonline",
  "nbcnews", "abc", "abcnews", "cbsnews", "usatoday", "businessinsider",
  "yahoofinance", "seekingalpha", "zerohedge",
]);

// GET /api/source-accounts
export async function handleGetAccounts(c: Context) {
  const accounts = await getAccounts();
  return c.json({ accounts });
}

function validateCategory(value: unknown): {
  valid: boolean;
  category?: SourceAccountCategory;
  error?: string;
} {
  const cat = (value ?? "Custom") as string;
  if (!SOURCE_ACCOUNT_CATEGORIES.includes(cat as SourceAccountCategory)) {
    return {
      valid: false,
      error: `Invalid category. Must be one of: ${SOURCE_ACCOUNT_CATEGORIES.join(", ")}`,
    };
  }
  return { valid: true, category: cat as SourceAccountCategory };
}

function validateMethod(value: unknown): {
  valid: boolean;
  method?: SourceAccountMethod;
  error?: string;
} {
  const m = (value ?? "browser") as string;
  if (!SOURCE_ACCOUNT_METHODS.includes(m as SourceAccountMethod)) {
    return {
      valid: false,
      error: `Invalid method. Must be one of: ${SOURCE_ACCOUNT_METHODS.join(", ")}`,
    };
  }
  return { valid: true, method: m as SourceAccountMethod };
}

// POST /api/source-accounts
export async function handleAddAccount(c: Context) {
  const body = await c.req.json<{
    handle?: string;
    displayName?: string;
    display_name?: string;
    category?: string;
    method?: string;
  }>();

  const errors: Record<string, string> = {};

  if (!body.handle?.trim()) {
    errors.handle = "handle is required";
  } else {
    const cleanHandle = body.handle.trim().replace(/^@/, "").toLowerCase();
    // Blocked handle check — never allow known spam/publisher handles
    if (BLOCKED_ADD_HANDLES.has(cleanHandle)) {
      errors.handle = "This source is blocked and cannot be added";
    }
    // X handle format check for browser-method accounts
    const method = (body.method ?? "browser") as string;
    if (method === "browser") {
      const rawHandle = body.handle.trim();
      if (!X_HANDLE_RE.test(rawHandle)) {
        errors.handle = "X handles must be 1-15 characters (letters, numbers, underscores)";
      }
    }
  }

  const catResult = validateCategory(body.category);
  if (!catResult.valid) {
    errors.category = catResult.error!;
  }

  const methodResult = validateMethod(body.method);
  if (!methodResult.valid) {
    errors.method = methodResult.error!;
  }

  if (Object.keys(errors).length > 0) {
    return c.json({ errors }, 400);
  }

  // Accept both legacy displayName and current display_name for one release
  const displayName =
    body.display_name?.trim() ?? body.displayName?.trim() ?? null;

  const account = await addAccount(
    body.handle!.trim(),
    displayName,
    catResult.category!,
    methodResult.method!,
  );

  if (!account) {
    return c.json({ error: "Failed to add source account" }, 500);
  }

  triggerMandatoryRescore("source-account-added");
  return c.json({ account }, 201);
}

// PUT /api/source-accounts/:id
export async function handleUpdateAccount(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const body = await c.req.json<Record<string, unknown>>();

  const errors: Record<string, string> = {};
  const fields: Record<string, unknown> = {};

  if (body.handle !== undefined) {
    if (typeof body.handle === "string" && body.handle.trim()) {
      const rawHandle = body.handle.trim();
      const cleanHandle = rawHandle.replace(/^@/, "").toLowerCase();
      if (BLOCKED_ADD_HANDLES.has(cleanHandle)) {
        errors.handle = "This source is blocked and cannot be added";
      } else {
        fields.handle = rawHandle.replace(/^@/, "");
      }
    } else {
      errors.handle = "handle must be a non-empty string";
    }
  }

  // Normalize both keys
  if (body.display_name !== undefined || body.displayName !== undefined) {
    const dn =
      (body.display_name as string | undefined)?.trim() ??
      (body.displayName as string | undefined)?.trim() ??
      null;
    fields.display_name = dn;
  }

  if (body.category !== undefined) {
    const catResult = validateCategory(body.category);
    if (catResult.valid) {
      fields.category = catResult.category;
    } else {
      errors.category = catResult.error!;
    }
  }

  if (body.method !== undefined) {
    const methodResult = validateMethod(body.method);
    if (methodResult.valid) {
      fields.method = methodResult.method;
    } else {
      errors.method = methodResult.error!;
    }
  }

  // Browser-method accounts must always be valid X handles.
  // The Refinement UI sends method on edit, so this applies consistently.
  const effectiveMethod =
    (fields.method as SourceAccountMethod | undefined) ??
    (body.method as SourceAccountMethod | undefined);
  const effectiveHandle =
    (fields.handle as string | undefined) ??
    (typeof body.handle === "string" ? body.handle.trim() : undefined);
  if (effectiveMethod === "browser" && effectiveHandle) {
    if (!X_HANDLE_RE.test(effectiveHandle)) {
      errors.handle =
        "X handles must be 1-15 characters (letters, numbers, underscores)";
    }
  }

  if (body.active !== undefined) {
    fields.active = Boolean(body.active);
  }

  if (Object.keys(errors).length > 0) {
    return c.json({ errors }, 400);
  }

  await updateAccount(id, fields);
  triggerMandatoryRescore("source-account-updated");
  return c.json({ ok: true });
}

// DELETE /api/source-accounts/:id
export async function handleDeleteAccount(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  await removeAccount(id);
  triggerMandatoryRescore("source-account-deleted");
  return c.json({ ok: true });
}

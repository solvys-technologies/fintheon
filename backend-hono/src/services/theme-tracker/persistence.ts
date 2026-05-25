import type { Theme, ThemeStatus } from "./types.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ThemeStore");

const store = new Map<string, Theme>();

export function createTheme(theme: Theme): Theme {
  store.set(theme.id, theme);
  log.info("Theme created", { id: theme.id, name: theme.name });
  return theme;
}

export function getTheme(id: string): Theme | undefined {
  return store.get(id);
}

export function listThemes(status?: ThemeStatus): Theme[] {
  const all = Array.from(store.values());
  if (status) return all.filter((t) => t.status === status);
  return all;
}

export function updateTheme(id: string, updates: Partial<Theme>): Theme | null {
  const existing = store.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  store.set(id, updated);
  return updated;
}

export function deleteTheme(id: string): boolean {
  return store.delete(id);
}

export function addCatalyst(themeId: string, catalystId: string): Theme | null {
  const theme = store.get(themeId);
  if (!theme) return null;
  if (!theme.catalystIds.includes(catalystId)) {
    theme.catalystIds.push(catalystId);
    theme.updatedAt = new Date().toISOString();
  }
  return theme;
}

export function removeCatalyst(
  themeId: string,
  catalystId: string,
): Theme | null {
  const theme = store.get(themeId);
  if (!theme) return null;
  theme.catalystIds = theme.catalystIds.filter((id) => id !== catalystId);
  theme.updatedAt = new Date().toISOString();
  return theme;
}

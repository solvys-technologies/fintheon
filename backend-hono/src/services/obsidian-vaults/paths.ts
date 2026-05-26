import { homedir } from "node:os";
import { resolve } from "node:path";

export const RISKFLOW_MAIN_VAULT_NAME = "RiskFlow Main Vault";
export const LEGACY_CATALYST_VAULT_NAME = "Fintheon Catalyst Vault";
export const DESK_VAULTS_NAME = "Desk Vaults";

export interface VaultRootCandidate {
  root: string;
  baseRoot: string;
  label: string;
}

export function obsidianRoot(): string | null {
  return process.env.OBSIDIAN_VAULT_PATH
    ? resolve(process.env.OBSIDIAN_VAULT_PATH)
    : null;
}

export function riskFlowMainVaultRoot(): string | null {
  const explicit =
    process.env.OBSIDIAN_RISKFLOW_VAULT_PATH ??
    process.env.OBSIDIAN_CATALYST_VAULT_PATH;
  if (explicit) return resolve(explicit);
  const root = obsidianRoot();
  return root ? resolve(root, RISKFLOW_MAIN_VAULT_NAME) : null;
}

export function deskVaultsRoot(): string | null {
  if (process.env.OBSIDIAN_DESK_VAULTS_PATH) {
    return resolve(process.env.OBSIDIAN_DESK_VAULTS_PATH);
  }
  const root = obsidianRoot();
  return root ? resolve(root, DESK_VAULTS_NAME) : null;
}

export function fallbackDeskVaultsRoot(): string {
  return resolve(process.cwd(), "..", "memory", "desk-vaults");
}

export function fallbackRiskFlowVaultRoot(): string {
  return resolve(homedir(), "Documents", "Obsidian", RISKFLOW_MAIN_VAULT_NAME);
}

export function riskFlowVaultCandidates(): VaultRootCandidate[] {
  const candidates: VaultRootCandidate[] = [];
  const root = obsidianRoot();
  const main = riskFlowMainVaultRoot();
  if (main) {
    candidates.push({ root: main, baseRoot: root ?? main, label: "riskflow" });
  }
  if (root) {
    candidates.push({
      root: resolve(root, LEGACY_CATALYST_VAULT_NAME),
      baseRoot: root,
      label: "legacy-riskflow",
    });
  }
  return uniqueRoots(candidates);
}

export function deskVaultCandidates(
  deskId?: string | null,
): VaultRootCandidate[] {
  const root = deskVaultsRoot();
  if (!root) return [];
  if (deskId) {
    const slug = sanitizeVaultSlug(deskId);
    return uniqueRoots([
      { root: resolve(root, slug), baseRoot: root, label: "desk" },
      { root, baseRoot: root, label: "desk-root" },
    ]);
  }
  return [{ root, baseRoot: root, label: "desk-root" }];
}

export function sanitizeVaultSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "priced-in-capital";
}

function uniqueRoots(candidates: VaultRootCandidate[]): VaultRootCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.root)) return false;
    seen.add(candidate.root);
    return true;
  });
}

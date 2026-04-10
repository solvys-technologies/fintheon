// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — danger zone tab
import React from "react";
import { Button } from "../ui/Button";

export function DangerTab() {
  return (
    <section>
      <h3 className="text-sm font-semibold text-red-500 mb-3">Danger Zone</h3>
      <div className="space-y-4">
        <div className="bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-1">
            Reset Analysts
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Restore all analysts to their default configuration.
          </p>
          <Button
            variant="secondary"
            className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
          >
            Reset to Defaults
          </Button>
        </div>
        <div className="bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-1">
            Clear All Data
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Remove all conversations, drafts, and local settings. This cannot be
            undone.
          </p>
          <Button
            variant="secondary"
            className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
          >
            Clear Data
          </Button>
        </div>
        <div className="bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-1">
            Export Configuration
          </h4>
          <p className="text-xs text-gray-500 mb-3">
            Download your agent and settings configuration as JSON.
          </p>
          <Button
            variant="secondary"
            className="text-xs text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/10"
          >
            Export
          </Button>
        </div>
        <div className="bg-[var(--fintheon-bg)] border border-red-500/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-white mb-1">Log Out</h4>
          <p className="text-xs text-gray-500 mb-3">
            Sign out and clear your local session. You will need to
            re-authenticate.
          </p>
          <Button
            variant="secondary"
            className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
            onClick={async () => {
              try {
                const { signOut } = await import("../../lib/supabase");
                await signOut();
              } catch {
                /* proceed with reload */
              }
              localStorage.removeItem("github_token");
              localStorage.removeItem("github_user");
              window.location.reload();
            }}
          >
            Log Out
          </Button>
        </div>
      </div>
    </section>
  );
}

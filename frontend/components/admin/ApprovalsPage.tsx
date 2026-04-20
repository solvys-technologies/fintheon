// [claude-code 2026-04-18] S24-T4: Admin approvals inbox — regime / lexicon / walk-back proposals
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Inbox,
  ExternalLink,
} from "@/components/shared/iso-icons";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

type ProposalTab = "regime" | "lexicon" | "walkBack";

interface BaseProposal {
  id: string;
  reason: string;
  evidence?: {
    headline?: string;
    chart_url?: string;
    x_sentiment?: string;
    sources?: { url: string; label?: string }[];
  };
  proposed_by: string;
  created_at: string;
}

interface RegimeProposal extends BaseProposal {
  proposed_regime: string;
  current_regime: string;
}

interface LexiconProposal extends BaseProposal {
  keyword: string;
  sentiment: "bullish" | "bearish" | "neutral";
  is_matrix_flip: boolean;
}

interface WalkBackProposal extends BaseProposal {
  original_item_id: string;
  original_headline: string;
  contradiction_headline: string;
  proposed_regime_revert: string;
}

const ENDPOINTS: Record<
  ProposalTab,
  { list: string; decision: (id: string, action: string) => string }
> = {
  regime: {
    list: "/api/regime/proposals?status=pending",
    decision: (id, action) => `/api/regime/proposals/${id}/${action}`,
  },
  lexicon: {
    list: "/api/lexicon/proposals?status=pending",
    decision: (id, action) => `/api/lexicon/proposals/${id}/${action}`,
  },
  walkBack: {
    list: "/api/riskflow/walk-back-proposals?status=pending",
    decision: (id, action) =>
      `/api/riskflow/walk-back-proposals/${id}/${action}`,
  },
};

export function ApprovalsPage() {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();
  const [tab, setTab] = useState<ProposalTab>("regime");
  const [items, setItems] = useState<Record<ProposalTab, BaseProposal[]>>({
    regime: [],
    lexicon: [],
    walkBack: [],
  });
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState<Record<ProposalTab, boolean>>({
    regime: false,
    lexicon: false,
    walkBack: false,
  });
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);

  const loadTab = useCallback(async (which: ProposalTab) => {
    try {
      const res = await fetch(`${API_BASE}${ENDPOINTS[which].list}`);
      if (res.status === 404) {
        setNotReady((prev) => ({ ...prev, [which]: true }));
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { proposals?: BaseProposal[] };
      setItems((prev) => ({ ...prev, [which]: data.proposals ?? [] }));
      setNotReady((prev) => ({ ...prev, [which]: false }));
    } catch {
      setNotReady((prev) => ({ ...prev, [which]: true }));
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadTab("regime"),
      loadTab("lexicon"),
      loadTab("walkBack"),
    ]);
    setLoading(false);
  }, [loadTab]);

  useEffect(() => {
    void loadAll();
    const interval = setInterval(() => void loadAll(), 30_000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const decide = useCallback(
    async (proposalId: string, action: "approve" | "deny") => {
      setPendingDecision(proposalId);
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE}${ENDPOINTS[tab].decision(proposalId, action)}`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        addToast(
          `Proposal ${action === "approve" ? "approved" : "denied"}`,
          action === "approve" ? "success" : "info",
        );
        // Remove from local list optimistically
        setItems((prev) => ({
          ...prev,
          [tab]: prev[tab].filter((p) => p.id !== proposalId),
        }));
      } catch (err) {
        addToast(
          "Decision failed",
          "error",
          err instanceof Error ? err.message : "Unknown",
        );
      } finally {
        setPendingDecision(null);
      }
    },
    [tab, addToast, getAccessToken],
  );

  const currentItems = items[tab];
  const isNotReady = notReady[tab];

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--fintheon-accent)]/15">
        <div className="flex items-center gap-2.5">
          <Inbox className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h1 className="text-sm font-bold text-[var(--fintheon-text)] tracking-wide">
            APPROVALS INBOX
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b border-[var(--fintheon-accent)]/15"
        role="tablist"
      >
        {(["regime", "lexicon", "walkBack"] as ProposalTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "10px 12px",
              fontFamily: "var(--font-data)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:
                tab === t ? "var(--fintheon-accent)" : "var(--fintheon-muted)",
              background: "transparent",
              border: "none",
              borderBottom:
                tab === t
                  ? "2px solid var(--fintheon-accent)"
                  : "2px solid transparent",
              cursor: "pointer",
            }}
          >
            {t === "regime"
              ? `Regime (${items.regime.length})`
              : t === "lexicon"
                ? `Lexicon (${items.lexicon.length})`
                : `Walk-back (${items.walkBack.length})`}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center py-12 text-[11px] text-zinc-500 animate-pulse">
            Loading proposals…
          </div>
        ) : isNotReady ? (
          <div
            style={{
              padding: "12px 16px",
              border: "1px dashed var(--fintheon-glass-border)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--fintheon-muted)",
              fontFamily: "var(--font-data)",
              letterSpacing: "0.04em",
              lineHeight: 1.5,
            }}
          >
            {tab} proposal endpoints not yet live — lands with T1.
          </div>
        ) : currentItems.length === 0 ? (
          <div className="text-center py-12 text-[11px] text-zinc-600">
            No pending {tab === "walkBack" ? "walk-back" : tab} proposals.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {currentItems.map((p) => (
              <ProposalCard
                key={p.id}
                tab={tab}
                proposal={p}
                disabled={pendingDecision === p.id}
                onApprove={() => void decide(p.id, "approve")}
                onDeny={() => void decide(p.id, "deny")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  tab,
  proposal,
  disabled,
  onApprove,
  onDeny,
}: {
  tab: ProposalTab;
  proposal: BaseProposal;
  disabled: boolean;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const headline =
    tab === "regime"
      ? `${(proposal as RegimeProposal).current_regime} → ${(proposal as RegimeProposal).proposed_regime}`
      : tab === "lexicon"
        ? `Add "${(proposal as LexiconProposal).keyword}" (${(proposal as LexiconProposal).sentiment})`
        : `Revert: ${(proposal as WalkBackProposal).original_headline.slice(0, 80)}…`;

  return (
    <div
      style={{
        // [claude-code 2026-04-19] Glassmorphic proposal card (TP rule: no kanban).
        border:
          "1px solid color-mix(in srgb, var(--fintheon-accent) 18%, transparent)",
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--fintheon-glass-bg)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        boxShadow: "var(--fintheon-glass-shadow)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--fintheon-accent)",
              marginBottom: 4,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.06em",
              color: "var(--fintheon-muted)",
            }}
          >
            {proposal.proposed_by} ·{" "}
            {new Date(proposal.created_at).toLocaleString()}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--fintheon-text)",
          lineHeight: 1.5,
          marginBottom: 10,
        }}
      >
        {proposal.reason}
      </div>

      {proposal.evidence && (
        <div
          style={{
            padding: "10px 12px",
            background:
              "color-mix(in srgb, var(--fintheon-accent) 4%, transparent)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
            borderRadius: 8,
            marginBottom: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {proposal.evidence.headline && (
            <div
              style={{
                fontSize: 11,
                color: "var(--fintheon-text)",
                fontStyle: "italic",
              }}
            >
              “{proposal.evidence.headline}”
            </div>
          )}
          {proposal.evidence.chart_url && (
            <img
              src={proposal.evidence.chart_url}
              alt="Chart evidence"
              style={{ maxWidth: "100%", borderRadius: 3, display: "block" }}
            />
          )}
          {proposal.evidence.x_sentiment && (
            <div
              style={{
                fontSize: 10,
                color: "var(--fintheon-muted)",
                fontFamily: "var(--font-data)",
              }}
            >
              X sentiment: {proposal.evidence.x_sentiment}
            </div>
          )}
          {proposal.evidence.sources &&
            proposal.evidence.sources.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {proposal.evidence.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 10,
                      color: "var(--fintheon-accent)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={10} />
                    {s.label ?? new URL(s.url).hostname}
                  </a>
                ))}
              </div>
            )}
        </div>
      )}

      {/* [claude-code 2026-04-19] Borderless, no-bg, accent letters per TP */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={onDeny}
          disabled={disabled}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            fontSize: 12,
            fontFamily: "var(--font-data)",
            letterSpacing: "0.06em",
            color: "var(--fintheon-accent)",
            background: "transparent",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <XCircle size={12} />
          Deny
        </button>
        <button
          onClick={onApprove}
          disabled={disabled}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            fontSize: 12,
            fontFamily: "var(--font-data)",
            letterSpacing: "0.06em",
            fontWeight: 600,
            color: "var(--fintheon-accent)",
            background: "transparent",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <CheckCircle2 size={12} />
          Approve
        </button>
      </div>
    </div>
  );
}

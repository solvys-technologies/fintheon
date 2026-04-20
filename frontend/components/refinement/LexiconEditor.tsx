// [claude-code 2026-04-18] S24-T4: Lexicon editor — CRUD + pending proposals approval
import { useState, useEffect, useCallback, useMemo } from "react";
import { BookOpen, Plus } from "@/components/shared/iso-icons";
import { KeywordDiffRow, type KeywordDiff } from "../ui/InlineDiff";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface LexiconKeyword {
  id: string;
  keyword: string;
  sentiment: "bullish" | "bearish" | "neutral";
  is_matrix_flip: boolean;
  target_regime: string | null;
  approved: boolean;
  added_by: string;
  created_at: string;
}

interface LexiconProposal {
  id: string;
  keyword: string;
  sentiment: "bullish" | "bearish" | "neutral";
  is_matrix_flip: boolean;
  target_regime: string | null;
  proposed_by: string;
  status: "pending" | "approved" | "denied";
  evidence?: { headline: string }[];
  created_at: string;
}

export function LexiconEditor() {
  const { addToast } = useToast();
  const { getAccessToken } = useAuth();
  const [keywords, setKeywords] = useState<LexiconKeyword[]>([]);
  const [proposals, setProposals] = useState<LexiconProposal[]>([]);
  const [notReady, setNotReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    keyword: "",
    sentiment: "bullish" as LexiconKeyword["sentiment"],
    is_matrix_flip: false,
  });
  const [resolved, setResolved] = useState<
    Record<string, "approved" | "rejected">
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kwRes, prRes] = await Promise.all([
        fetch(`${API_BASE}/api/lexicon/keywords`),
        fetch(`${API_BASE}/api/lexicon/proposals?status=pending`),
      ]);
      if (kwRes.status === 404 || prRes.status === 404) {
        setNotReady(true);
        return;
      }
      if (!kwRes.ok || !prRes.ok) throw new Error("Lexicon load failed");
      const kwData = (await kwRes.json()) as { keywords: LexiconKeyword[] };
      const prData = (await prRes.json()) as { proposals: LexiconProposal[] };
      setKeywords(kwData.keywords ?? []);
      setProposals(prData.proposals ?? []);
    } catch {
      setNotReady(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decideProposal = useCallback(
    async (id: string, decision: "approve" | "deny") => {
      setResolved((prev) => ({
        ...prev,
        [id]: decision === "approve" ? "approved" : "rejected",
      }));
      try {
        const token = await getAccessToken();
        const res = await fetch(
          `${API_BASE}/api/lexicon/proposals/${id}/${decision}`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        addToast(
          `Proposal ${decision === "approve" ? "approved" : "denied"}`,
          decision === "approve" ? "success" : "info",
        );
      } catch (err) {
        // Revert optimistic state
        setResolved((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        addToast(
          "Decision failed",
          "error",
          err instanceof Error ? err.message : "Unknown",
        );
      }
    },
    [addToast, getAccessToken],
  );

  const addKeyword = async () => {
    const kw = addForm.keyword.trim();
    if (!kw) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_BASE}/api/lexicon/keywords`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          keyword: kw,
          sentiment: addForm.sentiment,
          is_matrix_flip: addForm.is_matrix_flip,
          approved: true,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      addToast(`Added "${kw}"`, "success");
      setAddForm({ keyword: "", sentiment: "bullish", is_matrix_flip: false });
      setAddOpen(false);
      await load();
    } catch (err) {
      addToast(
        "Add failed",
        "error",
        err instanceof Error ? err.message : "Unknown",
      );
    }
  };

  const proposalDiffs: { proposal: LexiconProposal; diff: KeywordDiff }[] =
    useMemo(
      () =>
        proposals.map((p) => ({
          proposal: p,
          diff: {
            keyword: p.keyword,
            action: "add",
            sentimentAfter: p.sentiment,
            isMatrixFlip: p.is_matrix_flip,
          },
        })),
      [proposals],
    );

  if (notReady) {
    return (
      <div
        style={{
          padding: "10px 12px",
          border: "1px dashed var(--fintheon-glass-border)",
          borderRadius: 4,
          fontSize: 11,
          color: "var(--fintheon-muted)",
          fontFamily: "var(--font-data)",
          letterSpacing: "0.04em",
          lineHeight: 1.5,
        }}
      >
        Lexicon endpoints not yet live — lands with T1.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={14} color="var(--fintheon-accent)" />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--fintheon-text)",
            }}
          >
            Lexicon
          </span>
          <span
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              color: "var(--fintheon-muted)",
              letterSpacing: "0.06em",
            }}
          >
            {keywords.length} approved · {proposals.length} pending
          </span>
        </div>
        <button
          onClick={() => setAddOpen((v) => !v)}
          aria-label="Add keyword"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            fontSize: 10,
            fontFamily: "var(--font-data)",
            color: "var(--fintheon-accent)",
            background: "transparent",
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          <Plus size={10} />
          Add
        </button>
      </div>

      {loading && (
        <div style={{ fontSize: 11, color: "var(--fintheon-muted)" }}>
          Loading…
        </div>
      )}

      {addOpen && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: "8px 10px",
            border: "1px solid var(--fintheon-glass-border)",
            borderRadius: 4,
          }}
        >
          <input
            value={addForm.keyword}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, keyword: e.target.value }))
            }
            placeholder="Keyword or phrase"
            style={{
              padding: "6px 8px",
              fontSize: 12,
              fontFamily: "var(--font-data)",
              color: "var(--fintheon-text)",
              background: "transparent",
              border: "1px solid var(--fintheon-glass-border)",
              borderRadius: 3,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={addForm.sentiment}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  sentiment: e.target.value as LexiconKeyword["sentiment"],
                }))
              }
              style={{
                padding: "5px 6px",
                fontSize: 11,
                fontFamily: "var(--font-data)",
                color: "var(--fintheon-text)",
                background: "var(--fintheon-bg)",
                border: "1px solid var(--fintheon-glass-border)",
                borderRadius: 3,
              }}
            >
              <option value="bullish">bullish</option>
              <option value="bearish">bearish</option>
              <option value="neutral">neutral</option>
            </select>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontFamily: "var(--font-data)",
                color: "var(--fintheon-muted)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={addForm.is_matrix_flip}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    is_matrix_flip: e.target.checked,
                  }))
                }
              />
              matrix-flip
            </label>
            <button
              onClick={addKeyword}
              disabled={!addForm.keyword.trim()}
              style={{
                marginLeft: "auto",
                padding: "5px 10px",
                fontSize: 10,
                fontFamily: "var(--font-data)",
                color: "var(--fintheon-bg)",
                background: "var(--fintheon-accent)",
                border: "none",
                borderRadius: 3,
                cursor: addForm.keyword.trim() ? "pointer" : "not-allowed",
                opacity: addForm.keyword.trim() ? 1 : 0.5,
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {proposals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--fintheon-muted)",
            }}
          >
            Pending proposals
          </div>
          {proposalDiffs.map(({ proposal, diff }) => (
            <KeywordDiffRow
              key={proposal.id}
              diff={diff}
              onApprove={() => void decideProposal(proposal.id, "approve")}
              onReject={() => void decideProposal(proposal.id, "deny")}
              approved={resolved[proposal.id] === "approved"}
              rejected={resolved[proposal.id] === "rejected"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

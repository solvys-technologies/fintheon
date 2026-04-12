// [claude-code 2026-03-31] S12-T3: Research task board — kanban layout with 4 columns

import { useCallback, useEffect, useState } from "react";
import { Plus, X, Save, Search } from "lucide-react";
import { useBackend } from "../../lib/backend";
import { useAuth } from "../../contexts/AuthContext";
import { type ResearchTask, type ResearchTaskInput } from "../../lib/services";
import ResearchTaskCard from "./ResearchTaskCard";

const COLUMNS = [
  { key: "pending", label: "Pending", color: "#888" },
  { key: "active", label: "Active", color: "#4a9eff" },
  { key: "deep-dive", label: "Deep Dive", color: "#c79f4a" },
  { key: "complete", label: "Complete", color: "#4ade80" },
] as const;

const AGENTS = ["Harper", "Oracle", "Feucht", "Consul", "Herald"];

interface TeamMemberOption {
  id: string;
  displayName: string;
}

export default function ResearchBoard() {
  const backend = useBackend();
  const { userId } = useAuth();

  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [deskFilter, setDeskFilter] = useState<string>("");

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newNarrative, setNewNarrative] = useState("");
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [newAgent, setNewAgent] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Expanded task edit state
  const [editFindings, setEditFindings] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const refreshTasks = useCallback(async () => {
    try {
      const filter: Record<string, string> = {};
      if (deskFilter) filter.deskId = deskFilter;
      const res = await backend.research.listTasks(filter);
      setTasks(res.tasks);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [backend, deskFilter]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await backend.peers.list();
      setTeamMembers(
        res.peers.map(
          (p: { userId: string; user?: { displayName: string } }) => ({
            id: p.userId,
            displayName: p.user?.displayName || "Unknown",
          }),
        ),
      );
    } catch {
      setTeamMembers([]);
    }
  }, [backend]);

  useEffect(() => {
    void refreshTasks();
    void loadTeamMembers();
  }, [refreshTasks, loadTeamMembers]);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    const input: ResearchTaskInput = {
      title: newTitle.trim(),
      narrative: newNarrative.trim() || null,
      assignedTo: newAssignedTo || null,
      assignedAgent: newAgent || null,
      dueDate: newDueDate || null,
      createdBy: userId || "anonymous",
    };
    await backend.research.createTask(input);
    setNewTitle("");
    setNewNarrative("");
    setNewAssignedTo("");
    setNewAgent("");
    setNewDueDate("");
    setShowNewForm(false);
    void refreshTasks();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await backend.research.updateTask(id, { status });
    void refreshTasks();
  };

  const handleExpand = (id: string) => {
    if (expandedTaskId === id) {
      setExpandedTaskId(null);
      return;
    }
    setExpandedTaskId(id);
    const task = tasks.find((t) => t.id === id);
    if (task) {
      setEditFindings(
        task.findings ? JSON.stringify(task.findings, null, 2) : "",
      );
      setEditStatus(task.status);
    }
  };

  const handleSaveExpanded = async () => {
    if (!expandedTaskId) return;
    let findings: Record<string, unknown> | undefined;
    if (editFindings.trim()) {
      try {
        findings = JSON.parse(editFindings);
      } catch {
        findings = { raw: editFindings };
      }
    }
    await backend.research.updateTask(expandedTaskId, {
      status: editStatus,
      findings,
    });
    setExpandedTaskId(null);
    void refreshTasks();
  };

  const expandedTask = tasks.find((t) => t.id === expandedTaskId);

  const tasksByStatus = (status: string) =>
    tasks.filter((t) => t.status === status);

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--fintheon-text)]">
          Imperium
        </h2>
        <div className="flex items-center gap-2">
          {/* Desk filter placeholder */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0a0a08] px-2 py-1">
            <Search
              size={14}
              className="text-[var(--fintheon-text-dim,#666)]"
            />
            <input
              type="text"
              placeholder="Filter by desk..."
              value={deskFilter}
              onChange={(e) => setDeskFilter(e.target.value)}
              className="w-32 bg-transparent text-xs text-[var(--fintheon-text)] placeholder-[var(--fintheon-text-dim,#555)] outline-none"
            />
          </div>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: showNewForm
                ? "rgba(199,159,74,0.15)"
                : "rgba(199,159,74,0.08)",
              color: "#c79f4a",
              border: "1px solid rgba(199,159,74,0.25)",
            }}
          >
            {showNewForm ? <X size={14} /> : <Plus size={14} />}
            {showNewForm ? "Cancel" : "New Task"}
          </button>
        </div>
      </div>

      {/* New Task Form */}
      {showNewForm && (
        <div
          className="rounded-xl border border-[var(--fintheon-accent)]/20 p-4"
          style={{ background: "#0a0a08" }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Task title *"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#111] px-3 py-2 text-sm text-[var(--fintheon-text)] placeholder-[var(--fintheon-text-dim,#555)] outline-none focus:border-[var(--fintheon-accent)]/40"
              />
            </div>
            <div className="col-span-2">
              <input
                type="text"
                placeholder="Narrative (optional — freeform text or NarrativeFlow theme)"
                value={newNarrative}
                onChange={(e) => setNewNarrative(e.target.value)}
                className="w-full rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#111] px-3 py-2 text-sm text-[var(--fintheon-text)] placeholder-[var(--fintheon-text-dim,#555)] outline-none focus:border-[var(--fintheon-accent)]/40"
              />
            </div>
            <select
              value={newAssignedTo}
              onChange={(e) => setNewAssignedTo(e.target.value)}
              className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#111] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none"
            >
              <option value="">Assign to team member...</option>
              {teamMembers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
            <select
              value={newAgent}
              onChange={(e) => setNewAgent(e.target.value)}
              className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#111] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none"
            >
              <option value="">Agent persona...</option>
              {AGENTS.map((a) => (
                <option key={a} value={a}>
                  {a === "Harper" ? "Harper" : a}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#111] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none"
            />
            <button
              onClick={handleCreateTask}
              disabled={!newTitle.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-30"
              style={{
                background: "rgba(199,159,74,0.15)",
                color: "#c79f4a",
                border: "1px solid rgba(199,159,74,0.3)",
              }}
            >
              Create Task
            </button>
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid flex-1 grid-cols-4 gap-3 overflow-hidden">
        {COLUMNS.map((col) => {
          const colTasks = tasksByStatus(col.key);
          return (
            <div key={col.key} className="flex flex-col gap-2 overflow-hidden">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1 pb-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: col.color }}
                />
                <span className="text-xs font-semibold text-[var(--fintheon-text)]">
                  {col.label}
                </span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    color: "var(--fintheon-text-dim, #888)",
                  }}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {loading ? (
                  <div className="py-8 text-center text-xs text-[var(--fintheon-text-dim,#555)]">
                    Loading...
                  </div>
                ) : colTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--fintheon-text-dim,#444)]">
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <ResearchTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onExpand={handleExpand}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded task detail */}
      {expandedTask && (
        <div
          className="rounded-xl border border-[var(--fintheon-accent)]/20 p-4"
          style={{ background: "#0a0a08" }}
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--fintheon-text)]">
                {expandedTask.title}
              </h3>
              {expandedTask.narrative && (
                <p className="mt-1 text-xs" style={{ color: "#c79f4a" }}>
                  {expandedTask.narrative}
                </p>
              )}
              <div className="mt-1 flex items-center gap-3 text-xs text-[var(--fintheon-text-dim,#666)]">
                {expandedTask.assignedAgent && (
                  <span>Agent: {expandedTask.assignedAgent}</span>
                )}
                {expandedTask.dueDate && (
                  <span>
                    Due: {new Date(expandedTask.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setExpandedTaskId(null)}
              className="text-[var(--fintheon-text-dim,#666)] hover:text-[var(--fintheon-text)]"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-[var(--fintheon-text-dim,#666)]">
                Findings
              </label>
              <textarea
                value={editFindings}
                onChange={(e) => setEditFindings(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#111] px-3 py-2 text-xs text-[var(--fintheon-text)] placeholder-[var(--fintheon-text-dim,#555)] outline-none font-mono"
                placeholder="Enter findings as JSON or plain text..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#111] px-3 py-2 text-xs text-[var(--fintheon-text)] outline-none"
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="deep-dive">Deep Dive</option>
                <option value="complete">Complete</option>
              </select>
              <button
                onClick={handleSaveExpanded}
                className="flex items-center justify-center gap-1 rounded-lg px-4 py-2 text-xs font-medium"
                style={{
                  background: "rgba(199,159,74,0.15)",
                  color: "#c79f4a",
                  border: "1px solid rgba(199,159,74,0.3)",
                }}
              >
                <Save size={12} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

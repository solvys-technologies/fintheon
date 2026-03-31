// [claude-code 2026-04-01] S13-T3: Agentic sidebar — AI actions for document enrichment

import React, { useState, useEffect, useCallback } from 'react'
import {
  Wand2, BarChart3, Search, Image, FileText,
  ChevronDown, ChevronRight, Loader2, ArrowDownToLine,
  Brain, Clock, AlertCircle,
} from 'lucide-react'
import { useBackend } from '../../lib/backend'
import type { SidebarAction, SharedMemoryEntry, AnalysisThought } from '../../lib/services'
import type { Editor } from '@tiptap/react'

interface AgenticSidebarProps {
  documentId: string
  editor: Editor | null
}

type ActionType = SidebarAction['type']

const ACTION_CONFIG: Array<{ type: ActionType; label: string; icon: React.ReactNode; prompt?: boolean; computerUse?: boolean }> = [
  { type: 'summarize', label: 'Summarize', icon: <FileText size={14} /> },
  { type: 'analyze', label: 'Analyze', icon: <Brain size={14} />, prompt: true },
  { type: 'fetch-data', label: 'Search Web', icon: <Search size={14} />, prompt: true },
  { type: 'fetch-chart', label: 'Fetch Chart', icon: <BarChart3 size={14} />, prompt: true, computerUse: true },
  { type: 'insert-image', label: 'Insert Visual', icon: <Image size={14} />, prompt: true, computerUse: true },
]

export function AgenticSidebar({ documentId, editor }: AgenticSidebarProps) {
  const backend = useBackend()
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [promptInput, setPromptInput] = useState('')
  const [activeAction, setActiveAction] = useState<ActionType | null>(null)
  const [result, setResult] = useState<SidebarAction['result'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Shared memory
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryEntries, setMemoryEntries] = useState<SharedMemoryEntry[]>([])

  // Analysis history
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyResults, setHistoryResults] = useState<AnalysisThought[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    backend.editorSidebar.listAvailableActions()
      .then((res) => setAvailableActions(res.actions))
      .catch(() => setAvailableActions(['summarize', 'analyze', 'fetch-data']))
  }, [backend])

  const executeAction = useCallback(async (type: ActionType) => {
    if (type !== 'summarize' && !promptInput.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setActiveAction(type)

    try {
      const res = await backend.editorSidebar.executeSidebarAction({
        type,
        prompt: promptInput.trim() || '',
        documentId,
      })
      setResult(res.action.result ?? null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [backend, documentId, promptInput])

  const insertIntoDocument = useCallback((content: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(content).run()
  }, [editor])

  const insertImageIntoDocument = useCallback((base64: string, alt: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(
      `<img src="data:image/png;base64,${base64}" alt="${alt}" />`
    ).run()
  }, [editor])

  // Load shared memory when panel opens
  useEffect(() => {
    if (!memoryOpen) return
    backend.memory.listShared({ category: 'regime' })
      .then((res) => setMemoryEntries(res.entries ?? []))
      .catch(() => {})
  }, [memoryOpen, backend])

  // Search analysis history
  const searchHistory = useCallback(async () => {
    if (!historyQuery.trim()) return
    setHistoryLoading(true)
    try {
      const res = await backend.memory.searchAnalysis(historyQuery, { limit: 10 })
      setHistoryResults(res.results ?? [])
    } catch {
      setHistoryResults([])
    } finally {
      setHistoryLoading(false)
    }
  }, [backend, historyQuery])

  return (
    <div className="flex flex-col h-full w-72 border-l border-[#c79f4a]/10 bg-[#0a0a08] overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#c79f4a]/10">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[#c79f4a]">
          <Wand2 size={12} />
          <span>Agent Sidebar</span>
        </div>
      </div>

      {/* Prompt input */}
      <div className="px-3 py-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && activeAction) executeAction(activeAction)
          }}
          placeholder="Instrument, query, or description..."
          className="w-full bg-[#050402] border border-[#c79f4a]/15 rounded px-2 py-1.5 text-xs text-[#f0ead6] placeholder:text-[#f0ead6]/25 outline-none focus:border-[#c79f4a]/40"
        />
      </div>

      {/* Action buttons */}
      <div className="px-3 pb-2 flex flex-col gap-1">
        {ACTION_CONFIG.map((cfg) => {
          const disabled = cfg.computerUse && !availableActions.includes(cfg.type)
          return (
            <button
              key={cfg.type}
              type="button"
              disabled={loading || disabled}
              onClick={() => executeAction(cfg.type)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors
                ${disabled
                  ? 'text-[#f0ead6]/20 cursor-not-allowed'
                  : 'text-[#f0ead6]/70 hover:text-[#f0ead6] hover:bg-[#c79f4a]/10'
                }
                ${activeAction === cfg.type && loading ? 'bg-[#c79f4a]/10 text-[#c79f4a]' : ''}
              `}
            >
              {activeAction === cfg.type && loading ? <Loader2 size={14} className="animate-spin" /> : cfg.icon}
              <span>{cfg.label}</span>
              {disabled && <AlertCircle size={10} className="ml-auto text-[#f0ead6]/15" />}
            </button>
          )
        })}
      </div>

      {/* Result area */}
      {(result || error) && (
        <div className="px-3 py-2 border-t border-[#c79f4a]/10">
          {error && (
            <div className="text-xs text-red-400/80 mb-2">{error}</div>
          )}
          {result?.content && (
            <div className="text-xs text-[#f0ead6]/80 whitespace-pre-wrap max-h-60 overflow-y-auto mb-2 leading-relaxed">
              {result.content}
            </div>
          )}
          {result?.imageBase64 && (
            <div className="mb-2">
              <img
                src={`data:image/png;base64,${result.imageBase64}`}
                alt="Sidebar result"
                className="w-full rounded border border-[#c79f4a]/10"
              />
            </div>
          )}
          <div className="flex gap-1">
            {result?.content && (
              <button
                type="button"
                onClick={() => insertIntoDocument(result.content!)}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#c79f4a] border border-[#c79f4a]/20 hover:bg-[#c79f4a]/10 transition-colors"
              >
                <ArrowDownToLine size={10} />
                Insert Text
              </button>
            )}
            {result?.imageBase64 && (
              <button
                type="button"
                onClick={() => insertImageIntoDocument(result.imageBase64!, promptInput || 'chart')}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#c79f4a] border border-[#c79f4a]/20 hover:bg-[#c79f4a]/10 transition-colors"
              >
                <ArrowDownToLine size={10} />
                Insert Image
              </button>
            )}
          </div>
        </div>
      )}

      {/* Shared Memory panel */}
      <div className="border-t border-[#c79f4a]/10">
        <button
          type="button"
          onClick={() => setMemoryOpen(!memoryOpen)}
          className="flex items-center gap-1.5 px-3 py-2 w-full text-xs text-[#f0ead6]/50 hover:text-[#f0ead6]/80 transition-colors"
        >
          {memoryOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Brain size={12} />
          <span>Shared Memory</span>
          {memoryEntries.length > 0 && (
            <span className="ml-auto text-[10px] text-[#c79f4a]/50">{memoryEntries.length}</span>
          )}
        </button>
        {memoryOpen && (
          <div className="px-3 pb-2 max-h-40 overflow-y-auto">
            {memoryEntries.length === 0 && (
              <div className="text-[10px] text-[#f0ead6]/25">No shared memory entries</div>
            )}
            {memoryEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => insertIntoDocument(
                  `> **[Shared Memory: ${entry.key}]**\n> ${JSON.stringify(entry.value).slice(0, 300)}\n\n`
                )}
                className="block w-full text-left px-2 py-1 mb-0.5 rounded text-[10px] text-[#f0ead6]/60 hover:bg-[#c79f4a]/10 hover:text-[#f0ead6]/80 transition-colors truncate"
              >
                <span className="text-[#c79f4a]/60 font-medium">{entry.key}</span>
                {' — '}
                {entry.agentName && <span className="text-[#f0ead6]/40">{entry.agentName} · </span>}
                {JSON.stringify(entry.value).slice(0, 80)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Analysis History panel */}
      <div className="border-t border-[#c79f4a]/10">
        <button
          type="button"
          onClick={() => setHistoryOpen(!historyOpen)}
          className="flex items-center gap-1.5 px-3 py-2 w-full text-xs text-[#f0ead6]/50 hover:text-[#f0ead6]/80 transition-colors"
        >
          {historyOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Clock size={12} />
          <span>Analysis History</span>
        </button>
        {historyOpen && (
          <div className="px-3 pb-2">
            <div className="flex gap-1 mb-1.5">
              <input
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchHistory() }}
                placeholder="Search analyses..."
                className="flex-1 bg-[#050402] border border-[#c79f4a]/15 rounded px-2 py-1 text-[10px] text-[#f0ead6] placeholder:text-[#f0ead6]/20 outline-none focus:border-[#c79f4a]/40"
              />
              <button
                type="button"
                onClick={searchHistory}
                disabled={historyLoading}
                className="px-1.5 rounded border border-[#c79f4a]/15 text-[#f0ead6]/50 hover:text-[#f0ead6] hover:bg-[#c79f4a]/10 transition-colors"
              >
                {historyLoading ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {historyResults.length === 0 && historyQuery && !historyLoading && (
                <div className="text-[10px] text-[#f0ead6]/25">No results</div>
              )}
              {historyResults.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => insertIntoDocument(
                    `> **[${t.agent} — ${t.title ?? 'Analysis'}]** (${new Date(t.createdAt).toLocaleDateString()})\n> ${t.briefSummary}\n\n`
                  )}
                  className="block w-full text-left px-2 py-1 mb-0.5 rounded hover:bg-[#c79f4a]/10 transition-colors"
                >
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-[#c79f4a]/70 font-medium">{t.agent}</span>
                    <span className="text-[#f0ead6]/25">·</span>
                    <span className="text-[#f0ead6]/40">{new Date(t.createdAt).toLocaleDateString()}</span>
                    {t.instruments.length > 0 && (
                      <span className="text-[#f0ead6]/30 ml-auto">{t.instruments.join(', ')}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#f0ead6]/50 truncate mt-0.5">
                    {t.briefSummary.slice(0, 120)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

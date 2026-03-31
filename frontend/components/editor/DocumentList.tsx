// [claude-code 2026-03-31] S12-T2: Document list — search, tag filter, create/open docs

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, FileText, Loader2, Trash2 } from 'lucide-react'
import { useBackend } from '../../lib/backend'
import type { DocumentRecord } from '../../lib/services'

interface DocumentListProps {
  onSelectDocument: (id: string) => void
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function DocumentList({ onSelectDocument }: DocumentListProps) {
  const backend = useBackend()
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchDocuments = useCallback(
    async (searchQuery?: string, tags?: string[]) => {
      try {
        const params: { search?: string; tags?: string[] } = {}
        if (searchQuery) params.search = searchQuery
        if (tags?.length) params.tags = tags
        const { documents: docs } = await backend.documents.listDocuments(params)
        setDocuments(docs)
      } catch (err) {
        console.error('[DocumentList] Failed to fetch documents:', err)
      } finally {
        setLoading(false)
      }
    },
    [backend]
  )

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearch(value)
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = setTimeout(() => {
        fetchDocuments(value, activeTags)
      }, 300)
    },
    [fetchDocuments, activeTags]
  )

  const handleTagToggle = useCallback(
    (tag: string) => {
      setActiveTags((prev) => {
        const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        fetchDocuments(search, next)
        return next
      })
    },
    [fetchDocuments, search]
  )

  const handleCreate = useCallback(async () => {
    setCreating(true)
    try {
      const { document: doc } = await backend.documents.createDocument({ title: 'Untitled' })
      onSelectDocument(doc.id)
    } catch (err) {
      console.error('[DocumentList] Failed to create document:', err)
    } finally {
      setCreating(false)
    }
  }, [backend, onSelectDocument])

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      try {
        await backend.documents.deleteDocument(id)
        setDocuments((prev) => prev.filter((d) => d.id !== id))
      } catch (err) {
        console.error('[DocumentList] Failed to delete document:', err)
      }
    },
    [backend]
  )

  // Gather all unique tags across documents
  const allTags = Array.from(new Set(documents.flatMap((d) => d.tags))).sort()

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  return (
    <div className="flex h-full flex-col bg-[#050402]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#c79f4a]/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-[#f0ead6]">Documents</h2>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-lg border border-[#c79f4a]/20 bg-[#c79f4a]/10 px-3 py-1.5 text-xs font-medium text-[#c79f4a] transition-colors hover:bg-[#c79f4a]/20 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          New Document
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border border-[#c79f4a]/10 bg-[#0a0a08] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-[#f0ead6]/30" />
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search documents..."
            className="flex-1 bg-transparent text-xs text-[#f0ead6] placeholder:text-[#f0ead6]/30 outline-none"
          />
        </div>
      </div>

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagToggle(tag)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                activeTags.includes(tag)
                  ? 'bg-[#c79f4a]/20 text-[#c79f4a] border border-[#c79f4a]/30'
                  : 'bg-[#f0ead6]/5 text-[#f0ead6]/40 border border-transparent hover:text-[#f0ead6]/60'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#c79f4a]" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-3 h-10 w-10 text-[#f0ead6]/10" />
            <p className="text-sm text-[#f0ead6]/40">No documents yet.</p>
            <p className="text-xs text-[#f0ead6]/20">Create your first.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelectDocument(doc.id)}
                className="group flex w-full items-start gap-3 rounded-lg border border-[#c79f4a]/10 bg-[#0a0a08] px-3 py-2.5 text-left transition-colors hover:border-[#c79f4a]/20 hover:bg-[#0a0a08]/80"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#c79f4a]/40" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#f0ead6] truncate">
                    {doc.title || 'Untitled'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[#f0ead6]/30">
                      {relativeTime(doc.updatedAt)}
                    </span>
                    {doc.tags.length > 0 && (
                      <div className="flex gap-1">
                        {doc.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[#c79f4a]/10 px-1.5 py-px text-[9px] text-[#c79f4a]/60"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, doc.id)}
                  className="mt-0.5 rounded p-1 text-[#f0ead6]/0 transition-colors group-hover:text-[#f0ead6]/20 hover:!text-red-400/60 hover:!bg-red-400/10"
                  title="Delete document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

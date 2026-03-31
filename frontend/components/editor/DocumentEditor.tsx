// [claude-code 2026-03-31] S12-T2: TipTap document editor with catalyst @mention, auto-save, Solvys Gold theme
// [claude-code 2026-04-01] S13-T3: Added agentic sidebar toggle

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Mention from '@tiptap/extension-mention'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered,
  Code, Quote, Minus, ArrowLeft, Check, Loader2, Wand2,
} from 'lucide-react'
import { useBackend } from '../../lib/backend'
import type { DocumentRecord } from '../../lib/services'
import { AgenticSidebar } from './AgenticSidebar'

interface DocumentEditorProps {
  documentId: string
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Catalyst @mention suggestion
// ---------------------------------------------------------------------------

function createMentionSuggestion(backend: ReturnType<typeof useBackend>) {
  return {
    items: async ({ query }: { query: string }) => {
      if (!query || query.length < 2) return []
      try {
        const res = await backend.riskflow.list({ limit: 10 })
        const items = res.items || []
        const q = query.toLowerCase()
        return items
          .filter((item) => (item.title || '').toLowerCase().includes(q))
          .slice(0, 8)
          .map((item) => ({
            id: item.id,
            label: item.title || 'Untitled catalyst',
            source: item.source || '',
          }))
      } catch {
        return []
      }
    },
    render: () => {
      let popup: HTMLDivElement | null = null
      let currentItems: Array<{ id: string; label: string; source: string }> = []
      let selectedIndex = 0
      let command: ((item: { id: string; label: string }) => void) | null = null

      function updatePopup() {
        const el = popup
        if (!el) return
        // Clear children safely (no innerHTML)
        while (el.firstChild) el.removeChild(el.firstChild)
        if (currentItems.length === 0) {
          el.style.display = 'none'
          return
        }
        el.style.display = 'block'
        currentItems.forEach((item, index) => {
          const div = document.createElement('div')
          div.className = `px-3 py-1.5 text-sm cursor-pointer ${
            index === selectedIndex
              ? 'bg-[#c79f4a]/20 text-[#f0ead6]'
              : 'text-[#f0ead6]/70 hover:bg-[#c79f4a]/10'
          }`
          div.textContent = item.label
          div.addEventListener('mousedown', (e) => {
            e.preventDefault()
            command?.({ id: item.id, label: item.label })
          })
          el.appendChild(div)
        })
      }

      return {
        onStart: (props: any) => {
          command = props.command
          popup = document.createElement('div')
          popup.className = 'absolute z-50 rounded-lg border border-[#c79f4a]/20 bg-[#0a0a08] shadow-lg overflow-hidden max-h-48 overflow-y-auto'
          popup.style.width = '280px'
          const { view } = props.editor
          const coords = view.coordsAtPos(props.range.from)
          popup.style.position = 'fixed'
          popup.style.left = `${coords.left}px`
          popup.style.top = `${coords.bottom + 4}px`
          document.body.appendChild(popup)
          currentItems = props.items
          selectedIndex = 0
          updatePopup()
        },
        onUpdate: (props: any) => {
          command = props.command
          currentItems = props.items
          selectedIndex = 0
          updatePopup()
        },
        onKeyDown: (props: any) => {
          const { event } = props
          if (event.key === 'ArrowUp') {
            selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length
            updatePopup()
            return true
          }
          if (event.key === 'ArrowDown') {
            selectedIndex = (selectedIndex + 1) % currentItems.length
            updatePopup()
            return true
          }
          if (event.key === 'Enter') {
            if (currentItems[selectedIndex]) {
              command?.(currentItems[selectedIndex])
            }
            return true
          }
          if (event.key === 'Escape') {
            popup?.remove()
            popup = null
            return true
          }
          return false
        },
        onExit: () => {
          popup?.remove()
          popup = null
        },
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Toolbar Button
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-[#c79f4a]/20 text-[#c79f4a]'
          : 'text-[#f0ead6]/50 hover:text-[#f0ead6] hover:bg-[#f0ead6]/5'
      }`}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// DocumentEditor
// ---------------------------------------------------------------------------

export function DocumentEditor({ documentId, onBack }: DocumentEditorProps) {
  const backend = useBackend()
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const docRef = useRef<DocumentRecord | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
          style: 'color: #c79f4a; background: rgba(199,159,74,0.12); padding: 1px 4px; border-radius: 4px; font-weight: 500;',
        },
        suggestion: createMentionSuggestion(backend),
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px] text-[#f0ead6] px-4 py-3',
      },
    },
    onUpdate: ({ editor: ed }) => {
      scheduleSave({ content: ed.getJSON() })
    },
  })

  // Load document on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { document: doc } = await backend.documents.getDocument(documentId)
        if (cancelled) return
        docRef.current = doc
        setTitle(doc.title)
        setTagsInput(doc.tags.join(', '))
        if (editor && doc.content && Object.keys(doc.content).length > 0) {
          editor.commands.setContent(doc.content)
        }
      } catch (err) {
        console.error('[DocumentEditor] Failed to load document:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [documentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback(
    (updates: { title?: string; content?: Record<string, unknown>; tags?: string[] }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving')
        try {
          const { document: doc } = await backend.documents.updateDocument(documentId, updates)
          docRef.current = doc
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (err) {
          console.error('[DocumentEditor] Auto-save failed:', err)
          setSaveStatus('idle')
        }
      }, 1000)
    },
    [backend, documentId]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value)
      scheduleSave({ title: e.target.value })
    },
    [scheduleSave]
  )

  const handleTagsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTagsInput(e.target.value)
      const tags = e.target.value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      scheduleSave({ tags })
    },
    [scheduleSave]
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#c79f4a]" />
      </div>
    )
  }

  const iconSize = 16

  return (
    <div className="flex h-full flex-col bg-[#050402]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#c79f4a]/10 px-4 py-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded p-1 text-[#f0ead6]/50 hover:text-[#f0ead6] hover:bg-[#f0ead6]/5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-xs text-[#f0ead6]/40">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-3 w-3 text-[#c79f4a]" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-4 pt-4">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl font-bold text-[#f0ead6] placeholder:text-[#f0ead6]/30 outline-none border-none"
        />
      </div>

      {/* Tags */}
      <div className="px-4 pt-2 pb-1">
        <input
          type="text"
          value={tagsInput}
          onChange={handleTagsChange}
          placeholder="Tags (comma-separated)"
          className="w-full bg-transparent text-xs text-[#f0ead6]/60 placeholder:text-[#f0ead6]/20 outline-none border-none"
        />
      </div>

      {/* Toolbar */}
      {editor && (
        <div className="flex items-center gap-0.5 border-y border-[#c79f4a]/10 px-4 py-1">
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
            <Bold size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
            <Italic size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
            <UnderlineIcon size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
            <Strikethrough size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[#c79f4a]/10" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
            <Heading1 size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
            <Heading2 size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
            <Heading3 size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[#c79f4a]/10" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
            <List size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered List">
            <ListOrdered size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[#c79f4a]/10" />

          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code Block">
            <Code size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
            <Quote size={iconSize} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
            <Minus size={iconSize} />
          </ToolbarButton>

          <div className="mx-1 h-4 w-px bg-[#c79f4a]/10" />

          <ToolbarButton onClick={() => setSidebarOpen(!sidebarOpen)} active={sidebarOpen} title="Agent Sidebar">
            <Wand2 size={iconSize} />
          </ToolbarButton>
        </div>
      )}

      {/* Editor + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
        {sidebarOpen && (
          <AgenticSidebar documentId={documentId} editor={editor} />
        )}
      </div>
    </div>
  )
}

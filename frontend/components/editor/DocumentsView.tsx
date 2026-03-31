// [claude-code 2026-03-31] S12-T2: Documents view — switches between list and editor

import React, { useState, useCallback } from 'react'
import { DocumentList } from './DocumentList'
import { DocumentEditor } from './DocumentEditor'

export function DocumentsView() {
  const [activeDocId, setActiveDocId] = useState<string | null>(null)

  const handleSelectDocument = useCallback((id: string) => {
    setActiveDocId(id)
  }, [])

  const handleBack = useCallback(() => {
    setActiveDocId(null)
  }, [])

  if (activeDocId) {
    return <DocumentEditor documentId={activeDocId} onBack={handleBack} />
  }

  return <DocumentList onSelectDocument={handleSelectDocument} />
}

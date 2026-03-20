// [claude-code 2026-03-11] Individual desk card for Team Dashboard
import React from 'react'
import type { DeskReportSummary, AgentName } from '../../types/context-bank'

interface DeskCardProps {
  agent: AgentName
  role: string
  report: DeskReportSummary | null
}

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return '#4ade80'
  if (confidence >= 60) return '#c79f4a'
  if (confidence >= 40) return '#eab308'
  return '#ef4444'
}

function timeSince(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h`
}

export function DeskCard({ agent, role, report }: DeskCardProps) {
  const hasReport = !!report
  const borderColor = hasReport ? 'rgba(199,159,74,0.4)' : 'rgba(199,159,74,0.12)'
  const bgColor = hasReport ? 'rgba(199,159,74,0.06)' : 'rgba(199,159,74,0.02)'

  return (
    <div style={{
      padding: '10px 12px',
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minHeight: 90,
      transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#c79f4a', fontWeight: 700, fontSize: 13, fontFamily: 'monospace' }}>
            {agent}
          </div>
          <div style={{ color: '#f0ead6', opacity: 0.4, fontSize: 10, fontFamily: 'monospace' }}>
            {role}
          </div>
        </div>
        {hasReport && (
          <div style={{
            color: confidenceColor(report.confidence),
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 600,
          }}>
            {report.confidence}%
          </div>
        )}
      </div>

      {/* Report Content */}
      {hasReport ? (
        <>
          <div style={{
            color: '#f0ead6',
            fontSize: 11,
            lineHeight: 1.4,
            opacity: 0.8,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {report.summary}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'monospace' }}>
              {report.alertCount > 0 && (
                <span style={{ color: '#eab308' }}>
                  {report.alertCount} alert{report.alertCount !== 1 ? 's' : ''}
                </span>
              )}
              <span style={{ color: '#f0ead6', opacity: 0.3 }}>
                v{report.snapshotVersion}
              </span>
            </div>
            <span style={{ color: '#f0ead6', opacity: 0.3, fontSize: 10, fontFamily: 'monospace' }}>
              {timeSince(report.timestamp)}
            </span>
          </div>
        </>
      ) : (
        <div style={{ color: '#f0ead6', opacity: 0.2, fontSize: 11, fontFamily: 'monospace', marginTop: 'auto' }}>
          Awaiting report
        </div>
      )}
    </div>
  )
}

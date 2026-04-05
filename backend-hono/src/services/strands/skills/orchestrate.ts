// [claude-code 2026-04-04] Solvys Orchestrate skill — parallel Claude Code instances
import { tool } from '@strands-agents/sdk'
import { z } from 'zod'

export const solvysOrchestrateTool = tool({
  name: 'solvys_orchestrate',
  description: 'Orchestrate parallel Claude Code instances for large features. Splits work into tracks, generates briefs, and monitors execution.',
  inputSchema: z.object({
    feature: z.string().describe('The feature or sprint to orchestrate'),
    tracks: z.array(z.object({
      id: z.string().describe('Track ID (e.g., T1, T2)'),
      title: z.string().describe('Track title'),
      scope: z.string().describe('What this track covers'),
      files: z.array(z.string()).optional().describe('Key files for this track'),
    })).describe('Track definitions (max 10)'),
    maxParallel: z.number().optional().describe('Max parallel tracks (default 3)'),
  }),
  callback: async (input: { feature: string; tracks: Array<{ id: string; title: string; scope: string; files?: string[] }>; maxParallel?: number }) => {
    const maxP = Math.min(input.maxParallel ?? 3, 10)
    const orchestration = [
      `=== Orchestration Plan: ${input.feature} ===`,
      `Tracks: ${input.tracks.length} | Max parallel: ${maxP}`,
      '',
    ]

    for (const track of input.tracks) {
      orchestration.push(
        `## ${track.id}: ${track.title}`,
        `Scope: ${track.scope}`,
        track.files?.length ? `Files: ${track.files.join(', ')}` : '',
        '',
      )
    }

    orchestration.push(
      '## Execution Order',
      `Wave 1: ${input.tracks.slice(0, maxP).map((t) => t.id).join(', ')}`,
      input.tracks.length > maxP ? `Wave 2: ${input.tracks.slice(maxP).map((t) => t.id).join(', ')}` : '',
    )

    return orchestration.join('\n')
  },
})

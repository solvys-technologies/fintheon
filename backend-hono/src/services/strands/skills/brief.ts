// [claude-code 2026-04-04] Solvys Brief skill — generate a self-contained track brief
import { tool } from '@strands-agents/sdk'
import { z } from 'zod'

export const solvysBriefTool = tool({
  name: 'solvys_brief',
  description: 'Generate a self-contained task brief for handing off to a fresh Claude Code instance. Includes context, goals, constraints, and file references.',
  inputSchema: z.object({
    task: z.string().describe('What the brief is for — the task or feature to hand off'),
    files: z.array(z.string()).optional().describe('Key file paths to include as context'),
    constraints: z.string().optional().describe('Any constraints or requirements'),
  }),
  callback: async (input: { task: string; files?: string[]; constraints?: string }) => {
    const brief = [
      `# Task Brief: ${input.task}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Objective',
      input.task,
      '',
    ]

    if (input.files?.length) {
      brief.push('## Key Files', ...input.files.map((f) => `- \`${f}\``), '')
    }

    if (input.constraints) {
      brief.push('## Constraints', input.constraints, '')
    }

    brief.push(
      '## Instructions',
      '1. Read the key files listed above',
      '2. Understand the existing patterns before making changes',
      '3. Follow CLAUDE.md conventions (changelog, version branching)',
      '4. Run `bun run build` after changes',
      '',
    )

    return brief.join('\n')
  },
})

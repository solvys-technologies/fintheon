// [claude-code 2026-04-19] S27-T11 W2e: GEPA PR creator.
//   NEVER writes to main-branch SOUL files. Opens a PR against a soul-evolution/<agent>-<timestamp>
//   branch with the candidate evolution, baseline metrics, projected delta, and projected risk.
//   Human review is the only merge path.

import { mkdir, writeFile } from "node:fs/promises";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";

const execFile = promisify(_execFile);

const REPO_ROOT = resolve(new URL("../../../../", import.meta.url).pathname);
const EVOLUTION_DIR = join(REPO_ROOT, "soul-evolution");

export interface PrProposal {
  agent_id: string;
  timestamp: string;
  candidate_body: string; // full SOUL.md candidate
  baseline_metrics: Record<string, number>;
  projected_delta: Record<string, number>;
  projected_risk: string;
  optimization_run_id: string;
}

export interface PrResult {
  branch: string;
  file_path: string;
  pr_url: string | null;
  pr_opened: boolean;
  dry_run: boolean;
  reason?: string;
}

function formatPercent(n: number | undefined): string {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  const pct = n * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function buildPrBody(proposal: PrProposal): string {
  const metricRows = Object.entries(proposal.baseline_metrics)
    .map(([k, v]) => {
      const delta = proposal.projected_delta[k];
      return `| ${k} | ${v.toFixed(3)} | ${formatPercent(delta)} |`;
    })
    .join("\n");

  return `## GEPA evolution proposal — ${proposal.agent_id}

_optimization run: ${proposal.optimization_run_id}_

### Baseline vs projected

| metric | baseline | projected Δ |
|---|---|---|
${metricRows}

### Projected risk

${proposal.projected_risk}

### Safety rails

- Auto-closes after 7 days of no review
- If 3 consecutive evolutions for ${proposal.agent_id} are rejected, GEPA pauses this agent for 14 days
- Prompt size cap: evolution cannot exceed +25% of current SOUL.md length

**GEPA never auto-merges.** Review the diff, run \`/solvys-test\` on the staged SOUL before approving.
`;
}

function dryRunDisabled(): boolean {
  return process.env.GEPA_DRY_RUN === "true";
}

/**
 * Write the candidate to soul-evolution/<agent>/<timestamp>.md, create a branch,
 * commit, push, and open a PR. Returns dry_run: true if gh is not installed or GEPA_DRY_RUN=true.
 */
export async function createEvolutionPr(
  proposal: PrProposal,
): Promise<PrResult> {
  const candidateDir = join(EVOLUTION_DIR, proposal.agent_id);
  await mkdir(candidateDir, { recursive: true });
  const file_path = join(candidateDir, `${proposal.timestamp}.md`);
  await writeFile(file_path, proposal.candidate_body, "utf8");

  const branch = `soul-evolution/${proposal.agent_id}-${proposal.timestamp}`;

  if (dryRunDisabled()) {
    return {
      branch,
      file_path,
      pr_url: null,
      pr_opened: false,
      dry_run: true,
      reason: "GEPA_DRY_RUN=true",
    };
  }

  try {
    // Create + switch to the evolution branch (from current HEAD of the worktree).
    await execFile("git", ["checkout", "-b", branch], { cwd: REPO_ROOT });
    await execFile("git", ["add", file_path], { cwd: REPO_ROOT });
    await execFile(
      "git",
      [
        "commit",
        "-m",
        `gepa: evolution candidate for ${proposal.agent_id} (${proposal.timestamp})`,
      ],
      { cwd: REPO_ROOT },
    );
    await execFile("git", ["push", "-u", "origin", branch], {
      cwd: REPO_ROOT,
    });

    const body = buildPrBody(proposal);
    const { stdout } = await execFile(
      "gh",
      [
        "pr",
        "create",
        "--base",
        "v5.22",
        "--head",
        branch,
        "--title",
        `gepa: ${proposal.agent_id} evolution ${proposal.timestamp}`,
        "--body",
        body,
      ],
      { cwd: REPO_ROOT },
    );

    return {
      branch,
      file_path,
      pr_url: stdout.trim(),
      pr_opened: true,
      dry_run: false,
    };
  } catch (err) {
    return {
      branch,
      file_path,
      pr_url: null,
      pr_opened: false,
      dry_run: true,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

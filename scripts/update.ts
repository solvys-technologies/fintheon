#!/usr/bin/env bun
// [claude-code 2026-03-22] Fintheon CLI Update — pull latest, rebuild, restart
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { resolve, join } from 'path';
import { runCommand, isFintheonRunning, waitForHealth } from './setup-utils';

const ROOT = resolve(import.meta.dir, '..');
const BACKEND_DIR = join(ROOT, 'backend-hono');
const FRONTEND_DIR = join(ROOT, 'frontend');

async function main() {
  console.log('');
  p.intro(pc.yellow('Fintheon Update'));

  // Step 1: Check current version
  const currentVersion = await runCommand('git', ['describe', '--tags', '--always'], { cwd: ROOT });
  const currentBranch = await runCommand('git', ['branch', '--show-current'], { cwd: ROOT });
  p.log.info(`Current: ${pc.dim(currentVersion.stdout.trim())} on ${pc.dim(currentBranch.stdout.trim())}`);

  // Step 2: Check for uncommitted changes
  const status = await runCommand('git', ['status', '--porcelain'], { cwd: ROOT });
  if (status.stdout.trim()) {
    p.log.warn('You have uncommitted changes:');
    console.log(pc.dim(status.stdout.trim()));
    const proceed = await p.confirm({
      message: 'Stash changes and continue?',
      initialValue: false,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel('Update cancelled. Commit or stash your changes first.');
      process.exit(0);
    }
    const stash = p.spinner();
    stash.start('Stashing changes');
    await runCommand('git', ['stash', 'push', '-m', 'fintheon-update-auto-stash'], { cwd: ROOT });
    stash.stop('Changes stashed');
  }

  // Step 3: Fetch + pull (prune stale tags + branches)
  const pullSpinner = p.spinner();
  pullSpinner.start('Pulling latest changes');
  await runCommand('git', ['fetch', '--all', '--prune', '--prune-tags'], { cwd: ROOT });
  // Also force-sync tags so deleted remote tags are removed locally
  await runCommand('git', ['fetch', '--tags', '--force'], { cwd: ROOT });
  const pull = await runCommand('git', ['pull', '--rebase'], { cwd: ROOT });

  if (!pull.ok) {
    pullSpinner.stop('Pull failed');
    p.log.error(pull.stderr.slice(0, 300));
    p.log.info('Resolve conflicts manually, then re-run: bun run update');
    process.exit(1);
  }

  if (pull.stdout.includes('Already up to date')) {
    pullSpinner.stop('Already up to date');
    p.outro(pc.yellow('No updates available.'));
    return;
  }

  pullSpinner.stop('Latest changes pulled');

  // Step 4: Install deps (in case package.json changed)
  const workspaces = [
    { name: 'root', dir: ROOT },
    { name: 'frontend', dir: FRONTEND_DIR },
    { name: 'backend-hono', dir: BACKEND_DIR },
  ];

  for (const ws of workspaces) {
    const s = p.spinner();
    s.start(`Installing ${ws.name} dependencies`);
    const result = await runCommand('bun', ['install'], { cwd: ws.dir });
    s.stop(result.ok ? `${ws.name} deps installed` : `${ws.name} install failed`);
  }

  // Step 5: Rebuild backend
  const buildSpinner = p.spinner();
  buildSpinner.start('Rebuilding backend');
  const build = await runCommand('bun', ['run', 'build'], { cwd: BACKEND_DIR });
  if (build.ok) {
    buildSpinner.stop('Backend rebuilt');
  } else {
    buildSpinner.stop('Backend build failed');
    p.log.error(build.stderr.slice(0, 300));
  }

  // Step 6: Rebuild frontend
  const feBuildSpinner = p.spinner();
  feBuildSpinner.start('Rebuilding frontend');
  const feBuild = await runCommand('bunx', ['vite', 'build'], { cwd: FRONTEND_DIR });
  if (feBuild.ok) {
    feBuildSpinner.stop('Frontend rebuilt');
  } else {
    feBuildSpinner.stop('Frontend build failed');
    p.log.warn(feBuild.stderr.slice(0, 200));
  }

  // Step 7: Restart backend if it was running
  const wasRunning = await isFintheonRunning(8080);
  if (wasRunning) {
    p.log.info('Backend was running — it will pick up changes on next restart');
    p.log.info(`Restart manually: ${pc.cyan('cd backend-hono && bun run dev')}`);
  }

  // Step 8: Show new version
  const newVersion = await runCommand('git', ['describe', '--tags', '--always'], { cwd: ROOT });
  const newLog = await runCommand('git', ['log', '--oneline', '-5'], { cwd: ROOT });

  console.log('');
  p.log.success(pc.bold('Update Complete'));
  console.log('');
  console.log(`  Version: ${pc.yellow(newVersion.stdout.trim())}`);
  console.log(pc.dim('  Recent commits:'));
  for (const line of newLog.stdout.trim().split('\n').slice(0, 5)) {
    console.log(pc.dim(`    ${line}`));
  }
  console.log('');

  // Unstash if we stashed earlier
  if (status.stdout.trim()) {
    const unstash = await p.confirm({
      message: 'Restore your stashed changes?',
      initialValue: true,
    });
    if (!p.isCancel(unstash) && unstash) {
      const us = p.spinner();
      us.start('Restoring stashed changes');
      const pop = await runCommand('git', ['stash', 'pop'], { cwd: ROOT });
      us.stop(pop.ok ? 'Changes restored' : 'Stash pop had conflicts — resolve manually');
    }
  }

  p.outro(pc.yellow('Happy trading.'));
}

main().catch((err) => {
  p.log.error(`Update failed: ${err.message}`);
  process.exit(1);
});

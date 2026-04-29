# Fintheon Agent Takeover Bundle

Snapshot bundled **2026-04-26** from `~/Documents/Codebases/fintheon` and `~/.claude/`.

Unzip this anywhere, point a fresh Claude Code (or Agent SDK) instance at it, and you have everything needed to assume the **Chief Agentic Officer (CAO)** seat for **Solvys Technologies** / **Priced In Capital** / **Priced In Research**.

---

## What's in the box

```
fintheon-agent-takeover/
├── README.md                         ← you are here
├── claude/
│   └── CLAUDE.md                     ← combined global + workspace rules (the brain)
├── harper/
│   ├── harper.md                     ← Harper SOUL (CAO persona, grounding)
│   ├── oracle.md                     ← desk SOULs (handoff targets)
│   ├── feucht.md
│   ├── consul.md
│   ├── herald.md
│   └── SOUL-README.md                ← schema notes for the SOUL files
├── hooks/
│   ├── README.md                     ← what each hook does
│   ├── SETUP.md                      ← step-by-step install
│   ├── settings.example.json         ← drop-in .claude/settings.json template
│   ├── block-dangerous.sh
│   ├── protect-files.sh
│   ├── require-tests-for-pr.sh
│   ├── log-commands.sh
│   ├── auto-commit.sh
│   └── harper-feed-health.sh
├── prompts/
│   └── cao-takeover.md               ← global prompt — paste at top of any session to become Harper
└── skills/
    ├── solvys-skills/                ← canonical /solvys-* suite (Nothing Design baked into /solvys-feels)
    └── impeccable/                   ← impeccable.style design skills (frontend-design, polish, distill, …)
```

---

## Quickstart — 5 minutes to online

1. **Unzip** to a working directory.
2. **Install hooks** — see [`hooks/SETUP.md`](./hooks/SETUP.md). Two commands: `cp` the scripts into the repo's `.claude/hooks/`, then merge `settings.example.json` into `.claude/settings.json`.
3. **Install skills** — symlink or copy:

   ```bash
   # Solvys suite (global) — /solvys-feels carries the Nothing Design + impeccable.style fusion
   ln -s "$(pwd)/skills/solvys-skills/.claude/skills/"* ~/.claude/skills/

   # Impeccable suite (per-project or global)
   mkdir -p ~/.claude/skills/impeccable
   cp -R skills/impeccable/* ~/.claude/skills/impeccable/
   ```

4. **Drop the brain** — copy [`claude/CLAUDE.md`](./claude/CLAUDE.md) to:
   - `~/.claude/CLAUDE.md` (global), AND
   - `<repo>/CLAUDE.md` (workspace)
     Workspace wins on conflict.
5. **Wire the SOUL** — Harper's SOUL belongs at `<repo>/backend-hono/src/services/ai/soul/harper.md`. The skill at `<repo>/skills/harper/skill.yaml` references this exact path.
6. **Open a fresh Claude Code instance** in the repo. Paste [`prompts/cao-takeover.md`](./prompts/cao-takeover.md) as the system prompt or first message to assume the CAO role.

---

## What this bundle assumes

- macOS Darwin 25.5+ (Intel or Apple Silicon)
- `bash`, `python3`, `git`, `curl`, `bun`, `jq` on PATH
- Fintheon repo cloned to `~/Documents/Codebases/fintheon` (or wherever — the SETUP doc handles relocation)
- `OPENROUTER_API_KEY` set if you want chat (everything else has fallbacks)

---

## Brand non-negotiables (re-stated for emphasis)

- **No emojis. No gradients. No Kanban borders. No AI-sparkle ornaments.** Anywhere.
- **Solvys Gold palette only**: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`.
- **Glass over Kanban** for any card/panel/sheet (but flat surfaces if `backdrop-blur` is banned in this repo's frontend rules).
- **No paid services without TP signoff.** OpenRouter / DashScope / FMP are banned (2026-04-26).
- **Never bypass auth.** Supabase JWT is enforced.

Anything that breaks the above is shipped wrong, regardless of whether the build passes.

---

## Known gaps in this bundle

| Gap                                                                    | Impact                                                                                 | Fix                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Live MCP keys are NOT in this bundle                                   | Tools that need keys (Supabase, Notion, Vercel, Figma, Zapier MCPs) won't authenticate | Restore from password manager / `~/.claude/mcp-needs-auth-cache.json` |
| `~/.openclaw/workspace/` content is referenced by RSIP but not bundled | Self-improvement log starts empty                                                      | Clone separately; not on critical path                                |
| Project memory at `~/.claude/projects/<repo>/memory/` is not bundled   | Conversational context resets                                                          | Memory rebuilds itself; surfaces deltas in the index `MEMORY.md`      |

**Note on Nothing Design:** This is not a separate skill — it's fused into `/solvys-feels` alongside impeccable.style as the canonical visual foundation. The `solvys-feels/SKILL.md` description states the combination explicitly, and `reference/solvys-themes.md` carries the "Maximum Nothing Design alignment" pure-monochrome preset.

---

## Source-of-truth pointers

- **CLAUDE.md** lives at: `~/.claude/CLAUDE.md` (global) + `~/Documents/Codebases/fintheon/CLAUDE.md` (workspace)
- **Harper SOUL** lives at: `~/Documents/Codebases/fintheon/backend-hono/src/services/ai/soul/harper.md`
- **Hooks** live at: `~/Documents/Codebases/fintheon/.claude/hooks/`
- **Solvys skills canonical repo**: `~/Documents/Codebases/solvys-skills/` (NOT `fintheon/.claude/skills` — that's a stale mirror)

If anything in this bundle is older than the source, the source wins. Re-pack from source if more than ~7 days have passed.

---

_Built for TP. Hand to any Claude Code / Agent SDK instance. The seat is yours._

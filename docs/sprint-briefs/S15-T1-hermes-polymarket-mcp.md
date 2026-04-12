# S15-T1: Paper Trader MCP + Hermes Agent Persona Updates

**Sprint:** S15 — Polymarket Integration  
**Track:** T1 of 2 (parallel with T2)  
**Scope:** Install polymarket-paper-trader as MCP server for Hermes, update Oracle/Charles/Harper personas  
**Depends on:** Nothing — runs independently

---

## Context

The Hermes agent team at `~/.hermes/` runs 6 agent personas for Priced In Capital. Oracle (PMA-1) and Charles (PMA-2) currently trade prediction markets on **Kalshi only**. We're adding Polymarket as a **research + practice platform** — NOT live trading. Agents will use Polymarket paper trading to:

1. Test conviction before proposing real Kalshi trades
2. Cross-reference Polymarket vs Kalshi odds for mispricing detection
3. Track prediction accuracy over time
4. Practice new strategies risk-free

The `polymarket-paper-trader` Python package provides 30 MCP tools (init_account, buy, sell, portfolio, stats, backtest, etc.) with real order book execution and zero risk.

**CRITICAL CONSTRAINT: We CANNOT trade live on Polymarket. Only Kalshi. Polymarket = research/practice/signal ONLY.**

---

## Files to Read First

Read these before making any changes — understand the current state:

1. `~/.hermes/config.yaml` — Full config, especially `mcp_servers:` section starting at line 294
2. `~/.hermes/memories/harper-handoff/agent-personas/oracle.md` — Oracle's full persona (PMA-1)
3. `~/.hermes/memories/harper-handoff/agent-personas/charles.md` — Charles's full persona (PMA-2)
4. `~/.hermes/memories/harper-handoff/agent-personas/harper.md` — Harper's CAO mandate
5. `~/.hermes/hermes-agent/skills/research/polymarket/SKILL.md` — Existing read-only Polymarket skill
6. `~/.hermes/hermes-agent/skills/research/polymarket/references/api-endpoints.md` — API reference

---

## Task 1: Install polymarket-paper-trader

```bash
pip install polymarket-paper-trader
```

Verify the MCP command is available:

```bash
pm-trader-mcp --help
# or
pm-trader mcp --help
```

If `pm-trader-mcp` is not found after pip install, check:

```bash
which pm-trader
pm-trader --help
```

The MCP server command may be `pm-trader mcp` (subcommand) rather than `pm-trader-mcp` (standalone). Check the package docs and adjust the config accordingly.

---

## Task 2: Add MCP Server to Hermes Config

**File:** `~/.hermes/config.yaml`

Add a new entry under the `mcp_servers:` section (after the existing entries like `notion`, `exa`, `framer`, `close_crm`):

```yaml
polymarket_paper:
  command: pm-trader-mcp
  args: []
  env: {}
  timeout: 180
```

If the command is `pm-trader` with subcommand `mcp`, use:

```yaml
polymarket_paper:
  command: pm-trader
  args:
    - mcp
  env: {}
  timeout: 180
```

**Do NOT modify any other MCP server entries.** Only add this one new block.

---

## Task 3: Update Oracle Persona

**File:** `~/.hermes/memories/harper-handoff/agent-personas/oracle.md`

Make these specific additions (do NOT rewrite the file — surgically add to existing sections):

### 3a. Update "Desk & Coverage" section

Change:

```
**Platform:** Kalshi
```

To:

```
**Platform:** Kalshi (live execution), Polymarket (research + paper trading)
```

Add to **Coverage** list:

```
- Polymarket binary event markets (crypto, S&P directional, index volatility) — PAPER ONLY, used for conviction testing and odds cross-reference
```

### 3b. Add to "Responsibilities" section

Add these bullets after the existing responsibilities:

```
- **Cross-reference** Polymarket vs Kalshi odds on overlapping markets — divergence >10% flags potential Kalshi mispricing
- **Paper trade** new strategies on Polymarket before proposing live Kalshi execution (minimum 5 paper trades per new strategy)
- **Track prediction accuracy** via paper trading portfolio — win rate and ROI inform conviction levels on Kalshi proposals
```

### 3c. Add to "Tools" section

Add:

```
- **Polymarket Paper Trader (MCP)** — Paper trading simulation with real order books: init_account, buy, sell, portfolio, stats, backtest, market search. Used for research and conviction testing ONLY — no live execution.
- **Polymarket Public APIs** — Gamma API (discovery), CLOB API (prices/orderbooks), Data API (trades/open interest). Read-only, no auth needed.
```

### 3d. Add new "Polymarket Research Protocol" section

Add this as a new section after "Inter-Agent Interactions":

```markdown
## Polymarket Research Protocol

Polymarket is your research lab — NOT your execution venue. Use it to:

### Odds Cross-Reference

When evaluating a Kalshi trade, ALWAYS check if a similar market exists on Polymarket:

- If Polymarket odds diverge >10% from Kalshi → investigate. One platform is mispricing.
- If both platforms agree → crowd consensus is strong. Look harder for your contrarian edge.
- Document the cross-reference in every Trade Idea submitted to Harper.

### Paper Trading Discipline

- Initialize a paper account with $10,000
- Paper trade every new strategy category for at least 5 trades before proposing live Kalshi execution
- Track your paper P&L — share stats with Harper in weekly reviews
- Use backtesting to validate entry/exit rules against historical Polymarket data

### Trade Idea Template (Polymarket-Enriched)

When submitting Kalshi trade ideas, include a Polymarket cross-reference:
```

🎰 ORACLE PREDICTION — [MARKET]

Platform: Kalshi (EXECUTION)
Market: [Description]
Position: [YES / NO] @ [Price]

Polymarket Cross-Reference:

- Polymarket equivalent: [market slug or "no equivalent"]
- Polymarket price: [YES price] vs Kalshi: [YES price]
- Divergence: [X%] — [interpretation]
- Paper trading record on similar markets: [W-L, ROI%]

Thesis:

- [Second-level reasoning]
- [Crowd positioning analysis]
- [Cross-platform divergence insight]
  EVEN Level Alignment: [Y/N + level]
  Expected Value: [Calculation]
  Max Risk: [$X]

```

```

### 3e. Add to "Constraints" section

Add:

```
- **Polymarket is PAPER ONLY** — never propose live Polymarket trades. All execution goes through Kalshi.
- **Cross-reference mandatory** — check Polymarket odds before submitting any Kalshi prediction market proposal
```

---

## Task 4: Update Charles Persona

**File:** `~/.hermes/memories/harper-handoff/agent-personas/charles.md`

Mirror Oracle's updates but scoped to Charles's domain:

### 4a. Update "Desk & Coverage"

Change:

```
**Platform:** Kalshi
```

To:

```
**Platform:** Kalshi (live execution), Polymarket (research + paper trading)
```

Add to **Coverage**:

```
- Polymarket political/economic event markets — PAPER ONLY, used for conviction testing against Kalshi positions
```

### 4b. Add to "Responsibilities"

```
- **Cross-reference** Polymarket vs Kalshi odds on econ/political events — divergence flags potential Kalshi mispricing
- **Paper trade** political prediction strategies on Polymarket before proposing live Kalshi execution
- **Note:** Polymarket often has deeper liquidity on political markets than Kalshi — use this for better price discovery
```

### 4c. Add to "Tools"

```
- **Polymarket Paper Trader (MCP)** — Paper trading simulation: market search, buy, sell, portfolio, stats, backtest. Research and conviction testing ONLY.
- **Polymarket Public APIs** — Market data, orderbooks, price history. Read-only.
```

### 4d. Add "Polymarket Research Protocol" section

Same structure as Oracle's but with Charles-specific framing:

```markdown
## Polymarket Research Protocol

Polymarket is your intelligence gathering platform — NOT your execution venue.

### Political Market Advantage

Polymarket historically has deeper liquidity and more granular political/econ event markets than Kalshi. Use this to:

- Get better price discovery on political events before they're priced on Kalshi
- Monitor smart money positioning on Polymarket as a leading indicator for Kalshi
- Identify events that Polymarket prices differently than Kalshi — these are potential trades

### Sentinel Integration

When Sentinel flags a political or economic event:

1. Check Polymarket for relevant markets and current odds
2. Compare against Kalshi pricing for the same event
3. If divergence exists, include it in your Trade Idea to Harper

### Constraints

- **Polymarket is PAPER ONLY** — all live execution on Kalshi
- **Cross-reference mandatory** — include Polymarket odds in every Kalshi proposal
```

### 4e. Add to "Constraints"

```
- **Polymarket is PAPER ONLY** — never propose live Polymarket trades. Kalshi is the execution venue.
```

---

## Task 5: Update Harper Persona

**File:** `~/.hermes/memories/harper-handoff/agent-personas/harper.md`

### 5a. Update "Scope" line

Change:

```
**Scope:** All desks — Fundamentals, Futures, PMA-1, PMA-2, Risk
```

To:

```
**Scope:** All desks — Fundamentals, Futures, PMA-1, PMA-2, Risk | Platforms: Kalshi (live), Polymarket (research/paper)
```

### 5b. Add to "Decision Framework" table

Add row:

```
| Polymarket cross-reference | Verify divergence claim | Include in proposal routing to H.E.s |
```

### 5c. Update "Inter-Agent Interactions" — Oracle bullet

Change:

```
- **Oracle** → Sends you Kalshi prediction proposals (S&P/Crypto). You check for conviction and second-level reasoning.
```

To:

```
- **Oracle** → Sends you Kalshi prediction proposals (S&P/Crypto) enriched with Polymarket cross-reference. You check for conviction, second-level reasoning, AND cross-platform odds validation.
```

### 5d. Update "Inter-Agent Interactions" — Charles bullet

Change:

```
- **Charles** → Sends you Kalshi prediction proposals (Econ/Politics). You verify Sentinel coordination and Marks framework alignment.
```

To:

```
- **Charles** → Sends you Kalshi prediction proposals (Econ/Politics) enriched with Polymarket cross-reference. You verify Sentinel coordination, Marks framework alignment, AND cross-platform odds validation.
```

---

## Task 6: Upgrade Polymarket Skill

**File:** `~/.hermes/hermes-agent/skills/research/polymarket/SKILL.md`

### 6a. Update "Limitations" section at the bottom

Replace:

```markdown
## Limitations

- This skill is read-only — it does not support placing trades
- Trading requires wallet-based crypto authentication (EIP-712 signatures)
```

With:

```markdown
## Trading (Paper Only)

For paper trading and simulation, use the **polymarket_paper MCP tools** instead of this skill:

- `init_account` — Create paper account with starting balance
- `buy` / `sell` — Execute paper trades against real order books
- `portfolio` — View open positions with live valuations
- `stats` — Win rate, ROI, max drawdown
- `backtest` — Test strategies against historical data
- `search_markets` / `list_markets` — Find markets

This skill (scripts + API reference) is for **market research and data retrieval**.
The MCP tools are for **paper trading and simulation**.

**Live trading on Polymarket is NOT supported** — all live execution goes through Kalshi.
```

### 6b. Add "When to Use" trigger

Add to the existing "When to Use" list:

```
- User wants to paper trade on Polymarket → direct to polymarket_paper MCP tools
- User wants to cross-reference Polymarket vs Kalshi odds on a market
- User wants to backtest a prediction market strategy
```

---

## Verification

1. **MCP install check:**

   ```bash
   pip show polymarket-paper-trader
   pm-trader --version  # or pm-trader-mcp --help
   ```

2. **Config syntax check:**

   ```bash
   python3 -c "import yaml; yaml.safe_load(open('$HOME/.hermes/config.yaml'))" && echo "YAML OK"
   ```

3. **Paper trader smoke test:**

   ```bash
   pm-trader init --balance 10000
   pm-trader markets search "bitcoin"
   pm-trader balance
   ```

4. **Persona files validate:**
   ```bash
   # Check all updated files exist and contain the new sections
   grep -l "Polymarket" ~/.hermes/memories/harper-handoff/agent-personas/oracle.md
   grep -l "Polymarket" ~/.hermes/memories/harper-handoff/agent-personas/charles.md
   grep -l "Polymarket" ~/.hermes/memories/harper-handoff/agent-personas/harper.md
   grep "polymarket_paper" ~/.hermes/config.yaml
   ```

---

## DO NOT

- Do NOT modify any Fintheon codebase files — that's T2's scope
- Do NOT change any existing MCP server entries in config.yaml — only ADD the new one
- Do NOT rewrite persona files from scratch — make surgical additions to existing sections
- Do NOT add live Polymarket trading capabilities — paper only
- Do NOT modify the Kalshi-specific parts of any persona — Kalshi remains the live platform
- Do NOT touch Sentinel, Feucht, or Herald personas — only Oracle, Charles, and Harper

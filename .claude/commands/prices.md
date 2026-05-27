# /prices

Use the `.claude/skills/prices-of-interest` skill.

Derive basis-adjusted prices of interest for the requested futures chart:

- Put wall
- HVL / gamma flip
- Call wall
- Optional max pain or volume POC as a separate center reference

Prefer Unusual Whales data through existing Fintheon endpoints, direct REST, or MCP. If MCP would consume too much context, delegate the data pull to Codex CLI and ask for JSON only.

Always return chart-ready target futures levels, not raw ETF/source levels.

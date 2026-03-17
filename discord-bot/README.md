# Harper-Perp Discord Bot

24/7 Discord runtime for Harper-Perp — the execution intelligence for Priced In Capital's Fintheon platform. Posts scheduled market briefings, trade proposals, volatility alerts, and provides conversational AI in the #boardroom channel.

## Architecture

```
discord-bot/
├── src/
│   ├── index.ts              # Entry point — client init, event registration, cron setup
│   ├── config.ts             # Env vars, channel IDs, constants, thresholds
│   ├── client.ts             # Discord.js client factory with intents
│   ├── channels/             # Channel-specific posting logic
│   │   ├── dispatch-board.ts # MDB/ADB/PMDB posting
│   │   ├── weekly-tribune.ts # TOTT posting
│   │   ├── prediction-markets.ts # Trade proposals with voting reactions
│   │   └── the-tape.ts       # Volatility alerts (@everyone)
│   ├── commands/             # Slash commands
│   │   ├── registry.ts       # Command registration + interaction router
│   │   ├── mdb.ts            # /mdb — latest Dawn Dispatch
│   │   ├── adb.ts            # /adb — latest Afternoon Brief
│   │   ├── pmdb.ts           # /pmdb — latest Post-Market Brief
│   │   ├── tott.ts           # /tott — latest Weekly Tribune
│   │   ├── status.ts         # /status — bot health
│   │   ├── tape.ts           # /tape — current volatility reading
│   │   └── ask.ts            # /ask — freeform market research
│   ├── ai/                   # Conversational AI system
│   │   ├── handler.ts        # #boardroom message handler
│   │   ├── context.ts        # 20-message conversation window
│   │   ├── persona.ts        # Harper-Perp system prompts
│   │   └── research.ts       # Market research via Perplexity
│   ├── integrations/         # External APIs
│   │   ├── notion.ts         # Notion DB queries (briefings + trade ideas)
│   │   ├── perplexity.ts     # Perplexity API (OpenAI SDK wrapper)
│   │   └── market-data.ts    # Yahoo Finance for VIX/NQ data
│   ├── embeds/               # Discord embed builders
│   │   ├── common.ts         # Shared branding, colors, emoji maps
│   │   ├── briefing-embed.ts # MDB/ADB/PMDB embeds
│   │   ├── tribune-embed.ts  # TOTT embeds
│   │   ├── proposal-embed.ts # Trade proposal embeds
│   │   └── alert-embed.ts    # Volatility alert embeds
│   ├── scheduler/            # Polling and cron
│   │   ├── poller.ts         # Notion polling with dedup
│   │   └── cron.ts           # node-cron wrapper
│   └── utils/                # Shared utilities
│       ├── logger.ts         # Winston structured logging
│       ├── format.ts         # Text/date formatting helpers
│       └── errors.ts         # Error handling with retry
├── Dockerfile                # Multi-stage Node.js build
├── fly.toml                  # Fly.io config (worker process)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## How It Works

1. **Notion Polling**: Every 60 seconds, the bot queries two Notion databases:
   - **Harper Messages DB**: For MDB (Dawn Dispatch), ADB (Afternoon Brief), PMDB (Post-Market Brief), and TOTT (Weekly Tribune) entries with `Status: Active`
   - **Trade Ideas DB**: For entries with `Status: Proposed`

2. **Channel Posting**: When new content is found, it's posted to the appropriate Discord channel as rich embeds with gold (#D4AF37) branding. Trade proposals get automatic thumbs up/down reactions.

3. **Volatility Alerts**: Every 5 minutes during US market hours (9:30 AM - 4:00 PM ET), the bot checks VIX and NQ futures. If VIX spikes >2% or NQ moves >100 points, it fires an `@everyone` alert in #the-tape. Max 1 alert per 30 minutes.

4. **Boardroom AI**: In #boardroom, the bot responds to all messages using Perplexity's sonar model with the Harper-Perp persona. Maintains a 20-message conversation context window.

5. **Slash Commands**: Seven commands for on-demand access to briefings, status, market data, and AI research.

## Setup

### Prerequisites
- Node.js 20+
- Discord bot token with Message Content intent enabled
- Notion integration with access to Harper Messages and Trade Ideas databases
- Perplexity API key

### Local Development

```bash
cd discord-bot
npm install
cp .env.example .env
# Fill in all values in .env
npm run dev
```

### Build

```bash
npm run build
npm start
```

## Deployment (Fly.io)

```bash
cd discord-bot

# Set secrets
fly secrets set DISCORD_TOKEN=your-token
fly secrets set DISCORD_GUILD_ID=your-guild-id
fly secrets set CHANNEL_DISPATCH_BOARD=channel-id
fly secrets set CHANNEL_WEEKLY_TRIBUNE=channel-id
fly secrets set CHANNEL_PREDICTION_MARKETS=channel-id
fly secrets set CHANNEL_THE_TAPE=channel-id
fly secrets set CHANNEL_BOARDROOM=channel-id
fly secrets set NOTION_API_KEY=your-notion-key
fly secrets set PERPLEXITY_API_KEY=your-perplexity-key

# Deploy
fly deploy
```

The bot runs as a worker process (no HTTP server). Fly.io monitors process health — if it crashes, it auto-restarts. The bot logs a heartbeat every 60 seconds.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/mdb` | Fetch the latest Dawn Dispatch |
| `/adb` | Fetch the latest Afternoon Brief |
| `/pmdb` | Fetch the latest Post-Market Brief |
| `/tott` | Fetch the latest Weekly Tribune |
| `/status` | Bot health: uptime, last posts, cron status |
| `/tape` | Current VIX, NQ level, implied move, risk assessment |
| `/ask [question]` | Freeform market question with live research |

## Channel Map

| Channel | Purpose | Trigger |
|---------|---------|---------|
| #dispatch-board | MDB, ADB, PMDB briefings | Notion poll (60s) |
| #weekly-tribune | TOTT weekly recap/preview | Notion poll (60s) |
| #prediction-markets | Trade proposals with voting | Notion poll (60s) |
| #the-tape | Volatility alerts (@everyone) | Market data check (5m) |
| #boardroom | Conversational AI | Message events |

## Security Notes

- All secrets are environment variables — nothing hardcoded
- The Discord bot token must be regenerated before first deployment
- Notion integration should have minimal read-only permissions
- The bot does NOT have permission to approve PRs or execute trades

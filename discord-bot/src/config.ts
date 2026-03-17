import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  // Discord
  discord: {
    token: required('DISCORD_TOKEN'),
    guildId: required('DISCORD_GUILD_ID'),
  },

  // Channel IDs
  channels: {
    dispatchBoard: required('CHANNEL_DISPATCH_BOARD'),
    weeklyTribune: required('CHANNEL_WEEKLY_TRIBUNE'),
    predictionMarkets: required('CHANNEL_PREDICTION_MARKETS'),
    theTape: required('CHANNEL_THE_TAPE'),
    boardroom: required('CHANNEL_BOARDROOM'),
  },

  // Notion
  notion: {
    apiKey: required('NOTION_API_KEY'),
    harperMessagesDb: optional('NOTION_HARPER_MESSAGES_DB', '30c141b0-da7d-8162-b035-000b181783c1'),
    tradeIdeasDb: optional('NOTION_TRADE_IDEAS_DB', '3f48678a-f7fe-46f2-84cb-82e065b433c4'),
  },

  // AI / Perplexity
  ai: {
    perplexityApiKey: required('PERPLEXITY_API_KEY'),
    model: optional('AI_MODEL', 'sonar'),
    perplexityBaseUrl: 'https://api.perplexity.ai',
  },

  // Market Data thresholds
  market: {
    volatilityAlertThreshold: parseFloat(optional('VOLATILITY_ALERT_THRESHOLD', '2.0')),
    nqPointThreshold: parseInt(optional('NQ_POINT_THRESHOLD', '100'), 10),
  },

  // Bot
  bot: {
    name: optional('BOT_NAME', 'Harper-Perp'),
    logLevel: optional('LOG_LEVEL', 'info'),
    nodeEnv: optional('NODE_ENV', 'production'),
  },

  // Polling intervals (ms)
  polling: {
    notionInterval: 60_000,       // 60 seconds
    tapeInterval: 5 * 60_000,     // 5 minutes
    heartbeatInterval: 60_000,    // 60 seconds
    alertCooldown: 30 * 60_000,   // 30 minutes
  },

  // Embed colors
  colors: {
    gold: 0xD4AF37,
    red: 0xE74C3C,
    green: 0x2ECC71,
    blue: 0x3498DB,
  },
} as const;

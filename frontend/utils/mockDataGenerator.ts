import { FeedItem, IVIndicator } from '../types/feed';
import type { RiskFlowItem } from '../types/api';

const headlines = [
  'ES Futures holding 5050 support level',
  'VIX crushing below 14, implied volatility collapsing',
  'Fed Minutes: No rate cuts expected until Q3',
  'Tech earnings beat expectations, NASDAQ rallying',
  'Oil prices surge on Middle East tensions',
  'Dollar strength continuing into Asia session',
  'Bonds selling off, yields climbing to 4.5%',
  'Gold breaking through $2100 resistance',
  'Crypto markets showing signs of reversal',
  'European markets open higher on ECB news',
  'Retail sales data disappoints, consumer spending weak',
  'Housing starts decline for third consecutive month',
  'Unemployment claims lower than expected',
  'Corporate buybacks accelerating into year-end',
  'Short interest building in small caps',
];

const sources = ['ZeroHedge', 'Bloomberg', 'Reuters', 'WSJ', 'CNBC', 'FT'];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function calculateIV(text: string): IVIndicator {
  const hash = hashString(text);
  const value = ((hash % 200) - 100) / 10;

  const type = value > 2 ? 'Bullish' : value < -2 ? 'Bearish' : 'Neutral';
  const classification = Math.abs(value) > 5 ? 'Countercyclical' : 'Cyclical';

  return { value, type, classification };
}

export function generateMockFeedItem(): FeedItem {
  const text = headlines[Math.floor(Math.random() * headlines.length)];
  const source = sources[Math.floor(Math.random() * sources.length)];

  return {
    id: `feed_${Date.now()}_${Math.random()}`,
    time: new Date(),
    text,
    source,
    type: Math.random() > 0.7 ? 'alert' : 'market',
    iv: calculateIV(text),
  };
}

export function generateInitialFeed(count: number = 10): FeedItem[] {
  return Array.from({ length: count }, (_, i) => {
    const item = generateMockFeedItem();
    item.time = new Date(Date.now() - i * 60000);
    return item;
  });
}

// Generate mock RiskFlowItem for NewsSection component
export function generateMockRiskFlowItem(): RiskFlowItem {
  const title = headlines[Math.floor(Math.random() * headlines.length)];
  const source = sources[Math.floor(Math.random() * sources.length)];
  const hash = hashString(title);
  const ivImpact = ((hash % 100) / 10); // 0-10 scale
  const ivScore = ivImpact;

  const impacts: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
  const impact = ivImpact > 7 ? 'high' : ivImpact > 4 ? 'medium' : 'low';

  const sentiments: ('positive' | 'negative' | 'neutral' | 'bullish' | 'bearish')[] =
    ['positive', 'negative', 'neutral', 'bullish', 'bearish'];
  const sentiment = sentiments[hash % sentiments.length];

  const macroLevels: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  const macroLevel = macroLevels[hash % macroLevels.length] as 1 | 2 | 3 | 4;

  const priceBrainSentiment = ivImpact > 5 ? 'Bullish' : ivImpact < -5 ? 'Bearish' : 'Neutral';
  const priceBrainClassification = Math.abs(ivImpact) > 5 ? 'Counter-cyclical' : 'Cyclical';

  return {
    id: `riskflow_${Date.now()}_${Math.random()}`,
    title,
    content: `${title}. Market analysis and implications for trading strategies.`,
    summary: `${title}. Key market development with significant trading implications.`,
    source,
    url: `https://example.com/article/${hash}`,
    publishedAt: new Date(),
    sentiment,
    ivImpact,
    ivScore,
    impact,
    symbols: ['ES', 'NQ', 'MNQ'],
    isBreaking: Math.random() > 0.8,
    category: source,
    macroLevel,
    priceBrainScore: {
      sentiment: priceBrainSentiment,
      classification: priceBrainClassification,
      impliedPoints: macroLevel >= 3 ? (ivImpact - 5) * 2 : null,
      instrument: macroLevel >= 3 ? 'ES' : null,
    },
  };
}

export function generateMockRiskFlowItems(count: number = 10): RiskFlowItem[] {
  // Safeguard: never generate more than 25 items at once
  const safeCount = Math.min(count, 25);
  return Array.from({ length: safeCount }, (_, i) => {
    const item = generateMockRiskFlowItem();
    item.publishedAt = new Date(Date.now() - i * 60000);
    item.id = `riskflow_${Date.now() - i * 60000}_${i}`;
    return item;
  });
}

import { FeedItem, IVIndicator } from '../types/feed';

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

const sources = ['FinancialJuice', 'OSINTSources', 'DeItaOne', 'Bloomberg', 'Reuters', 'WSJ', 'CNBC', 'FT'];

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

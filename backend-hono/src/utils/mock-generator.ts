const DEFAULT_LIMIT = 50;

export type MockNewsArticle = {
  id: string;
  title: string;
  summary: string;
  published_at: string;
  symbols: string[];
  is_breaking: boolean;
};

export type MockPage = {
  items: MockNewsArticle[];
  nextCursor: string | null;
  limit: number;
};

export type MockPaginationOptions = {
  cursor?: string | null;
  limit?: number;
};

const SYMBOLS = ["ES", "NQ", "CL", "GC", "YM", "RTY", "ZN", "ZB"];

const pickSymbols = (seed: number) => {
  const primary = SYMBOLS[seed % SYMBOLS.length];
  const secondary = SYMBOLS[(seed + 3) % SYMBOLS.length];
  return [primary, secondary];
};

const buildItem = (index: number, baseTime: number): MockNewsArticle => {
  const timestamp = new Date(baseTime - index * 60_000);
  const symbols = pickSymbols(index);
  return {
    id: `mock-${timestamp.getTime()}-${index}`,
    title: `Mock headline ${index + 1}`,
    summary: `Mock summary ${index + 1} for ${symbols.join("/")}`,
    published_at: timestamp.toISOString(),
    symbols,
    is_breaking: index % 7 === 0,
  };
};

const parseCursor = (cursor?: string | null) => {
  if (!cursor) {
    return Date.now();
  }
  const parsed = Date.parse(cursor);
  if (Number.isNaN(parsed)) {
    return Date.now();
  }
  return parsed;
};

export function generateMockNewsPage(
  options: MockPaginationOptions = {},
): MockPage {
  const limit = DEFAULT_LIMIT;
  const baseTime = parseCursor(options.cursor);
  const items = Array.from({ length: limit }, (_, index) =>
    buildItem(index, baseTime),
  );
  const lastItem = items[items.length - 1];
  return {
    items,
    nextCursor: lastItem ? lastItem.published_at : null,
    limit,
  };
}

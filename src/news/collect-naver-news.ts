import fs from 'node:fs';
import { resolveFromRoot, saveJson } from '../utils/file';

type Portfolio = {
  positions: Array<{
    name: string;
    symbol: string | null;
    sectorTag: string;
  }>;
};

type NewsItem = {
  source: string;
  stockName: string;
  stockCode: string;
  sectorTag: string;
  title: string;
  summary: string | null;
  media: string | null;
  publishedAt: string | null;
  url: string;
  rawText: string;
  capturedAt: string;
};

const MAX_NEWS_PER_STOCK = Number(process.env.NEWS_MAX_ITEMS_PER_STOCK ?? 10);
const REQUEST_DELAY_MS = Number(process.env.NEWS_REQUEST_DELAY_MS ?? 350);

const NEWS_EXCLUDE_KEYWORDS = [
  '부고',
  '인사',
  '동정',
  '날씨',
  '맛집',
  '연예',
  '스포츠',
  '축구',
  '야구',
];

const STOCK_ALIASES: Record<string, string[]> = {
  '000660': ['SK하이닉스', '하이닉스', 'HBM', '메모리', '반도체'],
  '005930': ['삼성전자', '삼성', '반도체', 'HBM', '갤럭시'],
  '005380': ['현대차', '현대자동차', '전기차', '자동차', '모빌리티'],
  '035420': ['NAVER', '네이버', 'AI', '플랫폼', '검색'],
  '0117V0': ['TIGER 코리아AI전력기기TOP3플러스', '전력기기', '전력', 'AI 전력', '변압기'],
  '0167A0': ['SOL AI반도체TOP2플러스', 'AI반도체', '반도체', '삼성전자', 'SK하이닉스'],
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function cleanText(value: string | null | undefined): string {
  return decodeHtml(value ?? '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function stripTags(value: string): string {
  return cleanText(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' '),
  );
}

function getStockAliases(stockName: string, stockCode: string, sectorTag: string): string[] {
  const aliases = new Set<string>([
    stockName,
    stockCode,
    sectorTag,
    ...(STOCK_ALIASES[stockCode] ?? []),
  ]);

  for (const token of stockName.split(/[\s·/()]+/)) {
    const cleaned = cleanText(token);
    if (cleaned.length >= 2) aliases.add(cleaned);
  }

  return Array.from(aliases).filter((alias) => alias.length >= 2);
}

function isRelevantNewsText(params: {
  title: string;
  summary: string | null;
  stockName: string;
  stockCode: string;
  sectorTag: string;
}): boolean {
  const text = cleanText(`${params.title} ${params.summary ?? ''}`).toLowerCase();
  if (!text) return false;
  if (NEWS_EXCLUDE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) return false;

  const aliases = getStockAliases(params.stockName, params.stockCode, params.sectorTag);
  return aliases.some((alias) => text.includes(alias.toLowerCase()));
}

function getSearchQueries(stockName: string, stockCode: string, sectorTag: string): string[] {
  const aliases = getStockAliases(stockName, stockCode, sectorTag).filter((alias) => alias !== stockCode);
  const queries = [
    `${stockName} 주식`,
    `${aliases[0] ?? stockName} 뉴스`,
    `${aliases[1] ?? aliases[0] ?? stockName} 주식`,
    `${sectorTag} 주식`,
  ];

  return Array.from(new Set(queries.map(cleanText).filter((query) => query.length >= 3)));
}

function normalizeNaverCode(symbol: string | null): string | null {
  if (!symbol) return null;

  const trimmed = symbol.trim();
  if (/^[0-9A-Z]{6}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^([0-9A-Z]{6})\.KS$/);
  return match?.[1] ?? null;
}

async function fetchHtml(url: string, encoding: 'utf-8' | 'euc-kr' = 'utf-8'): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return new TextDecoder(encoding).decode(buffer);
}

function parseFinanceNewsRows(params: {
  html: string;
  stockName: string;
  stockCode: string;
  sectorTag: string;
  capturedAt: string;
}): NewsItem[] {
  const rows = [...params.html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const items: NewsItem[] = [];

  for (const row of rows) {
    const href =
      row.match(/href="([^"]*news[_Rr]ead\.naver[^"]*)"/)?.[1] ??
      row.match(/href='([^']*news[_Rr]ead\.naver[^']*)'/)?.[1] ??
      null;

    if (!href) continue;

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
    const title = cleanText(cells[0]);

    if (!title) continue;

    items.push({
      source: 'naver-finance-news',
      stockName: params.stockName,
      stockCode: params.stockCode,
      sectorTag: params.sectorTag,
      title,
      summary: null,
      media: cells[1] || null,
      publishedAt: cells[2] || null,
      url: new URL(href, 'https://finance.naver.com').toString(),
      rawText: stripTags(row).slice(0, 3000),
      capturedAt: params.capturedAt,
    });

    if (items.length >= MAX_NEWS_PER_STOCK) break;
  }

  return items;
}

function parseSearchNewsRows(params: {
  html: string;
  stockName: string;
  stockCode: string;
  sectorTag: string;
  capturedAt: string;
}): NewsItem[] {
  const items: NewsItem[] = [];
  const seenUrls = new Set<string>();
  const headlinePattern =
    /<a[^>]+href="([^"]+)"[^>]*>\s*<span[^>]*sds-comps-text-type-headline1[^>]*>([\s\S]*?)<\/span>\s*<\/a>/gi;

  for (const match of params.html.matchAll(headlinePattern)) {
    const url = decodeHtml(match[1]);
    const title = stripTags(match[2]);
    const blockStart = Math.max(0, match.index ?? 0);
    const block = params.html.slice(blockStart, blockStart + 3500);
    const summary =
      block.match(/<span[^>]*sds-comps-text-type-body1[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null;
    const cleanSummary = summary ? stripTags(summary) : null;
    const media =
      block.match(/<span[^>]*sds-comps-profile-info-title-text[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
      block.match(/<span[^>]*sds-comps-text-type-body2[^>]*sds-comps-text-weight-sm[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
      null;
    const publishedAt = block.match(/<span[^>]*sds-comps-profile-info-subtext[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null;

    if (!title || seenUrls.has(url)) continue;
    if (
      !isRelevantNewsText({
        title,
        summary: cleanSummary,
        stockName: params.stockName,
        stockCode: params.stockCode,
        sectorTag: params.sectorTag,
      })
    ) {
      continue;
    }

    seenUrls.add(url);
    items.push({
      source: 'naver-search-news',
      stockName: params.stockName,
      stockCode: params.stockCode,
      sectorTag: params.sectorTag,
      title,
      summary: cleanSummary,
      media: media ? stripTags(media) : null,
      publishedAt: publishedAt ? stripTags(publishedAt) : null,
      url,
      rawText: stripTags(block).slice(0, 3000),
      capturedAt: params.capturedAt,
    });

    if (items.length >= MAX_NEWS_PER_STOCK) break;
  }

  return items;
}

async function collectStockNews(params: {
  stockName: string;
  stockCode: string;
  sectorTag: string;
  capturedAt: string;
}): Promise<NewsItem[]> {
  const financeHtml = await fetchHtml(
    `https://finance.naver.com/item/news_news.naver?code=${params.stockCode}&page=1`,
    'euc-kr',
  );
  const financeRows = parseFinanceNewsRows({ ...params, html: financeHtml });

  if (financeRows.length > 0) {
    return financeRows;
  }

  const items: NewsItem[] = [];
  const seenUrls = new Set<string>();

  for (const queryText of getSearchQueries(params.stockName, params.stockCode, params.sectorTag)) {
    const query = encodeURIComponent(queryText);
    const searchHtml = await fetchHtml(`https://search.naver.com/search.naver?where=news&query=${query}`);
    const rows = parseSearchNewsRows({ ...params, html: searchHtml });

    for (const row of rows) {
      if (seenUrls.has(row.url)) continue;
      seenUrls.add(row.url);
      items.push(row);
      if (items.length >= MAX_NEWS_PER_STOCK) return items;
    }

    await delay(REQUEST_DELAY_MS);
  }

  return items;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const portfolio = readJson<Portfolio>(resolveFromRoot('data', 'input', 'portfolio.json'));
  const capturedAt = new Date().toISOString();
  const results: NewsItem[] = [];

  for (const position of portfolio.positions) {
    const code = normalizeNaverCode(position.symbol);

    if (!code) {
      console.log(`[skip] no naver stock code: ${position.name}`);
      continue;
    }

    try {
      const rows = await collectStockNews({
        stockName: position.name,
        stockCode: code,
        sectorTag: position.sectorTag,
        capturedAt,
      });

      console.log(`[naver news] ${position.name} (${code}) => ${rows.length}`);
      results.push(...rows);
    } catch (error) {
      console.error(`[naver news] failed: ${position.name} (${code})`);
      console.error(error);
    }

    await delay(REQUEST_DELAY_MS);
  }

  const outputPath = resolveFromRoot('data', 'output', `news-snapshot-${Date.now()}.json`);
  saveJson(outputPath, results);

  console.log('');
  console.log(`news saved: ${outputPath}`);
  console.log('');
}

main().catch((error) => {
  console.error('news collection failed.');
  console.error(error);
  process.exit(1);
});

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
    const media =
      block.match(/<span[^>]*sds-comps-profile-info-title-text[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
      block.match(/<span[^>]*sds-comps-text-type-body2[^>]*sds-comps-text-weight-sm[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
      null;
    const publishedAt = block.match(/<span[^>]*sds-comps-profile-info-subtext[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? null;

    if (!title || seenUrls.has(url)) continue;

    seenUrls.add(url);
    items.push({
      source: 'naver-search-news',
      stockName: params.stockName,
      stockCode: params.stockCode,
      sectorTag: params.sectorTag,
      title,
      summary: summary ? stripTags(summary) : null,
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

  const query = encodeURIComponent(`${params.stockName} 주식`);
  const searchHtml = await fetchHtml(`https://search.naver.com/search.naver?where=news&query=${query}`);
  return parseSearchNewsRows({ ...params, html: searchHtml });
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

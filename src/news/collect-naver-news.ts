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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function stripTags(value: string): string {
  return cleanText(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

function normalizeNaverCode(symbol: string | null): string | null {
  if (!symbol) return null;

  const trimmed = symbol.trim();
  if (/^[0-9A-Z]{6}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^([0-9A-Z]{6})\.KS$/);
  return match?.[1] ?? null;
}

async function fetchNewsHtml(code: string): Promise<string> {
  const response = await fetch(`https://finance.naver.com/item/news_news.naver?code=${code}&page=1`, {
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

  return response.text();
}

function parseNewsRows(params: {
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
      row.match(/href="([^"]*news_read\.naver[^"]*)"/)?.[1] ??
      row.match(/href='([^']*news_read\.naver[^']*)'/)?.[1] ??
      null;

    if (!href) continue;

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
    const title = cleanText(cells[0]);

    if (!title) continue;

    const url = new URL(href, 'https://finance.naver.com').toString();

    items.push({
      source: 'naver-finance-news',
      stockName: params.stockName,
      stockCode: params.stockCode,
      sectorTag: params.sectorTag,
      title,
      summary: cells[1] || null,
      media: cells[2] || null,
      publishedAt: cells[3] || null,
      url,
      rawText: stripTags(row).slice(0, 3000),
      capturedAt: params.capturedAt,
    });

    if (items.length >= MAX_NEWS_PER_STOCK) break;
  }

  return items;
}

async function main(): Promise<void> {
  const portfolio = readJson<Portfolio>(resolveFromRoot('data', 'input', 'portfolio.json'));
  const capturedAt = new Date().toISOString();
  const results: NewsItem[] = [];

  for (const position of portfolio.positions) {
    const code = normalizeNaverCode(position.symbol);

    if (!code) {
      console.log(`[skip] 뉴스 종목코드 없음: ${position.name}`);
      continue;
    }

    try {
      const html = await fetchNewsHtml(code);
      const rows = parseNewsRows({
        html,
        stockName: position.name,
        stockCode: code,
        sectorTag: position.sectorTag,
        capturedAt,
      });

      console.log(`[네이버 뉴스] ${position.name} (${code}) => ${rows.length}건`);
      results.push(...rows);
    } catch (error) {
      console.error(`[네이버 뉴스] 수집 실패: ${position.name} (${code})`);
      console.error(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const outputPath = resolveFromRoot('data', 'output', `news-snapshot-${Date.now()}.json`);
  saveJson(outputPath, results);

  console.log('');
  console.log(`뉴스 저장 완료: ${outputPath}`);
  console.log('');
}

main().catch((error) => {
  console.error('뉴스 수집 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});

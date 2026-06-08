import fs from 'node:fs';
import { resolveFromRoot, saveJson } from '../utils/file';

type Portfolio = {
  positions: Array<{
    name: string;
    symbol: string | null;
    sectorTag: string;
  }>;
};

type NaverDiscussionPost = {
  community: string;
  board: string;
  rank: number;
  title: string;
  cleanTitle: string;
  category: string | null;
  url: string;
  commentCount: number | null;
  author: string | null;
  createdAt: string | null;
  views: number | null;
  likes: number | null;
  dislikes: number | null;
  bodyText: string;
  rawListText: string;
  capturedAt: string;
  stockName: string;
  stockCode: string;
  sectorTag: string;
};

type ParsedRow = {
  title: string;
  url: string;
  author: string | null;
  createdAt: string | null;
  views: number | null;
  likes: number | null;
  dislikes: number | null;
  rawText: string;
};

const MAX_POSTS_PER_STOCK = Number(
  process.env.NAVER_DISCUSSION_MAX_POSTS ?? process.env.COMMUNITY_MAX_POSTS ?? 10,
);

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

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/,/g, '');
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseListRow(rowHtml: string, code: string): ParsedRow | null {
  const href =
    rowHtml.match(/href="([^"]*board_read\.naver[^"]*)"/)?.[1] ??
    rowHtml.match(/href='([^']*board_read\.naver[^']*)'/)?.[1] ??
    null;

  if (!href) return null;

  const url = new URL(href, 'https://finance.naver.com').toString();
  if (!url.includes(`code=${code}`)) return null;

  const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => {
    return stripTags(match[1]);
  });

  if (cells.length < 6) return null;

  const title = cleanText(cells[1].replace(/\[\s*\d+\s*\]/g, ''));
  if (!title) return null;

  return {
    title,
    url,
    author: cells[2] || null,
    createdAt: cells[0] || null,
    views: parseNumber(cells[3]),
    likes: parseNumber(cells[4]),
    dislikes: parseNumber(cells[5]),
    rawText: stripTags(rowHtml),
  };
}

function parseRows(html: string, code: string): ParsedRow[] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => parseListRow(match[1], code))
    .filter((row): row is ParsedRow => Boolean(row))
    .slice(0, MAX_POSTS_PER_STOCK);
}

async function fetchBoardHtml(code: string): Promise<string> {
  const url = `https://finance.naver.com/item/board.naver?code=${code}`;

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

  return response.text();
}

async function main(): Promise<void> {
  const portfolioFile = resolveFromRoot('data', 'input', 'portfolio.json');
  const portfolio = readJson<Portfolio>(portfolioFile);
  const capturedAt = new Date().toISOString();
  const results: NaverDiscussionPost[] = [];

  for (const position of portfolio.positions) {
    const code = normalizeNaverCode(position.symbol);

    if (!code) {
      console.log(`[skip] 네이버 종목코드 없음: ${position.name}`);
      continue;
    }

    try {
      const html = await fetchBoardHtml(code);
      const rows = parseRows(html, code);

      console.log(`[네이버 종토방] ${position.name} (${code}) => ${rows.length}건`);

      for (const [index, row] of rows.entries()) {
        results.push({
          community: '네이버 종목토론방',
          board: position.name,
          rank: index + 1,
          title: row.title,
          cleanTitle: row.title,
          category: null,
          url: row.url,
          commentCount: null,
          author: row.author,
          createdAt: row.createdAt,
          views: row.views,
          likes: row.likes,
          dislikes: row.dislikes,
          bodyText: '',
          rawListText: row.rawText.slice(0, 3000),
          capturedAt,
          stockName: position.name,
          stockCode: code,
          sectorTag: position.sectorTag,
        });
      }
    } catch (error) {
      console.error(`[네이버 종토방] 수집 실패: ${position.name} (${code})`);
      console.error(error);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const outputPath = resolveFromRoot(
    'data',
    'output',
    `naver-discussion-${Date.now()}.json`,
  );

  saveJson(outputPath, results);

  console.log('');
  console.log(`네이버 종토방 저장 완료: ${outputPath}`);
  console.log('');
}

main().catch((error) => {
  console.error('네이버 종토방 수집 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});

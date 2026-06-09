import { chromium, Page } from '@playwright/test';
import { formatKstDateTime, formatKstTimestampId, resolveFromRoot, saveJson } from '../utils/file';

type FmkoreaListItem = {
  rank: number;
  title: string;
  cleanTitle: string;
  url: string;
  commentCount: number | null;
  parentText: string;
  parentClassName: string;
};

type CommunityPost = {
  community: string;
  board: string;
  rank: number;
  title: string;
  cleanTitle: string;
  url: string;
  commentCount: number | null;
  author: string | null;
  createdAt: string | null;
  views: number | null;
  likes: number | null;
  bodyText: string;
  rawListText: string;
  capturedAt: string;
  category: string | null;
  popularityScore: number;
  isTextPoor: boolean;
};

const START_URL =
  'https://www.fmkorea.com/index.php?mid=stock&sort_index=pop&order_type=desc&listStyle=webzine';

const isDev = process.env.NODE_ENV !== 'production';
const MAX_POSTS = Number(process.env.FMKOREA_MAX_POSTS ?? process.env.COMMUNITY_MAX_POSTS ?? 10);

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function removeCommentSuffix(title: string): string {
  return title.replace(/\s*\[\d+\]\s*$/, '').trim();
}

function extractCommentCount(title: string): number | null {
  const match = title.match(/\[(\d+)\]\s*$/);
  return match ? Number(match[1]) : null;
}

function isNoticeLikePost(title: string, parentText: string, parentClassName: string): boolean {
  const normalizedTitle = cleanText(title);
  const normalizedParentText = cleanText(parentText);
  const normalizedClassName = parentClassName.toLowerCase();

  if (normalizedClassName.includes('notice')) return true;
  if (normalizedParentText.includes('공지')) return true;

  const noticeKeywords = [
    '사용자간 불편을 피하고',
    '따뜻한 댓글',
    '이용자를 일부러 긁는 활동',
    '이용제한',
    '깁콘 뿌림',
    '잉여력',
    '나눔 이벤트',
    '이벤트 탭',
    '작성부탁',
    '작성 부탁',
    '운영',
    '규정',
  ];

  return noticeKeywords.some((keyword) => {
    return normalizedTitle.includes(keyword) || normalizedParentText.includes(keyword);
  });
}

function parseNumberFromText(text: string, labelPatterns: RegExp[]): number | null {
  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const value = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(value)) return value;
  }

  return null;
}

function extractCategoryFromListText(rawListText: string): string | null {
  const categories = ['국내주식', '해외주식', '정보공유', '질문', '이벤트'];

  for (const category of categories) {
    if (rawListText.includes(category)) return category;
  }

  return null;
}

function calculatePopularityScore(params: {
  likes: number | null;
  commentCount: number | null;
  views: number | null;
}): number {
  const likes = params.likes ?? 0;
  const comments = params.commentCount ?? 0;
  const views = params.views ?? 0;

  return likes * 3 + comments * 1.5 + views / 100;
}

async function getFirstText(page: Page, selectors: string[]): Promise<string | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    try {
      if ((await locator.count()) === 0) continue;

      const text = cleanText(await locator.innerText({ timeout: 1000 }));
      if (text) return text;
    } catch {
      // ignore selector failure
    }
  }

  return null;
}

async function getBodyText(page: Page): Promise<string> {
  const bodySelectors = [
    '.xe_content',
    '.rd_body',
    '.document_content',
    '.read_body',
    'article',
  ];

  for (const selector of bodySelectors) {
    const locator = page.locator(selector).first();

    try {
      if ((await locator.count()) === 0) continue;

      const text = cleanText(await locator.innerText({ timeout: 1500 }));
      if (text.length >= 20) return text;
    } catch {
      // ignore selector failure
    }
  }

  return cleanText(await page.locator('body').innerText()).slice(0, 15000);
}

async function main(): Promise<void> {
  const capturedAtDate = new Date();
  const capturedAt = formatKstDateTime(capturedAtDate);
  const browser = await chromium.launch({
    headless: !isDev,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1000,
    },
  });

  const page = await context.newPage();

  await page.goto(START_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await page.waitForTimeout(2000);

  const candidateLinks = await page.locator('a[href*="document_srl"]').evaluateAll((anchors) => {
    const map = new Map<
      string,
      {
        title: string;
        url: string;
        parentText: string;
        parentClassName: string;
      }
    >();

    for (const anchor of anchors as HTMLAnchorElement[]) {
      const title = (anchor.innerText ?? '').trim();
      const href = anchor.href;

      if (!title || !href) continue;
      if (title.length < 3) continue;
      if (!href.includes('document_srl=')) continue;

      const parent = anchor.closest('tr, li, article, div');

      map.set(href, {
        title,
        url: href,
        parentText: parent?.textContent?.trim() ?? '',
        parentClassName: parent?.className?.toString() ?? '',
      });
    }

    return Array.from(map.values()).slice(0, 60);
  });

  const links: FmkoreaListItem[] = candidateLinks
    .filter((item) => {
      return !isNoticeLikePost(item.title, item.parentText, item.parentClassName);
    })
    .slice(0, MAX_POSTS)
    .map((item, index) => {
      const cleanTitle = removeCommentSuffix(item.title);

      return {
        rank: index + 1,
        title: cleanText(item.title),
        cleanTitle,
        url: item.url,
        commentCount: extractCommentCount(item.title),
        parentText: cleanText(item.parentText),
        parentClassName: item.parentClassName,
      };
    });

  console.log(`수집 대상 글 수: ${links.length}`);

  const results: CommunityPost[] = [];

  for (const item of links) {
    const postPage = await context.newPage();

    try {
      console.log(`[${item.rank}] ${item.cleanTitle}`);

      await postPage.goto(item.url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await postPage.waitForTimeout(1500);

      const pageText = cleanText(await postPage.locator('body').innerText());

      const author = await getFirstText(postPage, [
        '.nick_name',
        '.member_plate',
        '.author',
        '.writer',
      ]);

      const createdAt = await getFirstText(postPage, [
        '.date',
        '.regdate',
        '.time',
        'time',
      ]);

      const bodyText = await getBodyText(postPage);

      const views =
        parseNumberFromText(pageText, [
          /조회\s*수?\s*([0-9,]+)/,
          /조회\s*([0-9,]+)/,
          /view\s*([0-9,]+)/i,
        ]) ?? parseNumberFromText(item.parentText, [
          /조회\s*수?\s*([0-9,]+)/,
          /조회\s*([0-9,]+)/,
        ]);

      const likes =
        parseNumberFromText(pageText, [
          /추천\s*수?\s*([0-9,]+)/,
          /추천\s*([0-9,]+)/,
          /vote\s*([0-9,]+)/i,
        ]) ?? parseNumberFromText(item.parentText, [
          /추천\s*수?\s*([0-9,]+)/,
          /추천\s*([0-9,]+)/,
        ]);


      const category = extractCategoryFromListText(item.parentText);

      const popularityScore = calculatePopularityScore({
        likes,
        commentCount: item.commentCount,
        views,
      });

      const isTextPoor = bodyText.length < 30 || bodyText.includes('복사');

      results.push({
        community: 'FM코리아',
        board: 'stock',
        rank: item.rank,
        title: item.title,
        cleanTitle: item.cleanTitle,
        url: item.url,
        commentCount: item.commentCount,
        author,
        createdAt,
        views,
        likes,
        bodyText: bodyText.slice(0, 15000),
        rawListText: item.parentText.slice(0, 3000),
        capturedAt,
        category,
        popularityScore,
        isTextPoor,
      });
    } catch (error) {
      console.error(`수집 실패: ${item.url}`);
      console.error(error);
    } finally {
      await postPage.close();
    }
  }

  const outputPath = resolveFromRoot(
    'data',
    'output',
    `fmkorea-stock-${formatKstTimestampId(capturedAtDate)}.json`,
  );

  saveJson(outputPath, results);

  console.log('');
  console.log(`저장 완료: ${outputPath}`);
  console.log('');

  await browser.close();
}

main().catch((error) => {
  console.error('FM코리아 수집 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});

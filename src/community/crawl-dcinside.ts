import { chromium, Page } from '@playwright/test';
import { resolveFromRoot, saveJson } from '../utils/file';

type DcinsideListItem = {
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
  parentText: string;
};

type CommunityPost = {
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
  bodyText: string;
  rawListText: string;
  capturedAt: string;
};

const isDev = process.env.NODE_ENV !== 'production';
const MAX_POSTS_PER_TARGET = Number(
  process.env.DCINSIDE_MAX_POSTS ?? process.env.COMMUNITY_MAX_POSTS ?? 10,
);

const DEFAULT_TARGETS = [
  {
    board: '한국주식갤-개념글',
    url: 'https://gall.dcinside.com/mgallery/board/lists/?id=krstock&exception_mode=recommend',
  },
  {
    board: '미국주식갤-개념글',
    url: 'https://gall.dcinside.com/mgallery/board/lists/?id=stockus&exception_mode=recommend',
  },
];

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

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isArticleUrl(url: string): boolean {
  return (
    url.includes('dcinside.com') &&
    url.includes('/board/view/') &&
    url.includes('id=') &&
    url.includes('no=')
  );
}

const EXCLUDE_CATEGORIES = [
  '🤤계집',
  '계집',
];

const EXCLUDE_NOISE_KEYWORDS = [
  '19금',
  'ㅎㅂ',
  '후방',
  '야짤',
  '라방',
  '플러팅',
];

const ADDITIONAL_EXCLUDE_CATEGORIES = [
  '연계집',
  '계집',
];

const ADDITIONAL_EXCLUDE_NOISE_KEYWORDS = [
  '19금',
  '야짤',
  '야동',
  '오나홀',
  '섹스',
  '일베',
  '정떡',
  '여친',
  '여자',
  '꽈추',
  '좆',
  '짤',
];

const STOCK_RELEVANCE_KEYWORDS = [
  '주식',
  '국장',
  '미장',
  '코스피',
  '코스닥',
  '나스닥',
  '선물',
  '환율',
  '금리',
  '유가',
  '반도체',
  '삼성',
  '하이닉스',
  '현대차',
  'NAVER',
  '네이버',
  '엔비디아',
  '마이크론',
  'AMD',
  '테슬라',
  '공시',
  '실적',
  '매수',
  '매도',
  '상승',
  '하락',
  '급등',
  '급락',
  '차트',
  '증시',
  '시장',
  '종목',
  '외인',
  '외국인',
  '외궈',
  '증권',
  '계좌',
  '세력',
  '호재',
  '악재',
  '상방',
  '하방',
  '숏',
  '롱',
  '현금',
  '관망',
  '야선',
  '개장',
  '장전',
  '장후',
  '전종목',
  'S&P',
  'SPY',
  'QQQ',
  '피터린치',
  '이스라엘',
  '이란',
  '레바논',
  '공격',
  '중단',
];

const OBVIOUS_IRRELEVANT_KEYWORDS = [
  '연애',
  '결혼',
  '남친',
  '아이돌',
  '축구',
  '야구',
  '농구',
  '게임',
  '맛집',
];

function isExcludedCategory(category: string | null): boolean {
  if (!category) return false;

  const normalized = cleanText(category);

  return [...EXCLUDE_CATEGORIES, ...ADDITIONAL_EXCLUDE_CATEGORIES].some((excludeCategory) => {
    return normalized.includes(excludeCategory);
  });
}

function isNoiseText(text: string): boolean {
  const normalized = cleanText(text);

  return [...EXCLUDE_NOISE_KEYWORDS, ...ADDITIONAL_EXCLUDE_NOISE_KEYWORDS].some((keyword) => {
    return normalized.includes(keyword);
  });
}

function isStockRelevantText(params: {
  category: string | null;
  title: string;
  parentText: string;
}): boolean {
  const category = cleanText(params.category);
  const combinedText = cleanText(`${params.title} ${params.parentText}`);

  if (OBVIOUS_IRRELEVANT_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
    return false;
  }

  if (STOCK_RELEVANCE_KEYWORDS.some((keyword) => category.includes(keyword))) return true;
  if (STOCK_RELEVANCE_KEYWORDS.some((keyword) => combinedText.includes(keyword))) return true;

  return false;
}

function isNoticeLikeText(text: string): boolean {
  const normalized = cleanText(text);

  const noticeKeywords = [
    '공지',
    '설문',
    '이벤트',
    '운영',
    '알림',
    'AD',
    '광고',
  ];

  return noticeKeywords.some((keyword) => normalized.includes(keyword));
}

async function getFirstText(page: Page, selectors: string[]): Promise<string | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    try {
      if ((await locator.count()) === 0) continue;

      const text = cleanText(await locator.innerText({ timeout: 1000 }));
      if (text) return text;
    } catch {
      // ignore
    }
  }

  return null;
}

async function getBodyText(page: Page): Promise<string> {
  const selectors = [
    '.write_div',
    '.writing_view_box .write_div',
    '.view_content_wrap',
    '.gallview_contents',
    'article',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    try {
      if ((await locator.count()) === 0) continue;

      const text = cleanText(await locator.innerText({ timeout: 1500 }));
      if (text.length >= 10) return text;
    } catch {
      // ignore
    }
  }

  return cleanText(await page.locator('body').innerText()).slice(0, 15000);
}

async function extractListItems(page: Page): Promise<DcinsideListItem[]> {
  const rowItems = await page.locator('tr.ub-content, tr').evaluateAll((rows) => {
    const items: Array<{
      title: string;
      category: string | null;
      url: string;
      author: string | null;
      createdAt: string | null;
      views: string | null;
      likes: string | null;
      parentText: string;
      className: string;
    }> = [];

    for (const row of rows as HTMLTableRowElement[]) {
      const className = row.className?.toString() ?? '';
      const parentText = row.textContent?.trim() ?? '';

      const anchor =
        row.querySelector<HTMLAnchorElement>('td.gall_tit a[href*="/board/view/"]') ??
        row.querySelector<HTMLAnchorElement>('a[href*="/board/view/"]');

      if (!anchor) continue;

      const title = anchor.innerText?.trim() ?? '';
      const url = anchor.href;

      const author =
        row.querySelector<HTMLElement>('td.gall_writer .nickname')?.innerText?.trim() ??
        row.querySelector<HTMLElement>('td.gall_writer')?.innerText?.trim() ??
        null;

      const createdAt =
        row.querySelector<HTMLElement>('td.gall_date')?.getAttribute('title') ??
        row.querySelector<HTMLElement>('td.gall_date')?.innerText?.trim() ??
        null;

      const views =
        row.querySelector<HTMLElement>('td.gall_count')?.innerText?.trim() ??
        null;

      const likes =
        row.querySelector<HTMLElement>('td.gall_recommend')?.innerText?.trim() ??
        null;

      const category =
        row.querySelector<HTMLElement>('td.gall_subject')?.innerText?.trim() ??
        row.querySelector<HTMLElement>('.gall_subject')?.innerText?.trim() ??
        null;

      items.push({
        title,
        category,
        url,
        author,
        createdAt,
        views,
        likes,
        parentText,
        className,
      });
    }

    return items;
  });

  const unique = new Map<string, DcinsideListItem>();

  for (const item of rowItems) {
    const title = cleanText(item.title);
    const url = item.url;

    if (!title || title.length < 2) continue;
    if (!isArticleUrl(url)) continue;

    const parentText = cleanText(item.parentText);
    const className = item.className.toLowerCase();

    if (className.includes('notice')) continue;
    if (isNoticeLikeText(title) || isNoticeLikeText(parentText)) continue;

    const category = cleanText(item.category) || null;

    if (isExcludedCategory(category)) continue;
    if (isNoiseText(title) || isNoiseText(parentText)) continue;
    if (!isStockRelevantText({ category, title, parentText })) continue;

    if (!unique.has(url)) {
      unique.set(url, {
        rank: unique.size + 1,
        title,
        cleanTitle: removeCommentSuffix(title),
        category,
        url,
        commentCount: extractCommentCount(title),
        author: cleanText(item.author) || null,
        createdAt: cleanText(item.createdAt) || null,
        views: parseNumber(item.views),
        likes: parseNumber(item.likes),
        parentText,
      });
    }

    if (unique.size >= MAX_POSTS_PER_TARGET) break;
  }

  return Array.from(unique.values()).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

function getTargetsFromArgs() {
  const urlArg = process.argv[2];
  const boardArg = process.argv[3];

  if (urlArg) {
    return [
      {
        board: boardArg ?? 'dcinside-custom',
        url: urlArg,
      },
    ];
  }

  return DEFAULT_TARGETS;
}

async function main(): Promise<void> {
  const targets = getTargetsFromArgs();

  const browser = await chromium.launch({
    headless: !isDev,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1000,
    },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  });

  const results: CommunityPost[] = [];

  for (const target of targets) {
    const page = await context.newPage();

    try {
      console.log('');
      console.log(`[디시] 목록 접속: ${target.board}`);
      console.log(target.url);

      await page.goto(target.url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      await page.waitForTimeout(2500);

      const links = await extractListItems(page);

      console.log(`수집 대상 글 수: ${links.length}`);

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

          const bodyText = await getBodyText(postPage);

          const author =
            item.author ??
            (await getFirstText(postPage, [
              '.gall_writer .nickname',
              '.gall_writer',
              '.nickname',
            ]));

          const createdAt =
            item.createdAt ??
            (await getFirstText(postPage, [
              '.gall_date',
              '.date_time',
              '.view_info',
            ]));

          const views =
            item.views ??
            parseNumber(pageText.match(/조회\s*([0-9,]+)/)?.[1]);

          const likes =
            item.likes ??
            parseNumber(pageText.match(/추천\s*([0-9,]+)/)?.[1]);

          results.push({
            community: '디시인사이드',
            board: target.board,
            rank: item.rank,
            title: item.title,
            cleanTitle: item.cleanTitle,
            category: item.category,
            url: item.url,
            commentCount: item.commentCount,
            author,
            createdAt,
            views,
            likes,
            bodyText: bodyText.slice(0, 15000),
            rawListText: item.parentText.slice(0, 3000),
            capturedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`본문 수집 실패: ${item.url}`);
          console.error(error);
        } finally {
          await postPage.close();
        }

        await page.waitForTimeout(800);
      }
    } catch (error) {
      console.error(`목록 수집 실패: ${target.url}`);
      console.error(error);
    } finally {
      await page.close();
    }
  }

  const outputPath = resolveFromRoot(
    'data',
    'output',
    `dcinside-stock-${Date.now()}.json`,
  );

  saveJson(outputPath, results);

  console.log('');
  console.log(`디시 수집 저장 완료: ${outputPath}`);
  console.log('');

  await browser.close();
}

main().catch((error) => {
  console.error('디시인사이드 수집 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});

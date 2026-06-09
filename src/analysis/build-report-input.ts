import fs from 'node:fs';
import path from 'node:path';
import { formatKstDateTime, formatKstTimestampId, resolveFromRoot, saveJson } from '../utils/file';
import { resolveReportConfig } from '../utils/report-mode';

type ReportInput = {
  mode: string;
  requestedMode: string;
  marketPhase: string;
  autoDetectedMode: boolean;
  generatedAt: string;
  communityWindow: {
    from: string;
    to: string;
    lookbackHours: number;
  };
  communityFilter: {
    originalCount: number;
    filteredCount: number;
    excludedCount: number;
    unknownTimestampCount: number;
    mode: 'createdAt-or-keep-unknown';
  };
  files: {
    communityFiles: string[];
    newsFile: string | null;
    marketFile: string;
    portfolioFile: string;
    tradeEventsFile: string | null;
  };
  portfolio: unknown;
  tradeEvents: unknown;
  community: unknown;
  news: unknown;
  market: unknown;
};

type CommunityPost = {
  createdAt?: string | null;
  capturedAt?: string | null;
  [key: string]: unknown;
};

function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function findLatestFile(dirPath: string, prefix: string): string {
  const files = fs
    .readdirSync(dirPath)
    .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.json'))
    .map((fileName) => {
      const fullPath = path.join(dirPath, fileName);
      const stat = fs.statSync(fullPath);

      return {
        fileName,
        fullPath,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (files.length === 0) {
    throw new Error(`파일을 찾을 수 없습니다. dir=${dirPath}, prefix=${prefix}`);
  }

  return files[0].fullPath;
}

function parseCommunityTime(value: string | null | undefined, referenceDate: Date): Date | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const iso = Date.parse(raw);
  if (Number.isFinite(iso)) return new Date(iso);

  const yyyyMmDd = raw.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (yyyyMmDd) {
    const [, year, month, day, hour, minute, second] = yyyyMmDd;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? 0),
    );
  }

  const mmDd = raw.match(/^(\d{1,2})[.-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (mmDd) {
    const [, month, day, hour, minute, second] = mmDd;
    return new Date(
      referenceDate.getFullYear(),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? 0),
    );
  }

  const relative = raw.match(/(\d+)\s*(분|시간|일)\s*전/);
  if (relative) {
    const [, amountText, unit] = relative;
    const amount = Number(amountText);
    const ms =
      unit === '분'
        ? amount * 60 * 1000
        : unit === '시간'
          ? amount * 60 * 60 * 1000
          : amount * 24 * 60 * 60 * 1000;
    return new Date(referenceDate.getTime() - ms);
  }

  return null;
}

function filterCommunityByWindow(params: {
  posts: CommunityPost[];
  from: Date;
  to: Date;
}): {
  posts: CommunityPost[];
  originalCount: number;
  filteredCount: number;
  excludedCount: number;
  unknownTimestampCount: number;
} {
  let unknownTimestampCount = 0;

  const posts = params.posts.filter((post) => {
    const parsed = parseCommunityTime(post.createdAt, params.to);

    if (!parsed) {
      unknownTimestampCount += 1;
      return true;
    }

    return parsed >= params.from && parsed <= params.to;
  });

  return {
    posts,
    originalCount: params.posts.length,
    filteredCount: posts.length,
    excludedCount: params.posts.length - posts.length,
    unknownTimestampCount,
  };
}

async function main(): Promise<void> {
  const outputDir = resolveFromRoot('data', 'output');
  const inputDir = resolveFromRoot('data', 'input');
  const generatedAt = new Date();
  const reportConfig = resolveReportConfig(generatedAt);
  const mode = reportConfig.mode;
  const lookbackHours = reportConfig.lookbackHours;
  const communityWindow = {
    from: formatKstDateTime(new Date(generatedAt.getTime() - lookbackHours * 60 * 60 * 1000)),
    to: formatKstDateTime(generatedAt),
    lookbackHours,
  };
  
  function findLatestFileOrNull(dirPath: string, prefix: string): string | null {
    const files = fs
      .readdirSync(dirPath)
      .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.json'))
      .map((fileName) => {
        const fullPath = path.join(dirPath, fileName);
        const stat = fs.statSync(fullPath);

        return {
          fileName,
          fullPath,
          mtimeMs: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    return files[0]?.fullPath ?? null;
  }

  function readCommunityFiles(files: string[]): CommunityPost[] {
    return files.flatMap((filePath) => {
      const data = readJson<unknown>(filePath);

      if (Array.isArray(data)) return data as CommunityPost[];

      return [data as CommunityPost];
    });
  }

  const communityFiles = [
    findLatestFileOrNull(outputDir, 'fmkorea-stock-'),
    findLatestFileOrNull(outputDir, 'dcinside-stock-'),
    findLatestFileOrNull(outputDir, 'naver-discussion-'),
  ].filter((file): file is string => Boolean(file));

  if (communityFiles.length === 0) {
    throw new Error('커뮤니티 수집 파일을 찾을 수 없습니다.');
  }

  const marketFile = findLatestFile(outputDir, 'market-snapshot-');
  const newsFile = findLatestFileOrNull(outputDir, 'news-snapshot-');
  const portfolioFile = path.join(inputDir, 'portfolio.json');
  const tradeEventsFile = path.join(inputDir, 'trade-events.json');

  if (!fs.existsSync(portfolioFile)) {
    throw new Error(`portfolio.json 파일이 없습니다: ${portfolioFile}`);
  }

  const rawCommunity = readCommunityFiles(communityFiles);
  const communityFilterResult = filterCommunityByWindow({
    posts: rawCommunity,
    from: new Date(communityWindow.from),
    to: generatedAt,
  });
  const community = communityFilterResult.posts;
  const news = newsFile ? readJson(newsFile) : [];
  const market = readJson(marketFile);
  const portfolio = readJson(portfolioFile);
  const tradeEvents = fs.existsSync(tradeEventsFile) ? readJson(tradeEventsFile) : [];

  const reportInput: ReportInput = {
    mode,
    requestedMode: reportConfig.requestedMode,
    marketPhase: reportConfig.marketPhase,
    autoDetectedMode: reportConfig.isAutoMode,
    generatedAt: formatKstDateTime(generatedAt),
    communityWindow,
    communityFilter: {
      originalCount: communityFilterResult.originalCount,
      filteredCount: communityFilterResult.filteredCount,
      excludedCount: communityFilterResult.excludedCount,
      unknownTimestampCount: communityFilterResult.unknownTimestampCount,
      mode: 'createdAt-or-keep-unknown',
    },
    files: {
      communityFiles,
      newsFile,
      marketFile,
      portfolioFile,
      tradeEventsFile: fs.existsSync(tradeEventsFile) ? tradeEventsFile : null,
    },
    portfolio,
    tradeEvents,
    community,
    news,
    market,
  };

  const outputPath = resolveFromRoot(
    'data',
    'output',
    `report-input-${formatKstTimestampId(generatedAt)}.json`,
  );

  saveJson(outputPath, reportInput);

  console.log('');
  console.log(`리포트 입력 파일 생성 완료: ${outputPath}`);
  console.log('');
}

main().catch((error) => {
  console.error('리포트 입력 파일 생성 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});

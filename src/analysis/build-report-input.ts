import fs from 'node:fs';
import path from 'node:path';
import { resolveFromRoot, saveJson } from '../utils/file';

type ReportInput = {
  mode: string;
  generatedAt: string;
  communityWindow: {
    from: string;
    to: string;
    lookbackHours: number;
  };
  files: {
    communityFiles: string[];
    newsFile: string | null;
    marketFile: string;
    portfolioFile: string;
  };
  portfolio: unknown;
  community: unknown;
  news: unknown;
  market: unknown;
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

async function main(): Promise<void> {
  const outputDir = resolveFromRoot('data', 'output');
  const inputDir = resolveFromRoot('data', 'input');
  const mode = process.env.REPORT_MODE ?? 'daily';
  const lookbackHours = Number(process.env.COMMUNITY_LOOKBACK_HOURS ?? 12);
  const generatedAt = new Date();
  const communityWindow = {
    from: new Date(generatedAt.getTime() - lookbackHours * 60 * 60 * 1000).toISOString(),
    to: generatedAt.toISOString(),
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

  function readCommunityFiles(files: string[]): unknown[] {
    return files.flatMap((filePath) => {
      const data = readJson<unknown>(filePath);

      if (Array.isArray(data)) return data;

      return [data];
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

  if (!fs.existsSync(portfolioFile)) {
    throw new Error(`portfolio.json 파일이 없습니다: ${portfolioFile}`);
  }

  const community = readCommunityFiles(communityFiles);
  const news = newsFile ? readJson(newsFile) : [];
  const market = readJson(marketFile);
  const portfolio = readJson(portfolioFile);

  const reportInput: ReportInput = {
    mode,
    generatedAt: generatedAt.toISOString(),
    communityWindow,
    files: {
      communityFiles,
      newsFile,
      marketFile,
      portfolioFile,
    },
    portfolio,
    community,
    news,
    market,
  };

  const outputPath = resolveFromRoot(
    'data',
    'output',
    `report-input-${Date.now()}.json`,
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

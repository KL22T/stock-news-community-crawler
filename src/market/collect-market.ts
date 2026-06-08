import { resolveFromRoot, saveJson } from '../utils/file';

type MarketSymbolGroup =
  | 'korea_index'
  | 'korea_derivatives_proxy'
  | 'korea_stock'
  | 'us_index'
  | 'us_futures'
  | 'us_stock'
  | 'fx'
  | 'commodity';

type MarketSymbolConfig = {
  symbol: string;
  name: string;
  group: MarketSymbolGroup;
  note?: string;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency?: string;
        exchangeName?: string;
        instrumentType?: string;
        regularMarketTime?: number;
        timezone?: string;
        gmtoffset?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
};

type MarketSnapshotItem = {
  symbol: string;
  name: string;
  group: MarketSymbolGroup;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changeRate: number | null;
  currency: string | null;
  exchangeName: string | null;
  regularMarketTime: string | null;
  dataTime: string | null;
  latestVolume: number | null;
  source: string;
  sourceNote: string;
  note?: string;
  error?: string;
};

type MarketSnapshot = {
  mode: string;
  capturedAt: string;
  source: string;
  sourceNote: string;
  modeFocus: string[];
  unavailableData: Array<{
    name: string;
    reason: string;
    nextStep: string;
  }>;
  items: MarketSnapshotItem[];
};

const MARKET_SYMBOLS: MarketSymbolConfig[] = [
  // Korea indices
  {
    symbol: '^KS11',
    name: 'KOSPI',
    group: 'korea_index',
  },
  {
    symbol: '^KQ11',
    name: 'KOSDAQ',
    group: 'korea_index',
  },
  {
    symbol: '^KS200',
    name: 'KOSPI 200',
    group: 'korea_derivatives_proxy',
    note: 'KOSPI 야간선물 직접값이 아니라 KOSPI200 정규 지수 대체 지표입니다.',
  },
  {
    symbol: '229200.KS',
    name: 'KODEX KOSDAQ150',
    group: 'korea_derivatives_proxy',
    note: 'KOSDAQ 야간선물 직접값이 아니라 KOSDAQ150 ETF 대체 지표입니다.',
  },

  // Korea stocks
  {
    symbol: '005930.KS',
    name: '삼성전자',
    group: 'korea_stock',
  },
  {
    symbol: '000660.KS',
    name: 'SK하이닉스',
    group: 'korea_stock',
  },
  {
    symbol: '005380.KS',
    name: '현대차',
    group: 'korea_stock',
  },
  {
    symbol: '035420.KS',
    name: 'NAVER',
    group: 'korea_stock',
  },

  // US futures / indices
  {
    symbol: 'NQ=F',
    name: 'Nasdaq 100 Futures',
    group: 'us_futures',
  },
  {
    symbol: 'ES=F',
    name: 'S&P 500 Futures',
    group: 'us_futures',
  },
  {
    symbol: 'YM=F',
    name: 'Dow Futures',
    group: 'us_futures',
  },
  {
    symbol: 'RTY=F',
    name: 'Russell 2000 Futures',
    group: 'us_futures',
  },
  {
    symbol: 'NKD=F',
    name: 'Nikkei 225 Futures',
    group: 'us_futures',
  },
  {
    symbol: '^IXIC',
    name: 'NASDAQ Composite',
    group: 'us_index',
  },
  {
    symbol: '^SOX',
    name: 'PHLX Semiconductor Index',
    group: 'us_index',
  },
  {
    symbol: '^VIX',
    name: 'VIX',
    group: 'us_index',
  },

  // US semiconductor references
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    group: 'us_stock',
  },
  {
    symbol: 'MU',
    name: 'Micron',
    group: 'us_stock',
  },
  {
    symbol: 'AMD',
    name: 'AMD',
    group: 'us_stock',
  },

  // FX / commodities
  {
    symbol: 'KRW=X',
    name: 'USD/KRW',
    group: 'fx',
  },
  {
    symbol: 'CL=F',
    name: 'WTI Crude Oil Futures',
    group: 'commodity',
  },
  {
    symbol: 'BZ=F',
    name: 'Brent Crude Oil Futures',
    group: 'commodity',
  },
];

function toIsoTimeFromUnixSeconds(value: number | undefined): string | null {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

function round(value: number | null, digits = 4): number | null {
  if (value === null || !Number.isFinite(value)) return null;

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getLatestNonNull<T>(values: Array<T | null | undefined> | undefined): T | null {
  if (!values) return null;

  for (let i = values.length - 1; i >= 0; i -= 1) {
    const value = values[i];
    if (value !== null && value !== undefined) return value;
  }

  return null;
}

async function fetchYahooChart(symbol: string): Promise<YahooChartResponse> {
  const encodedSymbol = encodeURIComponent(symbol);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}` +
    '?range=1d&interval=1m&includePrePost=true';

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as YahooChartResponse;
}

async function collectOne(config: MarketSymbolConfig): Promise<MarketSnapshotItem> {
  try {
    const json = await fetchYahooChart(config.symbol);

    const error = json.chart?.error;
    if (error) {
      return {
        symbol: config.symbol,
        name: config.name,
        group: config.group,
        price: null,
        previousClose: null,
        change: null,
        changeRate: null,
        currency: null,
        exchangeName: null,
        regularMarketTime: null,
        dataTime: null,
        latestVolume: null,
        source: 'yahoo-finance-chart',
        sourceNote: 'Yahoo Finance chart endpoint. Unofficial endpoint, can fail or change.',
        note: config.note,
        error: `${error.code ?? 'UNKNOWN'}: ${error.description ?? ''}`.trim(),
      };
    }

    const result = json.chart?.result?.[0];
    const meta = result?.meta;
    const quote = result?.indicators?.quote?.[0];

    const latestClose = getLatestNonNull(quote?.close);
    const latestVolume = getLatestNonNull(quote?.volume);
    const latestTimestamp = getLatestNonNull(result?.timestamp);

    const price = meta?.regularMarketPrice ?? latestClose ?? null;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? null;

    const change =
      price !== null && previousClose !== null ? round(price - previousClose, 4) : null;

    const changeRate =
      change !== null && previousClose !== null && previousClose !== 0
        ? round((change / previousClose) * 100, 4)
        : null;

    return {
      symbol: config.symbol,
      name: config.name,
      group: config.group,
      price: round(price),
      previousClose: round(previousClose),
      change,
      changeRate,
      currency: meta?.currency ?? null,
      exchangeName: meta?.exchangeName ?? null,
      regularMarketTime: toIsoTimeFromUnixSeconds(meta?.regularMarketTime),
      dataTime: toIsoTimeFromUnixSeconds(latestTimestamp ?? undefined),
      latestVolume: latestVolume === null ? null : Number(latestVolume),
      source: 'yahoo-finance-chart',
      sourceNote: 'Yahoo Finance chart endpoint. Unofficial endpoint, can fail or change.',
      note: config.note,
    };
  } catch (error) {
    return {
      symbol: config.symbol,
      name: config.name,
      group: config.group,
      price: null,
      previousClose: null,
      change: null,
      changeRate: null,
      currency: null,
      exchangeName: null,
      regularMarketTime: null,
      dataTime: null,
      latestVolume: null,
      source: 'yahoo-finance-chart',
      sourceNote: 'Yahoo Finance chart endpoint. Unofficial endpoint, can fail or change.',
      note: config.note,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const mode = process.env.REPORT_MODE ?? 'daily';
  console.log(`시장지표 수집 시작: ${new Date().toISOString()}`);

  const items: MarketSnapshotItem[] = [];

  for (const config of MARKET_SYMBOLS) {
    const item = await collectOne(config);
    items.push(item);

    const status =
      item.error ??
      `${item.price ?? 'N/A'} / ${item.changeRate === null ? 'N/A' : `${item.changeRate}%`}`;

    console.log(`[${config.group}] ${config.name} (${config.symbol}) => ${status}`);

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const snapshot: MarketSnapshot = {
    mode,
    capturedAt: new Date().toISOString(),
    source: 'yahoo-finance-chart',
    sourceNote:
      'Yahoo Finance chart endpoint is used for MVP collection. Treat values as reference data and verify against brokerage/official sources for trading decisions.',
    modeFocus:
      mode === 'morning'
        ? [
            '미국장 종가/일간 흐름',
            'Nasdaq/S&P500/SOX/VIX',
            'NXT 또는 장전 가격 반영 여부 확인',
            '오늘 장중 대응 전략',
          ]
        : mode === 'evening'
          ? [
              'NXT장 가격 변동',
              '코스피/코스닥 야간선물 대체 지표',
              '미국 선물 초반 흐름',
              '내일 장초 대응 전략',
            ]
          : ['일일 통합 점검'],
    unavailableData: [
      {
        name: 'NXT장 개별 종목 체결가',
        reason: '공개 Yahoo chart endpoint에서 한국 NXT 체결가를 안정적으로 구분해 제공하지 않습니다.',
        nextStep: '증권사 API, KRX/NXT 공개 페이지, 또는 별도 유료 데이터 소스 확인이 필요합니다.',
      },
      {
        name: '코스피/코스닥 야간선물 직접값',
        reason: '검증한 Yahoo 후보 심볼에서 KOSPI200 야간선물 직접 심볼은 조회되지 않았습니다.',
        nextStep: '현재는 KOSPI200 지수와 KOSDAQ150 ETF를 대체 지표로 사용합니다.',
      },
    ],
    items,
  };

  const outputPath = resolveFromRoot(
    'data',
    'output',
    `market-snapshot-${Date.now()}.json`,
  );

  saveJson(outputPath, snapshot);

  console.log('');
  console.log(`시장지표 저장 완료: ${outputPath}`);
  console.log('');
}

main().catch((error) => {
  console.error('시장지표 수집 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});

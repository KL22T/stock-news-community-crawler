import { formatKstDateTime, formatKstTimestampId, resolveFromRoot, saveJson } from '../utils/file';

type MarketSymbolGroup =
  | 'korea_index'
  | 'korea_derivatives_proxy'
  | 'korea_stock'
  | 'korea_etf'
  | 'korea_sector_etf'
  | 'korea_after_market'
  | 'korea_night_futures'
  | 'us_index'
  | 'us_futures'
  | 'us_stock'
  | 'global_semiconductor'
  | 'rates'
  | 'fx'
  | 'commodity'
  | 'crypto'
  | 'credit';

type MarketSymbolConfig = {
  symbol: string;
  name: string;
  group: MarketSymbolGroup;
  note?: string;
};

type NaverMarketSymbolConfig = MarketSymbolConfig & {
  source: 'naver-finance-page';
};

type NaverMobileOverMarketConfig = MarketSymbolConfig & {
  source: 'naver-mobile-over-market';
  itemCode: string;
};

type ChartlogNightFutureConfig = MarketSymbolConfig & {
  source: 'chartlog-night-futures';
  url: string;
  chartlogSymbol: string;
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

type NaverMobileBasicResponse = {
  stockName?: string;
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  fluctuationsRatio?: string;
  localTradedAt?: string;
  overMarketPriceInfo?: {
    tradingSessionType?: string;
    overMarketStatus?: string;
    overPrice?: string;
    compareToPreviousClosePrice?: string;
    fluctuationsRatio?: string;
    localTradedAt?: string;
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
  // Korea sector proxies
  {
    symbol: '091160.KS',
    name: 'KODEX 반도체',
    group: 'korea_sector_etf',
  },
  {
    symbol: '091230.KS',
    name: 'TIGER 반도체',
    group: 'korea_sector_etf',
  },
  {
    symbol: '091180.KS',
    name: 'KODEX 자동차',
    group: 'korea_sector_etf',
  },
  {
    symbol: '157510.KS',
    name: 'TIGER 자동차',
    group: 'korea_sector_etf',
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
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    group: 'global_semiconductor',
  },
  {
    symbol: 'TSM',
    name: 'TSMC',
    group: 'global_semiconductor',
  },
  {
    symbol: 'ASML',
    name: 'ASML',
    group: 'global_semiconductor',
  },
  {
    symbol: 'AVGO',
    name: 'Broadcom',
    group: 'global_semiconductor',
  },
  {
    symbol: 'ARM',
    name: 'ARM',
    group: 'global_semiconductor',
  },

  // Rates / dollar / risk appetite
  {
    symbol: '^TNX',
    name: 'US 10Y Treasury Yield',
    group: 'rates',
  },
  {
    symbol: '^FVX',
    name: 'US 5Y Treasury Yield',
    group: 'rates',
  },
  {
    symbol: '^IRX',
    name: 'US 13W Treasury Yield',
    group: 'rates',
  },

  // FX / commodities
  {
    symbol: 'DX-Y.NYB',
    name: 'US Dollar Index',
    group: 'fx',
  },
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
  {
    symbol: 'HG=F',
    name: 'Copper Futures',
    group: 'commodity',
  },
  {
    symbol: 'GC=F',
    name: 'Gold Futures',
    group: 'commodity',
  },
  {
    symbol: 'NG=F',
    name: 'Natural Gas Futures',
    group: 'commodity',
  },
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin',
    group: 'crypto',
  },
  {
    symbol: 'ETH-USD',
    name: 'Ethereum',
    group: 'crypto',
  },
  {
    symbol: 'HYG',
    name: 'iShares High Yield Corporate Bond ETF',
    group: 'credit',
  },
  {
    symbol: 'LQD',
    name: 'iShares Investment Grade Corporate Bond ETF',
    group: 'credit',
  },
];

const NAVER_MARKET_SYMBOLS: NaverMarketSymbolConfig[] = [
  {
    symbol: '0117V0',
    name: 'TIGER 코리아AI전력기기TOP3플러스',
    group: 'korea_etf',
    source: 'naver-finance-page',
    note: 'Yahoo chart endpoint에서 안정적으로 조회되지 않아 Naver Finance 페이지를 현재가 소스로 사용합니다.',
  },
  {
    symbol: '0167A0',
    name: 'SOL AI반도체TOP2플러스',
    group: 'korea_etf',
    source: 'naver-finance-page',
    note: 'Yahoo chart endpoint에서 안정적으로 조회되지 않아 Naver Finance 페이지를 현재가 소스로 사용합니다.',
  },
];

const NAVER_OVER_MARKET_SYMBOLS: NaverMobileOverMarketConfig[] = [
  {
    symbol: '005930.OVER',
    itemCode: '005930',
    name: '삼성전자 시간외/NXT 후보',
    group: 'korea_after_market',
    source: 'naver-mobile-over-market',
    note: 'Naver mobile basic API의 overMarketPriceInfo를 사용합니다. 2026-06-09 증권사 NXT 종가 화면과 주요 보유종목 값이 일치했지만, 세션 표기는 계속 대조합니다.',
  },
  {
    symbol: '000660.OVER',
    itemCode: '000660',
    name: 'SK하이닉스 시간외/NXT 후보',
    group: 'korea_after_market',
    source: 'naver-mobile-over-market',
    note: 'Naver mobile basic API의 overMarketPriceInfo를 사용합니다. 2026-06-09 증권사 NXT 종가 화면과 주요 보유종목 값이 일치했지만, 세션 표기는 계속 대조합니다.',
  },
  {
    symbol: '005380.OVER',
    itemCode: '005380',
    name: '현대차 시간외/NXT 후보',
    group: 'korea_after_market',
    source: 'naver-mobile-over-market',
    note: 'Naver mobile basic API의 overMarketPriceInfo를 사용합니다. 2026-06-09 증권사 NXT 종가 화면과 주요 보유종목 값이 일치했지만, 세션 표기는 계속 대조합니다.',
  },
];

const CHARTLOG_NIGHT_FUTURES: ChartlogNightFutureConfig[] = [
  {
    symbol: 'KOSPI200_NIGHT_F',
    name: 'KOSPI 200 Night Future',
    group: 'korea_night_futures',
    source: 'chartlog-night-futures',
    url: 'https://chartlog.net/stats/market-index/kospi-night-futures/',
    chartlogSymbol: 'KOSPI 200 Night Future',
    note: 'Chartlog page embeds KRX night futures 1-minute snapshot data. Source attribution on page: Korea Investment Securities KIS.',
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

function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumberText(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatChartlogKstTimestamp(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return value;
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
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

async function fetchNaverFinanceHtml(symbol: string): Promise<string> {
  const url = `https://finance.naver.com/item/main.naver?code=${encodeURIComponent(symbol)}`;
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

async function fetchNaverMobileBasic(itemCode: string): Promise<NaverMobileBasicResponse> {
  const url = `https://m.stock.naver.com/api/stock/${encodeURIComponent(itemCode)}/basic`;
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      Accept: 'application/json,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as NaverMobileBasicResponse;
}

async function fetchText(url: string): Promise<string> {
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

function parseNaverFinanceItem(
  html: string,
  config: NaverMarketSymbolConfig,
): MarketSnapshotItem {
  const text = cleanText(html);
  const price = parseNumberText(text.match(/현재가\s+([\d,]+)/)?.[1]);
  const previousClose = parseNumberText(text.match(/전일가\s+([\d,]+)/)?.[1]);
  const volume = parseNumberText(text.match(/거래량\s+([\d,]+)/)?.[1]);
  const timeMatch = text.match(/(\d{4})년\s+(\d{2})월\s+(\d{2})일\s+(\d{2})시\s+(\d{2})분\s+기준/);
  const dataTime = timeMatch
    ? new Date(
        Number(timeMatch[1]),
        Number(timeMatch[2]) - 1,
        Number(timeMatch[3]),
        Number(timeMatch[4]),
        Number(timeMatch[5]),
      ).toISOString()
    : null;

  if (price === null) {
    throw new Error(`Naver Finance 현재가 파싱 실패: ${config.symbol}`);
  }

  const change =
    previousClose !== null ? round(price - previousClose, 4) : null;
  const changeRate =
    change !== null && previousClose !== null && previousClose !== 0
      ? round((change / previousClose) * 100, 4)
      : null;

  return {
    symbol: config.symbol,
    name: config.name,
    group: config.group,
    price,
    previousClose,
    change,
    changeRate,
    currency: 'KRW',
    exchangeName: 'Naver Finance',
    regularMarketTime: dataTime,
    dataTime,
    latestVolume: volume,
    source: 'naver-finance-page',
    sourceNote:
      'Naver Finance item page HTML is parsed for Korean ETF prices not available through Yahoo chart endpoint.',
    note: config.note,
  };
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

async function collectOneFromNaver(config: NaverMarketSymbolConfig): Promise<MarketSnapshotItem> {
  try {
    const html = await fetchNaverFinanceHtml(config.symbol);
    return parseNaverFinanceItem(html, config);
  } catch (error) {
    return {
      symbol: config.symbol,
      name: config.name,
      group: config.group,
      price: null,
      previousClose: null,
      change: null,
      changeRate: null,
      currency: 'KRW',
      exchangeName: 'Naver Finance',
      regularMarketTime: null,
      dataTime: null,
      latestVolume: null,
      source: 'naver-finance-page',
      sourceNote:
        'Naver Finance item page HTML is parsed for Korean ETF prices not available through Yahoo chart endpoint.',
      note: config.note,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectOneFromNaverOverMarket(
  config: NaverMobileOverMarketConfig,
): Promise<MarketSnapshotItem> {
  try {
    const data = await fetchNaverMobileBasic(config.itemCode);
    const over = data.overMarketPriceInfo;

    if (!over?.overPrice) {
      throw new Error('overMarketPriceInfo is not available');
    }

    const price = parseNumberText(over.overPrice);
    const previousClose = parseNumberText(data.closePrice);
    const change = parseNumberText(over.compareToPreviousClosePrice);
    const changeRate = parseNumberText(over.fluctuationsRatio);

    return {
      symbol: config.symbol,
      name: config.name,
      group: config.group,
      price,
      previousClose,
      change,
      changeRate,
      currency: 'KRW',
      exchangeName: over.tradingSessionType ?? 'Naver Mobile Over Market',
      regularMarketTime: over.localTradedAt ?? null,
      dataTime: over.localTradedAt ?? null,
      latestVolume: null,
      source: config.source,
      sourceNote:
        'Naver mobile basic API overMarketPriceInfo. Treat as after-market/NXT candidate data until cross-checked with brokerage screens.',
      note: `${config.note ?? ''} status=${over.overMarketStatus ?? 'unknown'}`.trim(),
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
      currency: 'KRW',
      exchangeName: 'Naver Mobile Over Market',
      regularMarketTime: null,
      dataTime: null,
      latestVolume: null,
      source: config.source,
      sourceNote:
        'Naver mobile basic API overMarketPriceInfo. Treat as after-market/NXT candidate data until cross-checked with brokerage screens.',
      note: config.note,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseChartlogNightFuture(html: string, config: ChartlogNightFutureConfig): MarketSnapshotItem {
  const normalized = html.replace(/\\"/g, '"');
  const pattern =
    /"timestamp":"([^"]+)","symbol":"([^"]+)","code":"([^"]+)","price":(-?\d+(?:\.\d+)?),"change_rate":(-?\d+(?:\.\d+)?),"change_value":(-?\d+(?:\.\d+)?),"sign":"([^"]+)","volume":(\d+)/g;
  let latest:
    | {
        timestamp: string;
        code: string;
        price: number;
        changeRate: number;
        change: number;
        volume: number;
      }
    | null = null;

  for (const match of normalized.matchAll(pattern)) {
    const [, timestamp, symbol, code, price, changeRate, change, , volume] = match;
    if (symbol !== config.chartlogSymbol) continue;
    latest = {
      timestamp,
      code,
      price: Number(price),
      changeRate: Number(changeRate),
      change: Number(change),
      volume: Number(volume),
    };
  }

  if (!latest) {
    throw new Error(`Chartlog embedded data not found for ${config.chartlogSymbol}`);
  }

  return {
    symbol: config.symbol,
    name: config.name,
    group: config.group,
    price: latest.price,
    previousClose: round(latest.price - latest.change),
    change: latest.change,
    changeRate: latest.changeRate,
    currency: 'KRW',
    exchangeName: 'KRX Night Market',
    regularMarketTime: formatChartlogKstTimestamp(latest.timestamp),
    dataTime: formatChartlogKstTimestamp(latest.timestamp),
    latestVolume: latest.volume,
    source: config.source,
    sourceNote:
      'Chartlog market-index page embedded KOSPI 200 night futures 1-minute data. Source attribution on page: Korea Investment Securities KIS.',
    note: `${config.note ?? ''} code=${latest.code}`.trim(),
  };
}

async function collectOneFromChartlogNightFuture(
  config: ChartlogNightFutureConfig,
): Promise<MarketSnapshotItem> {
  try {
    const html = await fetchText(config.url);
    return parseChartlogNightFuture(html, config);
  } catch (error) {
    return {
      symbol: config.symbol,
      name: config.name,
      group: config.group,
      price: null,
      previousClose: null,
      change: null,
      changeRate: null,
      currency: 'KRW',
      exchangeName: 'KRX Night Market',
      regularMarketTime: null,
      dataTime: null,
      latestVolume: null,
      source: config.source,
      sourceNote:
        'Chartlog market-index page embedded KOSPI 200 night futures 1-minute data. Source attribution on page: Korea Investment Securities KIS.',
      note: config.note,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const mode = process.env.REPORT_MODE ?? 'daily';
  const capturedAt = new Date();
  console.log(`시장지표 수집 시작: ${formatKstDateTime(capturedAt)}`);

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

  for (const config of NAVER_MARKET_SYMBOLS) {
    const item = await collectOneFromNaver(config);
    items.push(item);

    const status =
      item.error ??
      `${item.price ?? 'N/A'} / ${item.changeRate === null ? 'N/A' : `${item.changeRate}%`}`;

    console.log(`[${config.group}] ${config.name} (${config.symbol}) => ${status}`);

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  for (const config of NAVER_OVER_MARKET_SYMBOLS) {
    const item = await collectOneFromNaverOverMarket(config);
    items.push(item);

    const status =
      item.error ??
      `${item.price ?? 'N/A'} / ${item.changeRate === null ? 'N/A' : `${item.changeRate}%`}`;

    console.log(`[${config.group}] ${config.name} (${config.symbol}) => ${status}`);

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  for (const config of CHARTLOG_NIGHT_FUTURES) {
    const item = await collectOneFromChartlogNightFuture(config);
    items.push(item);

    const status =
      item.error ??
      `${item.price ?? 'N/A'} / ${item.changeRate === null ? 'N/A' : `${item.changeRate}%`}`;

    console.log(`[${config.group}] ${config.name} (${config.symbol}) => ${status}`);

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const snapshot: MarketSnapshot = {
    mode,
    capturedAt: formatKstDateTime(capturedAt),
    source: 'yahoo-finance-chart',
    sourceNote:
      'Yahoo Finance chart endpoint is used for MVP collection. Treat values as reference data and verify against brokerage/official sources for trading decisions.',
    modeFocus:
      mode === 'morning'
        ? [
            '미국장 종가/일간 흐름',
            'Nasdaq/S&P500/SOX/VIX',
            '전일 NXT/시간외 후보와 야간선물 반영 여부 확인',
            '오늘 장중 대응 전략',
          ]
        : mode === 'midday'
          ? [
              '오전장 KOSPI/KOSDAQ 흐름',
              '보유 종목 오전 등락과 업종 ETF proxy',
              '환율/금리/반도체 글로벌 선행 지표',
              '오후장 대응 전략',
            ]
          : mode === 'preclose'
            ? [
                '정규장 종가와 동시호가 대응',
                '보유 종목 종가 등락과 업종 ETF proxy',
                '장후 NXT/시간외 후보 수집 준비',
                '동시호가 추격 금지선 확인',
              ]
            : mode === 'evening'
              ? [
                  'NXT/시간외 후보 가격 변동',
                  'KOSPI200 야간선물 직접값',
                  '미국 선물 초반 흐름',
                  '내일 장초 대응 전략',
                ]
              : ['일일 통합 점검'],
    unavailableData: [
      {
        name: 'KOSDAQ150 야간선물 직접값',
        reason:
          '현재 수집 소스에서는 KOSPI200 야간선물은 확인되지만 KOSDAQ150 야간선물 직접값은 아직 안정적으로 파싱하지 못했습니다.',
        nextStep:
          'KRX/증권사/거래소 공개 페이지에서 KOSDAQ150 야간선물 피드가 있는지 추가 확인합니다.',
      },
      {
        name: 'NXT/시간외 후보값 검증 상태',
        reason:
          '2026-06-09 저녁 증권사 NXT 종가 화면과 삼성전자, SK하이닉스, 현대차, ETF 값이 일치했습니다. 다만 API 필드명은 overMarketPriceInfo이므로 리포트에서는 검증된 NXT 종가 후보값으로 표기합니다.',
        nextStep:
          '다른 날짜에도 증권사 화면 또는 NXT 공식/공개 데이터와 대조해 tradingSessionType과 overMarketStatus의 의미를 확정합니다.',
      },
    ],
    items,
  };

  const outputPath = resolveFromRoot(
    'data',
    'output',
    `market-snapshot-${formatKstTimestampId(capturedAt)}.json`,
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

import fs from 'node:fs';
import path from 'node:path';
import { formatKstDateTime, formatKstTimestampId, resolveFromRoot, saveJson } from '../utils/file';

type Stance = 'bullish' | 'bearish' | 'neutral' | 'meme';

type EvidenceTag =
  | 'macro'
  | 'fx'
  | 'oil'
  | 'us-futures'
  | 'vix'
  | 'geopolitics'
  | 'semiconductor'
  | 'naver'
  | 'chart'
  | 'news'
  | 'derivatives'
  | 'meme'
  | 'portfolio';

type EvidenceQuality = 'high' | 'medium-high' | 'medium' | 'low';

type MarketAlignment = 'aligned' | 'partially-aligned' | 'conflicted' | 'not-verifiable';

type MarketRegime =
  | 'panic-with-relief-signals'
  | 'risk-on-rebound'
  | 'risk-off-continuation'
  | 'mixed'
  | 'unknown';

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
  stockName?: string;
  stockCode?: string;
  sectorTag?: string;
};

type MarketItem = {
  symbol: string;
  name: string;
  group: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changeRate: number | null;
  currency: string | null;
  source?: string;
};

type MarketUnavailableData = {
  name: string;
  reason: string;
  nextStep: string;
};

type Position = {
  name: string;
  symbol: string | null;
  qty: number;
  sellableQty?: number;
  buyAmount?: number;
  breakEvenPrice?: number;
  lastSeenPrice?: number;
  evalAmount: number;
  pnlRate: number;
  sectorTag: string;
};

type PositionValuation = {
  name: string;
  symbol: string | null;
  qty: number;
  sellableQty: number;
  buyAmount: number;
  breakEvenPrice: number | null;
  lastSeenPrice: number | null;
  currentPrice: number | null;
  priceSource: string;
  marketVsLastSeenRate: number | null;
  isInputPriceStale: boolean;
  evalAmount: number;
  pnlAmount: number;
  pnlRate: number | null;
  sectorTag: string;
};

type TradeEvent = {
  executedAt: string;
  action: 'buy' | 'sell' | 'trim' | 'watch' | string;
  name: string;
  symbol: string | null;
  qty?: number;
  price?: number;
  amount?: number;
  reason?: string;
  lesson?: string;
  referencePrice?: number;
};

type WeightedSectorExposure = {
  sector: string;
  amount: number;
  rate: number;
};

type OrderRecommendation = {
  name: string;
  symbol: string | null;
  stance: 'hold' | 'pullback-buy' | 'trim-on-strength' | 'no-chase' | 'watch';
  actionSignal: 'NO_BUY' | 'WATCH_BUY' | 'BUY_1' | 'BUY_2' | 'HOLD' | 'TRIM';
  buy1: number | null;
  buy2: number | null;
  noChaseAbove: number | null;
  trimAbove: number | null;
  suggestedQty: number;
  signalBasis: string;
  reason: string;
};

type DecisionReview = {
  event: TradeEvent;
  currentPrice: number | null;
  opportunityPnl: number | null;
  nxtPrice: number | null;
  nxtOpportunityPnl: number | null;
  verdict: string;
  nextRule: string;
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

type ReportInput = {
  mode?: 'daily' | 'morning' | 'midday' | 'preclose' | 'evening' | string;
  generatedAt: string;
  communityWindow?: {
    from: string;
    to: string;
    lookbackHours: number;
  };
  communityFilter?: {
    originalCount: number;
    filteredCount: number;
    excludedCount: number;
    unknownTimestampCount: number;
    mode: string;
  };
  portfolio: {
    capturedAt: string;
    cashEstimated: number;
    positions: Position[];
  };
  tradeEvents?: TradeEvent[];
  community: CommunityPost[];
  news?: NewsItem[];
  market: {
    mode?: string;
    modeFocus?: string[];
    unavailableData?: MarketUnavailableData[];
    capturedAt: string;
    items: MarketItem[];
  };
};

type ClaimAnalysis = {
  claim: string;
  stance: Stance;
  stanceReason: string;
};

type EvidenceAnalysis = {
  tags: EvidenceTag[];
  quality: EvidenceQuality;
  qualityScore: number;
  qualityReason: string;
};

type AlignmentAnalysis = {
  alignment: MarketAlignment;
  alignmentScore: number;
  reason: string;
};

type PortfolioImpact = {
  affectedPositions: string[];
  directAffectedPositions: string[];
  macroAffectedPositions: string[];
  impactSummary: string;
};

type AnalyzedPost = CommunityPost & {
  claim: string;
  stance: Stance;
  stanceReason: string;
  evidenceTags: EvidenceTag[];
  evidenceQuality: EvidenceQuality;
  evidenceQualityScore: number;
  evidenceQualityReason: string;
  marketAlignment: MarketAlignment;
  marketAlignmentScore: number;
  marketAlignmentReason: string;
  affectedPositions: string[];
  directAffectedPositions: string[];
  macroAffectedPositions: string[];
  portfolioImpactSummary: string;
  influenceScore: number;
};

type MarketRegimeSummary = {
  regime: MarketRegime;
  description: string;
  bullishSignals: string[];
  bearishSignals: string[];
  mixedSignals: string[];
  keySignals: string[];
};

type NxtSignal = {
  name: string;
  symbol: string | null;
  sourceSymbol: string;
  sourceGroup: string;
  price: number;
  change: number | null;
  dayChangeRate: number | null;
  regularClosePrice: number | null;
  nxtOnlyChange: number | null;
  nxtOnlyChangeRate: number | null;
  lastSeenPrice: number | null;
  vsLastSeenChange: number | null;
  vsLastSeenChangeRate: number | null;
  breakEvenPrice: number | null;
  vsBreakEvenRate: number | null;
  signal: 'surge-no-chase' | 'strong' | 'weak' | 'neutral';
};

type AnalysisOutput = {
  mode: string;
  generatedAt: string;
  sourceFile: string;
  communityWindow?: ReportInput['communityWindow'];
  communityFilter?: ReportInput['communityFilter'];
  marketRegime: MarketRegimeSummary;
  communitySummary: {
    total: number;
    stanceCounts: Record<Stance, number>;
    evidenceTagCounts: Record<EvidenceTag, number>;
    averageEvidenceQualityScore: number;
    averageMarketAlignmentScore: number;
    highConfidenceClaims: AnalyzedPost[];
    informativeClaims: AnalyzedPost[];
    lowConfidenceClaims: AnalyzedPost[];
    posts: AnalyzedPost[];
  };
  marketSummary: {
    modeFocus: string[];
    unavailableData: MarketUnavailableData[];
    items: MarketItem[];
    nxtSignals: NxtSignal[];
  };
  newsSummary: {
    total: number;
    topItems: NewsItem[];
  };
  portfolioSummary: {
    totalStockEvalAmount: number;
    totalBuyAmount: number;
    totalPnlAmount: number;
    totalPnlRate: number | null;
    cashEstimated: number;
    totalEstimatedAsset: number;
    sectorExposure: Record<string, number>;
    sectorExposureRate: Record<string, number>;
    weightedSectorExposure: WeightedSectorExposure[];
    concentrationWarnings: string[];
    priceWarnings: string[];
    positions: PositionValuation[];
  };
  strategy: {
    headline: string;
    actionItems: string[];
    rationale: string[];
    tomorrowScenarios: Array<{
      scenario: string;
      condition: string;
      action: string;
    }>;
    positionRules: Array<{
      name: string;
      action: string;
      trigger: string;
      reason: string;
    }>;
    orderRecommendations: OrderRecommendation[];
    guardrails: string[];
    decisionReviews: DecisionReview[];
  };
};

type NewsSignal = {
  bullish: number;
  bearish: number;
  neutral: number;
  topBearish: NewsItem[];
  topBullish: NewsItem[];
  byPosition: Record<
    string,
    {
      bullish: number;
      bearish: number;
      neutral: number;
    }
  >;
};

function readJson<T>(filePath: string): T {
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

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function isAnalysisNoisePost(post: CommunityPost): boolean {
  const text = `${post.board} ${post.cleanTitle} ${post.bodyText} ${post.rawListText}`;

  if (
    containsAny(text, [
      '선거',
      '개표',
      '개표소',
      '투표',
      '정치',
      '극우',
      '민주화',
      '사이비',
      '기독교',
      '도련님',
      '선거용지',
      '대만 방송',
    ])
  ) {
    return true;
  }

  if (containsAny(post.cleanTitle, ['문자 이거 머냐', '오늘 국장 요약.jpg', '요약.jpg'])) {
    return true;
  }

  if (
    post.community === '네이버 종목토론방' &&
    ['ㅠㅠ', 'ㅋㅋㅋㅋㅋ', '일단', '이제', '굿뜨'].includes(post.cleanTitle)
  ) {
    return true;
  }

  return false;
}

function numberOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return value;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getMarket(items: MarketItem[], nameOrSymbol: string): MarketItem | undefined {
  return items.find((item) => item.name === nameOrSymbol || item.symbol === nameOrSymbol);
}

function formatChangeRate(item: MarketItem | undefined): string {
  if (!item || item.changeRate === null) return 'N/A';
  return `${item.changeRate}%`;
}

function formatMarketPrice(item: MarketItem): string {
  if (item.price === null) return 'N/A';
  if (item.currency === 'KRW') return `${item.price.toLocaleString()}원`;
  return item.price.toLocaleString();
}

function textMentionsPosition(text: string, positionName: string): boolean {
  const aliases: Record<string, string[]> = {
    SK하이닉스: ['SK하이닉스', '하이닉스', '하닉', '000660'],
    현대차: ['현대차', '현차', '005380'],
    삼성전자: ['삼성전자', '삼전', '005930'],
    'TIGER 코리아AI전력기기TOP3플러스': ['TIGER', '전력기기', 'AI전력', '0117V0'],
    'SOL AI반도체TOP2플러스': ['SOL', 'AI반도체', '반도체TOP2', '0167A0'],
  };

  return (aliases[positionName] ?? [positionName]).some((alias) => text.includes(alias));
}

function extractEvidenceTags(text: string): EvidenceTag[] {
  const tags = new Set<EvidenceTag>();

  if (containsAny(text, ['환율', '원달러', '달러', '1527', '1530', '1550'])) tags.add('fx');

  if (containsAny(text, ['유가', '원유', 'WTI', '브렌트'])) tags.add('oil');

  if (containsAny(text, ['종전', '이란', '이스라엘', '영공', '공격중단', '트럼프'])) {
    tags.add('geopolitics');
  }

  if (containsAny(text, ['나선', '야선', '나스닥', '프리장', '미선물', '선물', '미장'])) {
    tags.add('us-futures');
  }

  if (containsAny(text, ['vix', 'VIX', '빅스', '공포탐욕', '공탐지수'])) tags.add('vix');

  if (
    containsAny(text, [
      '삼성전자',
      '삼전',
      '하이닉스',
      'SK하이닉스',
      'HBM',
      'MU',
      '마이크론',
      '엔비디아',
      '젠슨황',
      '젠슨',
      '쇼티지',
      '병목',
      '웨이퍼',
      '반도체',
      '필반',
      'SOX',
      '샌디스크',
      '마벨',
    ])
  ) {
    tags.add('semiconductor');
  }


  if (containsAny(text, ['차트', '쌍바닥', '저항', '지지', '반등', '음봉', '양봉', '거래대금', '수급', '20일선', '60일선'])) {
    tags.add('chart');
  }

  if (containsAny(text, ['로이터', '속보', 'CEO', '뉴스', '트루스'])) tags.add('news');

  if (containsAny(text, ['옵션', '풋', '콜', '감마', '만기', '롤오버', '숏커버'])) {
    tags.add('derivatives');
  }

  if (containsAny(text, ['ㅋㅋ', 'ㅅㅂ', '드립', '슈카', '알상무', '고추', '풀발기', '떡상', 'ㅅㅅㅅ'])) {
    tags.add('meme');
  }

  if (containsAny(text, ['계좌', '손절', '존버', '탑승', '물타기', '제자리', '외인', '외국인', '기관', '종배', '평단'])) {
    tags.add('portfolio');
  }

  if (containsAny(text, ['금리', '고용', 'CPI', 'FOMC', '연준', '매크로'])) {
    tags.add('macro');
  }

  return Array.from(tags);
}

function analyzeClaim(post: CommunityPost): ClaimAnalysis {
  const text = `${post.cleanTitle} ${post.bodyText} ${post.rawListText}`;
  const titleText = post.cleanTitle;
  const isNaverDiscussion = post.community === '네이버 종목토론방';

  if (isAnalysisNoisePost(post)) {
    return {
      stance: 'meme',
      claim: '종목 판단과 직접 관련이 낮은 정치/잡담성 글입니다.',
      stanceReason: '분석 표에는 남기되 매매 판단 근거와 포트폴리오 직접 영향에서는 제외합니다.',
    };
  }

  if (containsAny(text, ['못믿고 하차', '못 믿고 하차', '네이버 못믿고', '하차했습니다'])) {
    return {
      stance: 'bearish',
      claim: '해당 종목에 대한 신뢰 저하 또는 이탈을 말하는 약세성 주장입니다.',
      stanceReason: '구체적 근거는 약하지만 보유자 심리 약화와 이탈 신호로 해석할 수 있습니다.',
    };
  }

  if (containsAny(text, ['안 팔았다', '안팔았다', '단 한 주도 안 팔았다'])) {
    return {
      stance: 'neutral',
      claim: '보유 지속 의지를 드러내는 글입니다.',
      stanceReason: '방향성 근거보다는 보유자 심리 확인용입니다.',
    };
  }

  if (
    isNaverDiscussion &&
    containsAny(text, ['마이크론 폭등', '마이크론', 'MU', '엔비디아', '반도체', 'HBM', '필반', '샌디스크', '젠슨']) &&
    containsAny(text, ['폭등', '급등', '10프로', '상승', '좋', '부럽', '%', '오르', '신기록', '데이터센터', '투자'])
  ) {
    return {
      stance: 'bullish',
      claim: '미국 반도체주 강세를 보유 반도체 종목의 단기 우호 신호로 보는 주장입니다.',
      stanceReason: '네이버 종토방의 종목별 반응에서 마이크론/반도체 강세를 직접 호재로 연결하고 있습니다.',
    };
  }

  if (
    containsAny(text, ['마이크론 테크놀로지 주가', '샌디스크 목표가', '마이크론 DRAM', '마이크론 NAND']) ||
    (containsAny(text, ['마이크론', '샌디스크', '필반', 'SOX']) &&
      containsAny(text, ['급등', '폭등', '상향', '오르', '+9', '+10', '9%', '10%']))
  ) {
    return {
      stance: 'bullish',
      claim: '미국 메모리·반도체 강세를 국내 반도체 보유 종목의 우호 신호로 보는 주장입니다.',
      stanceReason: '마이크론, 샌디스크, 필라델피아 반도체 지수 강세는 삼성전자·SK하이닉스 투자심리에 직접 연결됩니다.',
    };
  }

  if (
    isNaverDiscussion &&
    containsAny(text, ['거래대금', '수급', '차트', '외인', '기관', '매수']) &&
    containsAny(text, ['완벽', '좋', '계속', '상승', '간다', '갈 수'])
  ) {
    return {
      stance: 'bullish',
      claim: '수급과 차트 흐름을 근거로 해당 종목의 추가 상승을 기대하는 주장입니다.',
      stanceReason: '종목토론방 제목에서 거래대금, 수급, 차트 같은 직접 관찰 지표를 호재로 해석합니다.',
    };
  }

  if (
    isNaverDiscussion &&
    containsAny(text, ['야선', '코스피 야선', '나스닥', '미국증시']) &&
    containsAny(text, ['+', '돌파', '상승', '올라', '우상향', '쏘'])
  ) {
    return {
      stance: 'bullish',
      claim: '야간선물이나 미국증시 강세를 다음 장 반등 재료로 보는 주장입니다.',
      stanceReason: '종목토론방의 단기 기대는 야선/미국장 흐름을 국내 보유 종목의 간접 신호로 연결합니다.',
    };
  }

  if (
    isNaverDiscussion &&
    containsAny(text, ['나스닥', '테슬라', '미장']) &&
    containsAny(text, ['폭등', '급등', '상승'])
  ) {
    return {
      stance: 'bullish',
      claim: '미국 성장주 강세를 국내 보유 종목의 간접 우호 신호로 보는 주장입니다.',
      stanceReason: '나스닥/테슬라 강세를 국내 자동차·성장주 투자심리와 연결합니다.',
    };
  }

  if (
    isNaverDiscussion &&
    containsAny(text, ['폭등할까봐', '70만원', '시간이란다', '떡상', '말아 올려', '반등', '올려놓아라'])
  ) {
    return {
      stance: 'bullish',
      claim: '해당 종목의 단기 반등이나 가격 회복을 기대하는 주장입니다.',
      stanceReason: '구체적 근거는 약하지만 종목별 토론방에서 보유자 기대 심리가 강화된 신호입니다.',
    };
  }

  if (
    isNaverDiscussion &&
    containsAny(text, ['반등 못할듯', '쉽게 반등 못', '끝난거냐', '밀줄', '떠납니다', '하락장', '얼마 안빠졌네'])
  ) {
    return {
      stance: 'bearish',
      claim: '해당 종목의 반등 지속성이나 단기 수급을 경계하는 주장입니다.',
      stanceReason: '종목토론방의 약세 표현은 신뢰도는 낮지만 보유자 심리 훼손 신호로 볼 수 있습니다.',
    };
  }

  if (
    isNaverDiscussion &&
    containsAny(titleText, ['던지지', '매도하지', '손절하지', '안티', '뒤져봐라', '극우', '사이비'])
  ) {
    return {
      stance: 'meme',
      claim: '종목토론방의 감정적 방어 또는 안티 대응성 글입니다.',
      stanceReason: '명확한 투자 근거보다는 보유자 심리와 커뮤니티 감정 확인용입니다.',
    };
  }

  if (containsAny(text, ['이스라엘 레바논 공격 금지 경고 거부', '공격 금지 경고 거부'])) {
    return {
      stance: 'bearish',
      claim: '이스라엘·레바논 관련 지정학 리스크가 완화되지 않았다는 경계성 주장입니다.',
      stanceReason: '중동 긴장 확대 가능성은 유가와 위험자산 심리에 부정적으로 작용할 수 있습니다.',
    };
  }

  if (containsAny(text, ['공격중단 아직 결정한적 없'])) {
    return {
      stance: 'bearish',
      claim: '중동 리스크 완화가 아직 확정되지 않았다는 주장입니다.',
      stanceReason: '이스라엘 공격 중단 불확실성을 근거로 위험자산 반등을 경계합니다.',
    };
  }

  if (containsAny(text, ['외국인 이제 주식안판대', '외인들 계속 매매', '외인', '외국인']) && containsAny(text, ['안판', '매매', '수급'])) {
    return {
      stance: 'bullish',
      claim: '외국인 수급 개선을 국내 증시 반등 재료로 보는 주장입니다.',
      stanceReason: '외국인 매도 압력 완화나 매수 지속은 대형주와 성장주 심리에 우호적입니다.',
    };
  }

  if (containsAny(text, ['실시간 공탐지수', '공포탐욕지수', '공탐지수'])) {
    return {
      stance: 'bullish',
      claim: '공포탐욕지수 개선을 위험선호 회복 신호로 보는 주장입니다.',
      stanceReason: '공포 심리 완화는 단기 반등 기대와 연결될 수 있지만 단독 매매 근거로는 제한적입니다.',
    };
  }

  if (containsAny(text, ['레버로 스위칭', '롱', '레버']) && containsAny(text, ['스위칭', '쳐맞고', '발라먹'])) {
    return {
      stance: 'bullish',
      claim: '하락 이후 레버리지 또는 롱 포지션으로 반등을 노리는 주장입니다.',
      stanceReason: '커뮤니티 포지션 변화는 단기 반등 기대를 보여주지만 근거 신뢰도는 제한적입니다.',
    };
  }

  if (containsAny(text, ['환율 1527', '실시간 환율'])) {
    return {
      stance: 'bullish',
      claim: '원/달러 환율 하락을 위험 완화 신호로 보는 주장입니다.',
      stanceReason: '환율 하락은 외국인 수급과 국내 증시에 우호적인 신호로 해석될 수 있습니다.',
    };
  }

  if (containsAny(text, ['프리장의 악마', '마벨'])) {
    return {
      stance: 'bearish',
      claim: '프리마켓 반등을 과신하지 말라는 경계성 주장입니다.',
      stanceReason: '미국 본장 전 움직임은 본장 방향과 다를 수 있다는 경고입니다.',
    };
  }

  if (containsAny(text, ['네이버는', '탑승기회'])) {
    return {
      stance: 'bullish',
      claim: '비보유 플랫폼 종목의 상대강도 주장입니다.',
      stanceReason: '현재 포트폴리오 보유 종목이 아니므로 전략 판단에서는 참고 우선순위를 낮춥니다.',
    };
  }

  if (containsAny(text, ['31 207', '제자리 갖다놔라'])) {
    return {
      stance: 'bullish',
      claim: '삼성전자 31만 원, SK하이닉스 207만 원 부근 회복을 기대하는 주장입니다.',
      stanceReason: '당일 급락분 회복을 바라는 가격 회귀 기대입니다.',
    };
  }

  if (containsAny(text, ['로이터', 'SK하이닉스', '웨이퍼', '생산 능력', '부족'])) {
    return {
      stance: 'bullish',
      claim: 'SK하이닉스의 생산능력 증설도 부족할 만큼 AI 메모리 수요가 강하다는 주장입니다.',
      stanceReason: '로이터/엔비디아 CEO 발언을 근거로 HBM·메모리 공급 부족을 호재로 해석합니다.',
    };
  }

  if (containsAny(text, ['쇼티지', '병목', '젠슨황'])) {
    return {
      stance: 'bullish',
      claim: 'AI 공급망 병목과 메모리 부족이 엔비디아·SK하이닉스에 유리하다는 주장입니다.',
      stanceReason: '공급망 병목을 경쟁우위와 가격 결정력의 근거로 봅니다.',
    };
  }

  if (containsAny(text, ['야선 풀발기', '존나 내렸으니까'])) {
    return {
      stance: 'bullish',
      claim: '낙폭과대 이후 야간선물 반등을 기대하는 주장입니다.',
      stanceReason: '논리적 근거보다는 낙폭과대 심리와 반등 기대에 가깝습니다.',
    };
  }

  if (containsAny(text, ['영공 재개방'])) {
    return {
      stance: 'bullish',
      claim: '이라크 영공 재개방을 지정학 리스크 완화 신호로 보는 주장입니다.',
      stanceReason: '중동 긴장 완화 가능성을 시장 반등 재료로 해석합니다.',
    };
  }

  if (containsAny(text, ['MU 차트'])) {
    return {
      stance: 'bullish',
      claim: '마이크론 차트 반등을 반도체 심리 개선 신호로 보는 주장입니다.',
      stanceReason: '미국 메모리주 차트를 한국 반도체 회복 기대와 연결합니다.',
    };
  }

  if (containsAny(text, ['VIX', 'vix', '빅스'])) {
    return {
      stance: 'bullish',
      claim: 'VIX 하락을 공포 완화와 반등 신호로 보는 주장입니다.',
      stanceReason: '공포지수 하락은 단기 위험선호 회복과 연결될 수 있습니다.',
    };
  }

  if (containsAny(text, ['ㅋㅋ', 'ㅅㅂ', '슈카', '알상무'])) {
    return {
      stance: 'meme',
      claim: '장세를 밈이나 감정적으로 소비하는 글입니다.',
      stanceReason: '명확한 투자 근거보다는 커뮤니티 분위기 확인용입니다.',
    };
  }

  return {
    stance: 'neutral',
    claim: '명확한 방향성보다는 장세 반응 또는 관찰성 글입니다.',
    stanceReason: '직접적인 매매 근거로 쓰기에는 정보가 부족합니다.',
  };
}

function analyzeEvidenceQuality(post: CommunityPost, tags: EvidenceTag[]): EvidenceAnalysis {
  const text = `${post.cleanTitle} ${post.bodyText} ${post.rawListText}`;
  const isNaverDiscussion = post.community === '네이버 종목토론방';
  const isNoisePost = isAnalysisNoisePost(post);
  const hasTitleSignal = containsAny(post.cleanTitle, [
    '마이크론',
    '필반',
    'SOX',
    '샌디스크',
    '야선',
    '나스닥',
    '테슬라',
    '거래대금',
    '수급',
    '차트',
    '외인',
    '외국인',
    '반등',
    '폭등',
    '폭락',
  ]);

  let score = 1.5;
  const reasons: string[] = [];

  if (isNoisePost) {
    return {
      tags,
      quality: 'low',
      qualityScore: 0.3,
      qualityReason: '정치/잡담성 노이즈로 판단되어 매매 근거 품질을 낮게 평가했습니다.',
    };
  }

  if (tags.includes('news')) {
    score += 2;
    reasons.push('뉴스/속보/로이터성 근거가 포함되어 있습니다.');
  }

  if (tags.includes('fx') || tags.includes('us-futures') || tags.includes('vix')) {
    score += 1.5;
    reasons.push('실시간 시장지표 기반 근거가 포함되어 있습니다.');
  }

  if (tags.includes('semiconductor') || tags.includes('naver')) {
    score += 1;
    reasons.push('보유 종목과 직접 연결되는 산업/종목 근거가 있습니다.');
  }

  if (tags.includes('geopolitics') || tags.includes('oil')) {
    score += 0.8;
    reasons.push('지정학/유가 관련 매크로 근거가 있습니다.');
  }

  if (tags.includes('chart')) {
    score += 0.5;
    reasons.push('차트 또는 가격 흐름 근거가 있습니다.');
  }

  if (isNaverDiscussion) {
    score += 0.4;
    reasons.push('보유 종목의 네이버 종목토론방에서 나온 직접 반응입니다.');

    if (hasTitleSignal) {
      score += 0.6;
      reasons.push('제목에 종목, 수급, 지수, 반도체 등 해석 가능한 단서가 있습니다.');
    }

    if ((post.views ?? 0) >= 100 || (post.likes ?? 0) >= 5) {
      score += 0.3;
      reasons.push('종목토론방 내 조회/공감 반응이 일부 확인됩니다.');
    }
  }

  if (tags.includes('meme')) {
    score -= 1.2;
    reasons.push('밈/감정성 표현이 많아 근거 품질이 낮아집니다.');
  }

  if ((!isNaverDiscussion && post.bodyText.length < 40) || post.bodyText.includes('복사')) {
    score -= 0.7;
    reasons.push('본문 정보량이 부족합니다.');
  }

  if ((post.likes ?? 0) >= 50 || (post.views ?? 0) >= 10000) {
    score += 0.3;
    reasons.push('커뮤니티 내 확산도는 높습니다.');
  }

  const clamped = Math.max(0, Math.min(5, score));

  let quality: EvidenceQuality;

  if (clamped >= 4) {
    quality = 'high';
  } else if (clamped >= 3) {
    quality = 'medium-high';
  } else if (clamped >= 2) {
    quality = 'medium';
  } else {
    quality = 'low';
  }

  return {
    tags,
    quality,
    qualityScore: round(clamped, 2),
    qualityReason: reasons.length > 0 ? reasons.join(' ') : '근거가 제한적입니다.',
  };
}

function analyzeMarketAlignment(params: {
  stance: Stance;
  tags: EvidenceTag[];
  marketItems: MarketItem[];
}): AlignmentAnalysis {
  const { stance, tags, marketItems } = params;

  const kospi = getMarket(marketItems, 'KOSPI');
  const kosdaq = getMarket(marketItems, 'KOSDAQ');
  const nq = getMarket(marketItems, 'NQ=F');
  const sox = getMarket(marketItems, '^SOX');
  const vix = getMarket(marketItems, 'VIX');
  const usdkrw = getMarket(marketItems, 'USD/KRW');
  const wti = getMarket(marketItems, 'WTI Crude Oil Futures');
  const brent = getMarket(marketItems, 'Brent Crude Oil Futures');

  const reasons: string[] = [];
  let score = 0;

  if (tags.includes('us-futures')) {
    if ((nq?.changeRate ?? 0) > 0.5) {
      score += stance === 'bullish' ? 1.5 : -0.5;
      reasons.push(`나스닥100 선물 ${formatChangeRate(nq)}로 단기 반등 근거와 부합합니다.`);
    } else {
      score -= stance === 'bullish' ? 1 : 0;
      reasons.push(`나스닥100 선물이 강하지 않아 상승 주장의 근거가 약합니다.`);
    }
  }

  if (tags.includes('vix')) {
    if ((vix?.changeRate ?? 0) < 0) {
      score += stance === 'bullish' ? 1.2 : 0;
      reasons.push(`VIX ${formatChangeRate(vix)}로 공포 완화 주장은 지표와 부합합니다.`);
    } else {
      score -= stance === 'bullish' ? 1 : 0;
      reasons.push(`VIX가 하락하지 않아 공포 완화 주장이 약합니다.`);
    }
  }

  if (tags.includes('fx')) {
    if ((usdkrw?.changeRate ?? 0) < 0) {
      score += stance === 'bullish' ? 1.2 : 0.3;
      reasons.push(`USD/KRW ${usdkrw?.price}, ${formatChangeRate(usdkrw)}로 환율 부담 완화와 부합합니다.`);
    } else {
      score -= stance === 'bullish' ? 1 : 0;
      reasons.push(`환율이 하락하지 않아 위험 완화 근거가 약합니다.`);
    }
  }

  if (tags.includes('geopolitics') || tags.includes('oil')) {
    const oilStillUp = (wti?.changeRate ?? 0) > 0.5 || (brent?.changeRate ?? 0) > 0.5;

    if (stance === 'bullish' && oilStillUp) {
      score -= 0.8;
      reasons.push(`WTI ${formatChangeRate(wti)}, Brent ${formatChangeRate(brent)}로 유가 부담은 아직 남아 있습니다.`);
    }

    if (stance === 'bearish' && oilStillUp) {
      score += 1;
      reasons.push(`유가가 상승 중이라 지정학 리스크 경계론과 부합합니다.`);
    }
  }

  if (tags.includes('semiconductor')) {
    if ((sox?.changeRate ?? 0) <= -5) {
      if (stance === 'bullish') {
        score -= 0.8;
        reasons.push(`SOX 직전장 ${formatChangeRate(sox)}로 단기 반도체 반등 주장은 아직 확인이 필요합니다.`);
      } else {
        score += 1;
        reasons.push(`SOX 직전장 급락은 반도체 경계론과 부합합니다.`);
      }
    }

    if ((nq?.changeRate ?? 0) > 0.5 && stance === 'bullish') {
      score += 0.6;
      reasons.push(`다만 나스닥100 선물 반등은 반도체 기술적 반등 가능성을 보강합니다.`);
    }
  }

  const domesticCrash =
    (kospi?.changeRate ?? 0) <= -5 || (kosdaq?.changeRate ?? 0) <= -5;

  if (stance === 'bullish' && domesticCrash) {
    score -= 0.4;
    reasons.push(`국내장 급락이 커서 상승론은 장초반 재확인이 필요합니다.`);
  }

  let alignment: MarketAlignment;

  if (reasons.length === 0) {
    alignment = 'not-verifiable';
  } else if (score >= 1.5) {
    alignment = 'aligned';
  } else if (score >= 0) {
    alignment = 'partially-aligned';
  } else {
    alignment = 'conflicted';
  }

  return {
    alignment,
    alignmentScore: round(score, 2),
    reason: reasons.length > 0 ? reasons.join(' ') : '현재 수집된 시장지표로 직접 검증하기 어렵습니다.',
  };
}

function analyzePortfolioImpact(params: {
  post: CommunityPost;
  tags: EvidenceTag[];
  positions: Position[];
}): PortfolioImpact {
  const { post, tags, positions } = params;
  const directAffected = new Set<string>();
  const macroAffected = new Set<string>();
  const text = `${post.board} ${post.cleanTitle} ${post.bodyText} ${post.rawListText}`;
  const isNoisePost = isAnalysisNoisePost(post);

  if (isNoisePost) {
    return {
      affectedPositions: [],
      directAffectedPositions: [],
      macroAffectedPositions: [],
      impactSummary: '분석 노이즈로 판단되어 포트폴리오 영향 매핑에서 제외했습니다.',
    };
  }

  for (const position of positions) {
    const code = position.symbol?.replace(/\.KS$/, '') ?? null;
    const isSameNaverBoard =
      post.community === '네이버 종목토론방' &&
      (post.board === position.name || post.stockName === position.name || post.stockCode === code);
    const mentionsPosition =
      text.includes(position.name) ||
      (code !== null && text.includes(code)) ||
      (position.name === 'SK하이닉스' && containsAny(text, ['하이닉스', '닉스'])) ||
      (position.name === '삼성전자' && containsAny(text, ['삼성전자', '삼전'])) ||
      (position.name === '현대차' && containsAny(text, ['현대차', '테슬라'])) ||
      false;

    if (isSameNaverBoard || mentionsPosition) {
      directAffected.add(position.name);
    }

    if (
      tags.includes('semiconductor') &&
      ['semiconductor', 'semiconductor-etf'].includes(position.sectorTag)
    ) {
      if (containsAny(text, ['반도체', '마이크론', 'MU', '엔비디아', '젠슨황', 'HBM'])) {
        directAffected.add(position.name);
      } else {
        macroAffected.add(position.name);
      }
    }

    if (
      (tags.includes('oil') || tags.includes('geopolitics')) &&
      position.name === '현대차'
    ) {
      macroAffected.add(position.name);
    }

    if (
      (tags.includes('us-futures') || tags.includes('vix') || tags.includes('fx')) &&
      ['semiconductor', 'semiconductor-etf', 'platform-ai'].includes(position.sectorTag)
    ) {
      macroAffected.add(position.name);
    }

    if (tags.includes('semiconductor') && position.sectorTag === 'power-equipment') {
      macroAffected.add(position.name);
    }
  }

  const directAffectedPositions = Array.from(directAffected);
  const macroAffectedPositions = Array.from(macroAffected).filter((name) => {
    return !directAffected.has(name);
  });
  const affectedPositions = [...directAffectedPositions, ...macroAffectedPositions];

  let impactSummary = '보유 종목과 직접 연결성은 낮습니다.';

  if (directAffectedPositions.length > 0 || macroAffectedPositions.length > 0) {
    impactSummary = [
      directAffectedPositions.length > 0
        ? `직접 영향: ${directAffectedPositions.join(', ')}`
        : null,
      macroAffectedPositions.length > 0
        ? `간접 영향: ${macroAffectedPositions.join(', ')}`
        : null,
    ].filter(Boolean).join(' / ');
  }

  return {
    affectedPositions,
    directAffectedPositions,
    macroAffectedPositions,
    impactSummary,
  };
}

function calculateInfluenceScore(post: CommunityPost, evidenceScore: number, alignmentScore: number): number {
  const likes = post.likes ?? 0;
  const comments = post.commentCount ?? 0;
  const views = post.views ?? 0;

  const popularity = likes * 0.8 + comments * 0.6 + views / 1000;

  return round(popularity + evidenceScore * 2 + alignmentScore, 2);
}

function countStances(posts: AnalyzedPost[]): Record<Stance, number> {
  return {
    bullish: posts.filter((post) => post.stance === 'bullish').length,
    bearish: posts.filter((post) => post.stance === 'bearish').length,
    neutral: posts.filter((post) => post.stance === 'neutral').length,
    meme: posts.filter((post) => post.stance === 'meme').length,
  };
}

function countEvidenceTags(posts: AnalyzedPost[]): Record<EvidenceTag, number> {
  const allTags: EvidenceTag[] = [
    'macro',
    'fx',
    'oil',
    'us-futures',
    'vix',
    'geopolitics',
    'semiconductor',
    'naver',
    'chart',
    'news',
    'derivatives',
    'meme',
    'portfolio',
  ];

  const counts = Object.fromEntries(allTags.map((tag) => [tag, 0])) as Record<EvidenceTag, number>;

  for (const post of posts) {
    for (const tag of post.evidenceTags) {
      counts[tag] += 1;
    }
  }

  return counts;
}

function buildMarketRegime(items: MarketItem[]): MarketRegimeSummary {
  const kospi = getMarket(items, 'KOSPI');
  const kosdaq = getMarket(items, 'KOSDAQ');
  const nq = getMarket(items, 'NQ=F');
  const es = getMarket(items, 'ES=F');
  const sox = getMarket(items, '^SOX');
  const smh = getMarket(items, 'SMH');
  const tsm = getMarket(items, 'TSM');
  const asml = getMarket(items, 'ASML');
  const avgo = getMarket(items, 'AVGO');
  const vix = getMarket(items, 'VIX');
  const tenYear = getMarket(items, '^TNX');
  const dxy = getMarket(items, 'DX-Y.NYB');
  const usdkrw = getMarket(items, 'USD/KRW');
  const wti = getMarket(items, 'WTI Crude Oil Futures');
  const brent = getMarket(items, 'Brent Crude Oil Futures');
  const copper = getMarket(items, 'HG=F');
  const bitcoin = getMarket(items, 'BTC-USD');
  const hyg = getMarket(items, 'HYG');
  const lqd = getMarket(items, 'LQD');

  const bullishSignals: string[] = [];
  const bearishSignals: string[] = [];
  const mixedSignals: string[] = [];
  const keySignals: string[] = [];

  if ((nq?.changeRate ?? 0) > 0.7) {
    bullishSignals.push(`나스닥100 선물 ${formatChangeRate(nq)}로 기술주 반등 기대가 있습니다.`);
  }

  if ((es?.changeRate ?? 0) > 0.3) {
    bullishSignals.push(`S&P500 선물 ${formatChangeRate(es)}로 위험선호가 일부 회복 중입니다.`);
  }

  if ((vix?.changeRate ?? 0) < 0) {
    bullishSignals.push(`VIX ${formatChangeRate(vix)}로 공포지수는 완화 방향입니다.`);
  }

  if ((bitcoin?.changeRate ?? 0) > 1) {
    bullishSignals.push(`Bitcoin ${formatChangeRate(bitcoin)}로 야간 위험자산 심리가 개선됐습니다.`);
  }

  if ((hyg?.changeRate ?? 0) > (lqd?.changeRate ?? 0) && (hyg?.changeRate ?? 0) > 0) {
    bullishSignals.push(`HYG ${formatChangeRate(hyg)}, LQD ${formatChangeRate(lqd)}로 신용위험 선호가 나쁘지 않습니다.`);
  }

  if ((usdkrw?.changeRate ?? 0) < 0) {
    bullishSignals.push(`USD/KRW ${usdkrw?.price}, ${formatChangeRate(usdkrw)}로 환율 부담은 완화되었습니다.`);
  }

  if ((dxy?.changeRate ?? 0) > 0.3) {
    bearishSignals.push(`DXY ${formatChangeRate(dxy)}로 글로벌 달러 강세 부담이 있습니다.`);
  }

  if ((tenYear?.changeRate ?? 0) > 2) {
    bearishSignals.push(`미국 10년물 금리 ${formatChangeRate(tenYear)}로 성장주 할인율 부담이 커졌습니다.`);
  }

  if ((kospi?.changeRate ?? 0) <= -5) {
    bearishSignals.push(`KOSPI ${formatChangeRate(kospi)}로 국내장 충격은 매우 큽니다.`);
  }

  if ((kosdaq?.changeRate ?? 0) <= -5) {
    bearishSignals.push(`KOSDAQ ${formatChangeRate(kosdaq)}로 성장주/중소형주 충격이 큽니다.`);
  }

  if ((sox?.changeRate ?? 0) <= -5) {
    bearishSignals.push(`SOX 직전장 ${formatChangeRate(sox)}로 반도체 본진 충격이 아직 해소되지 않았습니다.`);
  }

  const globalSemiChanges = [sox, smh, tsm, asml, avgo]
    .filter((item): item is MarketItem => Boolean(item && item.changeRate !== null))
    .map((item) => item.changeRate as number);

  const globalSemiAverage =
    globalSemiChanges.length > 0
      ? round(globalSemiChanges.reduce((sum, value) => sum + value, 0) / globalSemiChanges.length, 2)
      : null;

  if (globalSemiAverage !== null && globalSemiAverage >= 1) {
    bullishSignals.push(`글로벌 반도체 묶음 평균 ${globalSemiAverage}%로 반도체 심리는 우호적입니다.`);
  } else if (globalSemiAverage !== null && globalSemiAverage <= -1) {
    bearishSignals.push(`글로벌 반도체 묶음 평균 ${globalSemiAverage}%로 반도체 심리는 부담입니다.`);
  }

  if ((wti?.changeRate ?? 0) > 0.5 || (brent?.changeRate ?? 0) > 0.5) {
    bearishSignals.push(`WTI ${formatChangeRate(wti)}, Brent ${formatChangeRate(brent)}로 유가 부담이 남아 있습니다.`);
  }

  if ((copper?.changeRate ?? 0) > 1) {
    bullishSignals.push(`구리 ${formatChangeRate(copper)}로 경기민감/전력기기 심리는 우호적입니다.`);
  }

  if (bullishSignals.length > 0 && bearishSignals.length > 0) {
    mixedSignals.push('단기 완화 신호와 구조적 하락 충격이 동시에 존재합니다.');
  }

  let regime: MarketRegime = 'unknown';
  let description = '시장 국면을 판단하기 어렵습니다.';

  const domesticCrash = (kospi?.changeRate ?? 0) <= -5 || (kosdaq?.changeRate ?? 0) <= -5;
  const relief = (nq?.changeRate ?? 0) > 0.7 || (vix?.changeRate ?? 0) < 0 || (usdkrw?.changeRate ?? 0) < 0;
  const semiconductorShock = (sox?.changeRate ?? 0) <= -5;

  if (domesticCrash && relief && semiconductorShock) {
    regime = 'panic-with-relief-signals';
    description = '국내장은 패닉성 급락을 맞았지만, 야간 미국 선물·VIX·환율은 일부 완화 신호를 보이는 혼합 국면입니다.';
  } else if (!domesticCrash && relief) {
    regime = 'risk-on-rebound';
    description = '위험선호 회복 신호가 우세한 반등 국면입니다.';
  } else if (domesticCrash && !relief) {
    regime = 'risk-off-continuation';
    description = '국내 급락 이후 외부 완화 신호가 부족한 위험회피 지속 국면입니다.';
  } else {
    regime = 'mixed';
    description = '상승/하락 신호가 혼재된 관망 국면입니다.';
  }

  const keyCandidates = [
    nq,
    es,
    sox,
    smh,
    tenYear,
    dxy,
    usdkrw,
    vix,
    bitcoin,
    copper,
  ];

  for (const item of keyCandidates) {
    if (!item || item.changeRate === null) continue;
    if (Math.abs(item.changeRate) < 0.3 && !['^TNX', 'KRW=X', '^VIX'].includes(item.symbol)) {
      continue;
    }
    keySignals.push(`${item.name}: ${formatMarketPrice(item)} (${formatChangeRate(item)})`);
  }

  return {
    regime,
    description,
    bullishSignals,
    bearishSignals,
    mixedSignals,
    keySignals,
  };
}

function findMarketItemForPosition(position: Position, marketItems: MarketItem[]): MarketItem | undefined {
  return marketItems.find((item) => {
    return item.symbol === position.symbol || item.name === position.name;
  });
}

function toExtendedSessionSymbol(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const match = symbol.match(/^(\d{6})\.KS$/);
  if (match) return `${match[1]}.OVER`;
  return symbol;
}

function findExtendedSessionMarketItem(
  target: { symbol: string | null; name: string },
  marketItems: MarketItem[],
): MarketItem | undefined {
  const extendedSymbol = toExtendedSessionSymbol(target.symbol);
  if (!extendedSymbol || extendedSymbol === target.symbol) return undefined;

  return marketItems.find((item) => {
    return item.group === 'korea_after_market' && item.symbol === extendedSymbol;
  });
}

function classifyNxtSignal(params: {
  dayChangeRate: number | null;
  nxtOnlyChangeRate: number | null;
}): NxtSignal['signal'] {
  const { dayChangeRate, nxtOnlyChangeRate } = params;

  if (nxtOnlyChangeRate !== null && nxtOnlyChangeRate <= -3) return 'weak';
  if (nxtOnlyChangeRate !== null && nxtOnlyChangeRate >= 5) return 'surge-no-chase';
  if (dayChangeRate !== null && dayChangeRate >= 10 && (nxtOnlyChangeRate ?? 0) >= 0) return 'strong';
  if (nxtOnlyChangeRate !== null && nxtOnlyChangeRate >= 1.5) return 'strong';
  return 'neutral';
}

function buildNxtSignals(positions: Position[], marketItems: MarketItem[]): NxtSignal[] {
  return positions
    .map((position) => {
      const marketItem = findExtendedSessionMarketItem(position, marketItems);
      if (!marketItem || marketItem.price === null) return null;

      const regularMarketItem = findMarketItemForPosition(position, marketItems);
      const regularClosePrice =
        regularMarketItem?.price !== null && regularMarketItem?.price !== undefined
          ? regularMarketItem.price
          : null;
      const nxtOnlyChange =
        regularClosePrice === null ? null : Math.round(marketItem.price - regularClosePrice);
      const nxtOnlyChangeRate =
        regularClosePrice === null || regularClosePrice === 0
          ? null
          : round(((marketItem.price - regularClosePrice) / regularClosePrice) * 100, 2);
      const lastSeenPrice = position.lastSeenPrice ?? null;
      const breakEvenPrice =
        position.breakEvenPrice ?? (position.buyAmount !== undefined && position.qty > 0 ? position.buyAmount / position.qty : null);
      const vsLastSeenChange = lastSeenPrice === null ? null : Math.round(marketItem.price - lastSeenPrice);
      const vsLastSeenChangeRate =
        lastSeenPrice === null || lastSeenPrice === 0
          ? null
          : round(((marketItem.price - lastSeenPrice) / lastSeenPrice) * 100, 2);
      const vsBreakEvenRate =
        breakEvenPrice === null || breakEvenPrice === 0
          ? null
          : round(((marketItem.price - breakEvenPrice) / breakEvenPrice) * 100, 2);

      return {
        name: position.name,
        symbol: position.symbol,
        sourceSymbol: marketItem.symbol,
        sourceGroup: marketItem.group,
        price: marketItem.price,
        change: marketItem.change,
        dayChangeRate: marketItem.changeRate,
        regularClosePrice,
        nxtOnlyChange,
        nxtOnlyChangeRate,
        lastSeenPrice,
        vsLastSeenChange,
        vsLastSeenChangeRate,
        breakEvenPrice: breakEvenPrice === null ? null : Math.round(breakEvenPrice),
        vsBreakEvenRate,
        signal: classifyNxtSignal({
          dayChangeRate: marketItem.changeRate,
          nxtOnlyChangeRate,
        }),
      } satisfies NxtSignal;
    })
    .filter((item): item is NxtSignal => item !== null);
}

function summarizeNxtSignals(signals: NxtSignal[]): string {
  if (signals.length === 0) return 'No validated NXT candidate prices are available for active positions.';

  const extended = signals.filter((item) => item.signal === 'surge-no-chase' || item.signal === 'strong');
  const weak = signals.filter((item) => item.signal === 'weak');
  const top = signals
    .slice()
    .sort((a, b) => Math.abs(b.nxtOnlyChangeRate ?? b.dayChangeRate ?? 0) - Math.abs(a.nxtOnlyChangeRate ?? a.dayChangeRate ?? 0))
    .slice(0, 3)
    .map((item) => `${item.name} ${formatWon(item.price)} (day ${item.dayChangeRate ?? 'N/A'}%, NXT-only ${item.nxtOnlyChangeRate ?? 'N/A'}%)`)
    .join(' / ');

  if (extended.length > 0 && weak.length === 0) {
    return `Held names stayed firm into NXT. Day-change includes the regular session, so use NXT-only change for chase risk. Top moves: ${top}.`;
  }

  if (weak.length > 0) {
    return `NXT-only weakness appeared in held names; tomorrow's first action is defense and relative-strength confirmation. Top moves: ${top}.`;
  }

  return `NXT-only moves are mixed/neutral. Use NXT as opening-price context, not as a standalone buy signal. Top moves: ${top}.`;
}

function getSectorWeights(position: Position): Record<string, number> {
  if (position.symbol === '000660.KS') return { semiconductor: 1 };
  if (position.symbol === '005930.KS') return { semiconductor: 0.75, electronics: 0.15, 'market-beta': 0.1 };
  if (position.symbol === '0167A0') return { semiconductor: 1 };
  if (position.symbol === '0117V0') return { 'power-equipment': 0.7, 'ai-infra': 0.2, semiconductor: 0.1 };
  if (position.symbol === '005380.KS') return { auto: 0.8, 'market-beta': 0.2 };
  return { [position.sectorTag]: 1 };
}

function buildWeightedSectorExposure(
  positions: PositionValuation[],
  originalPositions: Position[],
  totalEstimatedAsset: number,
): WeightedSectorExposure[] {
  const originalBySymbol = new Map(originalPositions.map((position) => [position.symbol ?? position.name, position]));
  const exposure: Record<string, number> = {};

  for (const position of positions) {
    const original =
      originalBySymbol.get(position.symbol ?? position.name) ??
      ({
        name: position.name,
        symbol: position.symbol,
        qty: position.qty,
        sellableQty: position.sellableQty,
        buyAmount: position.buyAmount,
        breakEvenPrice: position.breakEvenPrice ?? undefined,
        lastSeenPrice: position.currentPrice ?? undefined,
        evalAmount: position.evalAmount,
        pnlRate: position.pnlRate ?? 0,
        sectorTag: position.sectorTag,
      } satisfies Position);
    const weights = getSectorWeights(original);

    for (const [sector, weight] of Object.entries(weights)) {
      exposure[sector] = (exposure[sector] ?? 0) + position.evalAmount * weight;
    }
  }

  return Object.entries(exposure)
    .map(([sector, amount]) => ({
      sector,
      amount: Math.round(amount),
      rate: totalEstimatedAsset > 0 ? round((amount / totalEstimatedAsset) * 100, 2) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function buildConcentrationWarnings(weightedSectorExposure: WeightedSectorExposure[]): string[] {
  const warnings: string[] = [];
  const semiconductor = weightedSectorExposure.find((item) => item.sector === 'semiconductor');
  const topSector = weightedSectorExposure[0];

  if (semiconductor && semiconductor.rate >= 45) {
    warnings.push(
      `Semiconductor effective exposure is ${semiconductor.rate}%. Keep the sector view positive, but avoid adding duplicate semiconductor beta on strength.`,
    );
  }

  if (topSector && topSector.rate >= 50) {
    warnings.push(
      `Top effective sector is ${topSector.sector} at ${topSector.rate}%. New buys should either be pullback-only or diversify the risk factor.`,
    );
  }

  return warnings;
}

function buildPortfolioSummary(
  portfolio: ReportInput['portfolio'],
  marketItems: MarketItem[],
): AnalysisOutput['portfolioSummary'] {
  const positions: PositionValuation[] = portfolio.positions.map((position) => {
    const marketItem = findMarketItemForPosition(position, marketItems);
    const currentPrice = marketItem?.price ?? position.lastSeenPrice ?? null;
    const evalAmount =
      currentPrice !== null ? Math.round(currentPrice * position.qty) : position.evalAmount;
    const buyAmount = position.buyAmount ?? Math.round(position.evalAmount / (1 + position.pnlRate / 100));
    const pnlAmount = evalAmount - buyAmount;
    const pnlRate = buyAmount > 0 ? round((pnlAmount / buyAmount) * 100, 2) : null;
    const lastSeenPrice = position.lastSeenPrice ?? null;
    const marketVsLastSeenRate =
      marketItem?.price !== null && marketItem?.price !== undefined && lastSeenPrice !== null && lastSeenPrice > 0
        ? round(((marketItem.price - lastSeenPrice) / lastSeenPrice) * 100, 2)
        : null;
    const isInputPriceStale = marketVsLastSeenRate !== null && Math.abs(marketVsLastSeenRate) >= 3;
    const priceSource =
      marketItem?.source === 'naver-finance-page'
        ? '네이버 금융 현재가'
        : marketItem
          ? '시장 수집가'
          : position.lastSeenPrice
            ? '최근 입력 현재가'
            : '저장 평가금액';

    return {
      name: position.name,
      symbol: position.symbol,
      qty: position.qty,
      sellableQty: position.sellableQty ?? position.qty,
      buyAmount,
      breakEvenPrice: position.breakEvenPrice ?? (position.qty > 0 ? Math.round(buyAmount / position.qty) : null),
      lastSeenPrice,
      currentPrice,
      priceSource,
      marketVsLastSeenRate,
      isInputPriceStale,
      evalAmount,
      pnlAmount,
      pnlRate,
      sectorTag: position.sectorTag,
    };
  });

  const totalStockEvalAmount = positions.reduce((sum, position) => sum + position.evalAmount, 0);
  const totalBuyAmount = positions.reduce((sum, position) => sum + position.buyAmount, 0);
  const totalPnlAmount = totalStockEvalAmount - totalBuyAmount;
  const totalPnlRate = totalBuyAmount > 0 ? round((totalPnlAmount / totalBuyAmount) * 100, 2) : null;
  const totalEstimatedAsset = totalStockEvalAmount + portfolio.cashEstimated;

  const sectorExposure: Record<string, number> = {};

  for (const position of positions) {
    sectorExposure[position.sectorTag] =
      (sectorExposure[position.sectorTag] ?? 0) + position.evalAmount;
  }

  const sectorExposureRate: Record<string, number> = {};

  for (const [sector, amount] of Object.entries(sectorExposure)) {
    sectorExposureRate[sector] = round((amount / totalEstimatedAsset) * 100, 2);
  }

  const weightedSectorExposure = buildWeightedSectorExposure(
    positions,
    portfolio.positions,
    totalEstimatedAsset,
  );
  const concentrationWarnings = buildConcentrationWarnings(weightedSectorExposure);
  const priceWarnings = positions
    .filter((position) => position.isInputPriceStale)
    .map((position) => {
      return `${position.name}: collected price differs from portfolio input by ${position.marketVsLastSeenRate}%. Refresh portfolio snapshot before sizing orders.`;
    });

  return {
    totalStockEvalAmount,
    totalBuyAmount,
    totalPnlAmount,
    totalPnlRate,
    cashEstimated: portfolio.cashEstimated,
    totalEstimatedAsset,
    sectorExposure,
    sectorExposureRate,
    weightedSectorExposure,
    concentrationWarnings,
    priceWarnings,
    positions,
  };
}

function analyzeNewsSignals(news: NewsItem[], positions: Position[]): NewsSignal {
  const bullishKeywords = [
    '상승',
    '급등',
    '반등',
    '호재',
    '수주',
    '증설',
    '협력',
    '실적',
    '목표가',
    '상향',
    '매수',
    'AI',
    'HBM',
  ];
  const bearishKeywords = [
    '하락',
    '급락',
    '공포',
    '손실',
    '부진',
    '하향',
    '매도',
    '리스크',
    '소송',
    '규제',
    '전쟁',
    '관세',
    '적자',
  ];
  const byPosition = Object.fromEntries(
    positions.map((position) => [
      position.name,
      {
        bullish: 0,
        bearish: 0,
        neutral: 0,
      },
    ]),
  ) as NewsSignal['byPosition'];
  const topBearish: NewsItem[] = [];
  const topBullish: NewsItem[] = [];
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  for (const item of news) {
    const text = `${item.title} ${item.summary ?? ''}`;
    const bullishScore = bullishKeywords.filter((keyword) => text.includes(keyword)).length;
    const bearishScore = bearishKeywords.filter((keyword) => text.includes(keyword)).length;
    const bucket =
      bullishScore > bearishScore ? 'bullish' : bearishScore > bullishScore ? 'bearish' : 'neutral';

    if (bucket === 'bullish') {
      bullish += 1;
      if (topBullish.length < 3) topBullish.push(item);
    } else if (bucket === 'bearish') {
      bearish += 1;
      if (topBearish.length < 3) topBearish.push(item);
    } else {
      neutral += 1;
    }

    if (!byPosition[item.stockName]) {
      byPosition[item.stockName] = {
        bullish: 0,
        bearish: 0,
        neutral: 0,
      };
    }
    byPosition[item.stockName][bucket] += 1;
  }

  return {
    bullish,
    bearish,
    neutral,
    topBearish,
    topBullish,
    byPosition,
  };
}

function selectRepresentativeNews(news: NewsItem[], maxPerPosition = 2): NewsItem[] {
  const selected: NewsItem[] = [];
  const counts = new Map<string, number>();

  for (const item of news) {
    const count = counts.get(item.stockName) ?? 0;
    if (count >= maxPerPosition) continue;

    selected.push(item);
    counts.set(item.stockName, count + 1);
  }

  return selected;
}

function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString()}원`;
}

function roundPriceLevel(value: number): number {
  const unit = value >= 1_000_000 ? 10_000 : value >= 100_000 ? 1_000 : value >= 10_000 ? 100 : 10;
  return Math.round(value / unit) * unit;
}

function buildOrderRecommendations(params: {
  portfolioSummary: AnalysisOutput['portfolioSummary'];
  marketItems: MarketItem[];
  nxtSignals: NxtSignal[];
}): OrderRecommendation[] {
  const { portfolioSummary, marketItems, nxtSignals } = params;
  const semiconductorExposure =
    portfolioSummary.weightedSectorExposure.find((item) => item.sector === 'semiconductor')?.rate ?? 0;
  const kospi200Night = marketItems.find((item) => item.group === 'korea_night_futures');
  const nqFuture = getMarket(marketItems, 'NQ=F');
  const sox = getMarket(marketItems, '^SOX');
  const marketSupportCount = [
    (kospi200Night?.changeRate ?? 0) > 0,
    (nqFuture?.changeRate ?? 0) > 0.3,
    (sox?.changeRate ?? 0) > 1,
  ].filter(Boolean).length;
  const marketSupportive = marketSupportCount >= 2;

  return portfolioSummary.positions.map((position) => {
    const marketItem = marketItems.find((item) => item.symbol === position.symbol || item.name === position.name);
    const changeRate = marketItem?.changeRate ?? null;
    const currentPrice = position.currentPrice;
    const isSemiconductorLike = ['semiconductor', 'semiconductor-etf'].includes(position.sectorTag);
    const isEtf = position.symbol !== null && !position.symbol.endsWith('.KS');
    const nxtSignal = nxtSignals.find((item) => item.symbol === position.symbol || item.name === position.name);
    const nxtOnlyChangeRate = nxtSignal?.nxtOnlyChangeRate ?? null;
    const dayChangeRate = nxtSignal?.dayChangeRate ?? changeRate;
    const isExtended = changeRate !== null && changeRate >= 5;
    const isVeryExtended = changeRate !== null && changeRate >= 10;
    const isNxtOnlyExtended = nxtOnlyChangeRate !== null && nxtOnlyChangeRate >= 5;
    const stayedFirmInNxt = nxtOnlyChangeRate !== null && nxtOnlyChangeRate >= 0;
    const duplicateSemiconductor = isSemiconductorLike && semiconductorExposure >= 45;
    const suggestedQty = Math.max(1, Math.floor(position.sellableQty * 0.33));
    const canTrimPartially = position.sellableQty >= 3;

    if (currentPrice === null) {
      return {
        name: position.name,
        symbol: position.symbol,
        stance: 'watch',
        actionSignal: 'NO_BUY',
        buy1: null,
        buy2: null,
        noChaseAbove: null,
        trimAbove: null,
        suggestedQty,
        signalBasis: 'No live price',
        reason: 'No reliable current price is available, so this position should not generate live order prices.',
      };
    }

    const pullbackPct =
      isNxtOnlyExtended ? 0.05 : isEtf && duplicateSemiconductor ? 0.04 : stayedFirmInNxt ? 0.025 : 0.03;
    const deeperPullbackPct =
      isNxtOnlyExtended ? 0.08 : isEtf && duplicateSemiconductor ? 0.07 : stayedFirmInNxt ? 0.05 : 0.06;
    const buy1 = roundPriceLevel(currentPrice * (1 - pullbackPct));
    const buy2 = roundPriceLevel(currentPrice * (1 - deeperPullbackPct));
    const noChaseAbove = roundPriceLevel(currentPrice * (isNxtOnlyExtended ? 1.0 : isExtended ? 1.005 : 1.02));
    const trimAbove =
      canTrimPartially &&
      (duplicateSemiconductor || isVeryExtended || (position.pnlRate !== null && position.pnlRate > 3))
        ? roundPriceLevel(currentPrice * 1.01)
        : null;

    if (isEtf) {
      if (duplicateSemiconductor && isVeryExtended && canTrimPartially) {
        return {
          name: position.name,
          symbol: position.symbol,
          stance: 'trim-on-strength',
          actionSignal: 'TRIM',
          buy1,
          buy2,
          noChaseAbove,
          trimAbove,
          suggestedQty,
          signalBasis: `ETF: NXT excluded, day ${dayChangeRate ?? 'N/A'}%, semiconductor exposure ${semiconductorExposure}%`,
          reason:
            'ETF is not NXT-traded. Because semiconductor exposure is already high and the ETF is extended in the regular/latest price, use strength to reduce overlap rather than add.',
        };
      }

      if (duplicateSemiconductor) {
        return {
          name: position.name,
          symbol: position.symbol,
          stance: 'no-chase',
          actionSignal: 'NO_BUY',
          buy1,
          buy2,
          noChaseAbove,
          trimAbove,
          suggestedQty,
          signalBasis: `ETF: NXT excluded, duplicate semiconductor exposure ${semiconductorExposure}%`,
          reason:
            'ETF is not NXT-traded and semiconductor overlap is already high. Treat this as no-buy unless it reaches a controlled pullback level.',
        };
      }

      return {
        name: position.name,
        symbol: position.symbol,
        stance: marketSupportive && !isExtended ? 'pullback-buy' : 'hold',
        actionSignal: marketSupportive && !isExtended ? 'WATCH_BUY' : 'HOLD',
        buy1,
        buy2,
        noChaseAbove,
        trimAbove,
        suggestedQty,
        signalBasis: `ETF: NXT excluded, market support ${marketSupportCount}/3, day ${dayChangeRate ?? 'N/A'}%`,
        reason:
          'ETF is judged from regular/latest price plus sector and market proxies. Use staged pullback only; do not interpret it as an NXT signal.',
      };
    }

    if (isNxtOnlyExtended) {
      return {
        name: position.name,
        symbol: position.symbol,
        stance: 'no-chase',
        actionSignal: 'NO_BUY',
        buy1,
        buy2,
        noChaseAbove,
        trimAbove,
        suggestedQty,
        signalBasis: `NXT-only ${nxtOnlyChangeRate}%, day ${dayChangeRate ?? 'N/A'}%`,
        reason:
          'NXT-only move is already extended. Register it as strength, but do not buy at the open unless price returns to the pullback zone.',
      };
    }

    if (marketSupportive && stayedFirmInNxt && position.pnlRate !== null && position.pnlRate < -5) {
      return {
        name: position.name,
        symbol: position.symbol,
        stance: 'pullback-buy',
        actionSignal: 'BUY_1',
        buy1,
        buy2,
        noChaseAbove,
        trimAbove,
        suggestedQty,
        signalBasis: `NXT-only ${nxtOnlyChangeRate ?? 'N/A'}%, day ${dayChangeRate ?? 'N/A'}%, market support ${marketSupportCount}/3`,
        reason:
          'The position is still below break-even, but NXT did not reject the regular-session move and market proxies are supportive. Only a first staged pullback order is allowed.',
      };
    }

    if (marketSupportive && stayedFirmInNxt) {
      return {
        name: position.name,
        symbol: position.symbol,
        stance: 'pullback-buy',
        actionSignal: 'WATCH_BUY',
        buy1,
        buy2,
        noChaseAbove,
        trimAbove,
        suggestedQty,
        signalBasis: `NXT-only ${nxtOnlyChangeRate ?? 'N/A'}%, day ${dayChangeRate ?? 'N/A'}%, market support ${marketSupportCount}/3`,
        reason:
          'Strength is confirmed but not enough for market chasing. Watch for a pullback into buy1 before adding.',
      };
    }

    if (duplicateSemiconductor && isExtended && canTrimPartially) {
      return {
        name: position.name,
        symbol: position.symbol,
        stance: 'trim-on-strength',
        actionSignal: 'TRIM',
        buy1,
        buy2,
        noChaseAbove,
        trimAbove,
        suggestedQty,
        signalBasis: `Day ${dayChangeRate ?? 'N/A'}%, semiconductor exposure ${semiconductorExposure}%`,
        reason:
          'Semiconductor exposure is already high and this position is moving strongly today. Add only on pullback; use strength for partial trim if risk needs to come down.',
      };
    }

    if (isExtended) {
      return {
        name: position.name,
        symbol: position.symbol,
        stance: 'no-chase',
        actionSignal: 'NO_BUY',
        buy1,
        buy2,
        noChaseAbove,
        trimAbove,
        suggestedQty,
        signalBasis: `Day ${dayChangeRate ?? 'N/A'}%`,
        reason:
          'The position is extended intraday. Avoid market chasing; use staged pullback bids if exposure still needs to increase.',
      };
    }

    return {
      name: position.name,
      symbol: position.symbol,
      stance: position.pnlRate !== null && position.pnlRate < -5 ? 'pullback-buy' : 'hold',
      actionSignal: position.pnlRate !== null && position.pnlRate < -5 && marketSupportive ? 'BUY_2' : 'HOLD',
      buy1,
      buy2,
      noChaseAbove,
      trimAbove,
      suggestedQty,
      signalBasis: `Market support ${marketSupportCount}/3, day ${dayChangeRate ?? 'N/A'}%`,
      reason:
        position.pnlRate !== null && position.pnlRate < -5
          ? 'Loss position can be averaged only on controlled pullback, not into a spike.'
          : 'Hold bias. New orders should be price disciplined unless the position has a separate thesis update.',
    };
  });
}

function buildGuardrails(portfolioSummary: AnalysisOutput['portfolioSummary']): string[] {
  return [
    'Do not reduce sector overlap by panic-selling into a sharp down move; trim duplicate exposure on rebound days.',
    'For thematic ETFs, change exposure in thirds rather than all at once.',
    'After a missed limit order, do not rebuy at market to repair regret; refresh buy levels from current price.',
    'If a position is already held, prefer averaging only at predefined pullback levels.',
    ...portfolioSummary.concentrationWarnings,
  ];
}

function buildDecisionReviews(params: {
  tradeEvents: TradeEvent[];
  portfolioSummary: AnalysisOutput['portfolioSummary'];
  marketItems: MarketItem[];
}): DecisionReview[] {
  const { tradeEvents, portfolioSummary, marketItems } = params;

  return tradeEvents.slice(-8).map((event) => {
    const position = portfolioSummary.positions.find((item) => {
      return item.symbol === event.symbol || item.name === event.name;
    });
    const marketItem = marketItems.find((item) => {
      return item.symbol === event.symbol || item.name === event.name;
    });
    const nxtItem = findExtendedSessionMarketItem(event, marketItems);
    const currentPrice = marketItem?.price ?? position?.currentPrice ?? null;
    const nxtPrice = nxtItem?.price ?? null;
    const qty = event.qty ?? 0;
    const referencePrice = event.price ?? event.referencePrice ?? null;
    const missingFields = [
      currentPrice === null ? 'current market price' : null,
      referencePrice === null ? 'execution/reference price' : null,
      qty <= 0 ? 'quantity' : null,
    ].filter((value): value is string => Boolean(value));
    const opportunityPnl =
      event.action !== 'buy' && currentPrice !== null && referencePrice !== null && qty > 0
        ? Math.round((currentPrice - referencePrice) * qty)
        : null;
    const nxtOpportunityPnl =
      event.action !== 'buy' && nxtPrice !== null && referencePrice !== null && qty > 0
        ? Math.round((nxtPrice - referencePrice) * qty)
        : null;
    const absOpportunity = opportunityPnl === null ? null : Math.abs(opportunityPnl);
    const verdict =
      opportunityPnl === null
        ? `Review only: cannot calculate opportunity PnL because ${missingFields.join(', ')} is missing.`
        : absOpportunity !== null && absOpportunity <= 10000
          ? `Small outcome gap (${opportunityPnl.toLocaleString()} KRW). The process matters more than the money result.`
          : opportunityPnl > 0
            ? `Early reduction cost about ${opportunityPnl.toLocaleString()} KRW versus current price.`
            : `Reduction avoided about ${Math.abs(opportunityPnl).toLocaleString()} KRW versus current price.`;
    const fallbackNextRule =
      opportunityPnl === null
        ? 'For every sell/trim event, record executed qty and execution price so the next report can calculate opportunity cost or avoided loss.'
        : 'When reducing overlap, use rebound-day staged trims first; use loss cuts only when the thesis is broken.';

    return {
      event,
      currentPrice,
      opportunityPnl,
      nxtPrice,
      nxtOpportunityPnl,
      verdict,
      nextRule:
        event.lesson ??
        fallbackNextRule,
    };
  });
}

function buildStrategy(params: {
  mode: string;
  marketRegime: MarketRegimeSummary;
  marketItems: MarketItem[];
  analyzedPosts: AnalyzedPost[];
  portfolio: ReportInput['portfolio'];
  portfolioSummary: AnalysisOutput['portfolioSummary'];
  nxtSignals: NxtSignal[];
  news: NewsItem[];
  tradeEvents: TradeEvent[];
}) {
  const { mode, marketRegime, marketItems, analyzedPosts, portfolio, portfolioSummary, nxtSignals, news, tradeEvents } = params;
  const directionalPosts = analyzedPosts.filter((post) => {
    return post.stance === 'bullish' || post.stance === 'bearish';
  });

  const highConfidenceBullish = analyzedPosts.filter((post) => {
    return (
      post.stance === 'bullish' &&
      post.evidenceQualityScore >= 3 &&
      post.marketAlignment !== 'conflicted'
    );
  });

  const highConfidenceBearish = analyzedPosts.filter((post) => {
    return (
      post.stance === 'bearish' &&
      post.evidenceQualityScore >= 3 &&
      post.marketAlignment !== 'conflicted'
    );
  });

  const directBullishByPosition = new Map<string, number>();
  const directBearishByPosition = new Map<string, number>();

  for (const post of directionalPosts) {
    for (const positionName of post.directAffectedPositions) {
      const map = post.stance === 'bullish' ? directBullishByPosition : directBearishByPosition;
      map.set(positionName, (map.get(positionName) ?? 0) + 1);
    }
  }

  const semiconductorBullish = directionalPosts.filter((post) => {
    return post.stance === 'bullish' && post.evidenceTags.includes('semiconductor');
  }).length;

  const semiconductorBearish = directionalPosts.filter((post) => {
    return post.stance === 'bearish' && post.evidenceTags.includes('semiconductor');
  }).length;

  const geopoliticsBearish = directionalPosts.filter((post) => {
    return post.stance === 'bearish' && post.evidenceTags.includes('geopolitics');
  }).length;

  const autoBullish = directBullishByPosition.get('현대차') ?? 0;
  const newsSignal = analyzeNewsSignals(news, portfolio.positions);
  const nxtSummaryText = summarizeNxtSignals(nxtSignals);
  const marketSupportChecks = [
    { label: 'Nasdaq futures', ok: (getMarket(marketItems, 'NQ=F')?.changeRate ?? 0) > 0.3 },
    { label: 'SOX', ok: (getMarket(marketItems, '^SOX')?.changeRate ?? 0) > 1 },
    {
      label: 'KOSPI200 night future',
      ok: (marketItems.find((item) => item.group === 'korea_night_futures')?.changeRate ?? 0) > 0,
    },
    { label: 'VIX', ok: (getMarket(marketItems, 'VIX')?.changeRate ?? 0) <= 0 },
    { label: 'USD/KRW', ok: (getMarket(marketItems, 'USD/KRW')?.changeRate ?? 0) <= 0.2 },
  ];
  const marketSupportScore = marketSupportChecks.filter((item) => item.ok).length;
  const marketSupportText = `시장 우호 점수: ${marketSupportScore}/${marketSupportChecks.length} (${marketSupportChecks
    .map((item) => `${item.label} ${item.ok ? 'OK' : 'watch'}`)
    .join(', ')}).`;
  const orderRecommendations = buildOrderRecommendations({
    portfolioSummary,
    marketItems,
    nxtSignals,
  });
  const buyCandidates = orderRecommendations.filter((item) => ['BUY_1', 'BUY_2', 'WATCH_BUY'].includes(item.actionSignal));
  const trimCandidates = orderRecommendations.filter((item) => item.actionSignal === 'TRIM');
  const noBuyCandidates = orderRecommendations.filter((item) => item.actionSignal === 'NO_BUY');
  const actionSummaryText =
    `Action map: buy/watch ${buyCandidates.length === 0 ? 'none' : buyCandidates.map((item) => `${item.name} ${item.actionSignal}`).join(' / ')}, ` +
    `trim ${trimCandidates.length === 0 ? 'none' : trimCandidates.map((item) => item.name).join(' / ')}, ` +
    `no-buy ${noBuyCandidates.length === 0 ? 'none' : noBuyCandidates.map((item) => item.name).join(' / ')}.`;
  const actionItems = [
    actionSummaryText,
    'Action semantics: BUY_1/BUY_2 are staged pullback orders, WATCH_BUY is a candidate only, and TRIM is partial reduction into strength.',
    marketSupportText,
    nxtSummaryText,
    portfolioSummary.priceWarnings.length > 0
      ? `Refresh portfolio input before order sizing: ${portfolioSummary.priceWarnings.slice(0, 3).join(' / ')}`
      : 'Portfolio input prices are close enough to collected prices for sizing context.',
    'For semiconductor overlap, trim or add only in staged units; do not add ETF beta into a NXT spike.',
  ];
  const newsSummaryText =
    news.length > 0
      ? `포트폴리오 종목 뉴스는 ${news.length}건 수집됐고, 뉴스 방향성은 긍정 ${newsSignal.bullish}건, 부정 ${newsSignal.bearish}건, 중립 ${newsSignal.neutral}건입니다. 상위 뉴스는 ${news
          .slice(0, 3)
          .map((item) => `${item.stockName}: ${item.title}`)
          .join(' / ')}입니다.`
      : '포트폴리오 종목 뉴스 수집 결과는 없습니다.';
  const directSignalSummary = portfolio.positions
    .map((position) => {
      const bullish = directBullishByPosition.get(position.name) ?? 0;
      const bearish = directBearishByPosition.get(position.name) ?? 0;
      return `${position.name} +${bullish}/-${bearish}`;
    })
    .join(', ');
  const afterMarketItems = marketItems.filter((item) => item.group === 'korea_after_market');
  const nightFuturesItems = marketItems.filter((item) => item.group === 'korea_night_futures');
  const afterMarketValidItems = afterMarketItems.filter((item) => item.price !== null && item.changeRate !== null);
  const nightFuturesValidItems = nightFuturesItems.filter((item) => item.price !== null && item.changeRate !== null);
  const afterMarketAverageChange =
    afterMarketValidItems.length > 0
      ? round(
          afterMarketValidItems.reduce((sum, item) => sum + (item.changeRate ?? 0), 0) /
            afterMarketValidItems.length,
          2,
        )
      : null;
  const nightFuturesAverageChange =
    nightFuturesValidItems.length > 0
      ? round(
          nightFuturesValidItems.reduce((sum, item) => sum + (item.changeRate ?? 0), 0) /
            nightFuturesValidItems.length,
          2,
        )
      : null;
  const afterMarketSignalText =
    afterMarketValidItems.length > 0
      ? `넥장/시간외 후보 평균 등락률은 ${afterMarketAverageChange}%이고, 주요 값은 ${afterMarketValidItems
          .slice(0, 4)
          .map((item) => `${item.name} ${formatMarketPrice(item)} (${formatChangeRate(item)})`)
          .join(' / ')}입니다.`
      : '넥장/시간외 후보 가격은 아직 충분히 수집되지 않았습니다.';
  const nightFuturesSignalText =
    nightFuturesValidItems.length > 0
      ? `야간선물은 ${nightFuturesValidItems
          .map((item) => `${item.name} ${formatMarketPrice(item)} (${formatChangeRate(item)})`)
          .join(' / ')}입니다.`
      : '야간선물 직접값은 아직 충분히 수집되지 않았습니다.';
  const extendedSessionBullish =
    (afterMarketAverageChange ?? 0) > 0 && (nightFuturesAverageChange ?? 0) > 0;
  const extendedSessionWeak =
    (afterMarketAverageChange ?? 0) < 0 || (nightFuturesAverageChange ?? 0) < 0;

  let headline = '내일 장초반 추격매수 금지, 보유 중심 대응이 우선입니다.';

  if (
    marketRegime.regime === 'panic-with-relief-signals' &&
    highConfidenceBullish.length > highConfidenceBearish.length
  ) {
    headline =
      '단기 완화 신호는 있지만, 오늘 급락 충격이 커서 내일은 “확인 후 대응”이 맞습니다.';
  }

  if (marketRegime.regime === 'risk-off-continuation') {
    headline = '위험회피 지속 가능성이 높으므로 추가매수보다 현금 방어가 우선입니다.';
  }

  if (
    marketRegime.regime === 'mixed' &&
    semiconductorBullish >= 3 &&
    highConfidenceBullish.length > highConfidenceBearish.length
  ) {
    headline = '반도체 반등 신호는 강하지만, 국내 급락 충격 때문에 장초 확인 후 보유 대응이 우선입니다.';
  }

  if (geopoliticsBearish >= 2 && highConfidenceBearish.length >= highConfidenceBullish.length) {
    headline = '지정학 경계가 우세하므로 반등 추격보다 리스크 관리가 우선입니다.';
  }

  if (mode === 'morning') {
    headline =
      marketRegime.regime === 'risk-on-rebound' && extendedSessionBullish
        ? '아침 전략: 야간선물과 넥장 후보까지 우호적이지만, 시초가 반영 여부 확인 후 대응합니다.'
        : marketRegime.regime === 'risk-on-rebound'
          ? '아침 전략: 미국장 반등은 우호적이지만, 장초 NXT/시초가 반영 여부 확인 후 대응합니다.'
        : `아침 전략: ${headline}`;
  }

  if (mode === 'midday') {
    headline =
      marketRegime.regime === 'risk-on-rebound'
        ? '점심 전략: 오전장 반등은 우호적이지만, 오후장 추격매수보다 13:30 이후 수급 재확인이 우선입니다.'
        : `점심 전략: ${headline}`;
  }

  if (mode === 'preclose') {
    headline =
      marketRegime.regime === 'risk-on-rebound'
        ? '장마감 전략: 우호 신호는 인정하되, 동시호가는 소액만 허용하고 추격 상단을 넘기지 않습니다.'
        : `장마감 전략: ${headline}`;
  }

  if (mode === 'evening') {
    headline =
      marketRegime.regime === 'risk-off-continuation' || extendedSessionWeak
        ? '저녁 전략: 내일 장초 방어를 우선하고, 야간선물/NXT 되돌림 확인 전 추가매수는 보류합니다.'
        : extendedSessionBullish
          ? '저녁 전략: 야간선물과 넥장 후보가 우호적이므로 내일 장초 추격보다 눌림 확인 후 보유 우위로 대응합니다.'
          : `저녁 전략: ${headline}`;
  }

  const rationale = [
    marketRegime.description,
    `근거 품질이 중간 이상인 상승 주장은 ${highConfidenceBullish.length}개, 하락 경계 주장은 ${highConfidenceBearish.length}개입니다.`,
    `직접 영향 신호는 ${directSignalSummary}입니다.`,
    `반도체 관련 상승 신호는 ${semiconductorBullish}개, 반도체 하락 경계 신호는 ${semiconductorBearish}개입니다.`,
    `지정학 하락 경계 신호는 ${geopoliticsBearish}개입니다.`,
    `현대차 직접 상승 신호는 ${autoBullish}개입니다.`,
    newsSummaryText,
    nxtSummaryText,
    newsSignal.topBearish.length > 0
      ? `주의 뉴스는 ${newsSignal.topBearish.map((item) => `${item.stockName}: ${item.title}`).join(' / ')}입니다.`
      : '뉴스 기준의 뚜렷한 부정 신호는 제한적입니다.',
    mode === 'evening' || mode === 'morning'
      ? `${afterMarketSignalText} ${nightFuturesSignalText}`
      : '야간선물과 넥장/시간외 후보 가격은 장마감 이후와 다음날 장초 판단에서 더 높은 비중으로 반영합니다.',
    mode === 'morning'
      ? '아침 모드는 미국장 종가와 NXT/장전 반영 여부를 우선 확인해 오늘 장중 대응을 판단합니다.'
      : mode === 'midday'
        ? '점심 모드는 오전장 결과, 보유 종목 상대강도, 환율·금리·업종 proxy를 보고 오후장 대응을 판단합니다.'
      : mode === 'preclose'
        ? '장마감 모드는 정규장 종가와 동시호가 체결 가능성을 기준으로 소액 추가, 미체결 허용, 익절/축소 여부를 판단합니다.'
      : mode === 'evening'
        ? '저녁 모드는 NXT장, 야간선물, 미국 선물 초반 흐름을 우선 확인해 내일 전략을 준비합니다.'
        : '일일 모드는 커뮤니티, 시장지표, 뉴스의 통합 흐름을 점검합니다.',
    '커뮤니티의 반등 기대는 나스닥 선물·VIX·환율 완화와 일부 부합하지만, 국내장 급락과 유가/지정학 변수는 아직 부담입니다.',
    mode === 'midday'
      ? '따라서 오후장 전략은 오전장 고점 추격이 아니라 13:30 이후 수급과 가격 유지 여부를 확인하는 조건부 대응입니다.'
      : mode === 'preclose'
        ? '따라서 장마감 전략은 우호 신호를 반영하되, 동시호가 추격 상단을 먼저 정하고 그 안에서만 소액 체결을 허용합니다.'
      : '따라서 내일 전략은 상승 확신이 아니라 장초반 가격 재확인 이후의 조건부 대응입니다.',
  ];

  function buildPositionSignalReason(positionName: string): string {
    const bullish = directBullishByPosition.get(positionName) ?? 0;
    const bearish = directBearishByPosition.get(positionName) ?? 0;

    if (bullish === 0 && bearish === 0) {
      return '해당 종목에 대한 직접 커뮤니티 신호는 아직 뚜렷하지 않습니다.';
    }

    return `직접 커뮤니티 신호는 상승 ${bullish}개, 하락 ${bearish}개입니다.`;
  }

  function buildNewsSignalReason(positionName: string): string {
    const signal = newsSignal.byPosition[positionName];

    if (!signal || (signal.bullish === 0 && signal.bearish === 0 && signal.neutral === 0)) {
      return '관련 종목 뉴스 신호는 아직 뚜렷하지 않습니다.';
    }

    return `종목 뉴스 신호는 긍정 ${signal.bullish}건, 부정 ${signal.bearish}건, 중립 ${signal.neutral}건입니다.`;
  }

  function getPositionReference(position: Position): {
    price: number | null;
    source: string;
    changeRate: number | null;
  } {
    const marketItem = marketItems.find((item) => {
      return item.symbol === position.symbol || item.name === position.name;
    });

    if (marketItem?.price !== null && marketItem?.price !== undefined) {
      return {
        price: marketItem.price,
        source: marketItem.source === 'naver-finance-page' ? '네이버 금융 현재가' : '시장 수집가',
        changeRate: marketItem.changeRate,
      };
    }

    if (position.qty > 0 && position.evalAmount > 0) {
      return {
        price: position.evalAmount / position.qty,
        source: '포트폴리오 평가단가',
        changeRate: null,
      };
    }

    return {
      price: null,
      source: '가격 미확인',
      changeRate: null,
    };
  }

  function buildDynamicTrigger(position: Position, params?: { supportPct?: number; addCaution?: string }): string {
    const supportPct = params?.supportPct ?? 0.03;
    const reference = getPositionReference(position);

    if (reference.price === null) {
      return `최신 가격을 확인한 뒤 대응합니다. ${params?.addCaution ?? '가격 확인 전 신규매수는 보류합니다.'}`;
    }

    const support = roundPriceLevel(reference.price * (1 - supportPct));
    const rebound = roundPriceLevel(reference.price * 1.02);
    const changeText =
      reference.changeRate === null ? '' : `, 등락률 ${reference.changeRate}%`;

    if (mode === 'midday') {
      return `${reference.source} ${formatWon(reference.price)}${changeText} 기준. 13:30 이후 ${formatWon(support)} 방어 여부를 확인하고, ${formatWon(rebound)} 위로 다시 밀어올리기 전 추격매수는 보류합니다. ${params?.addCaution ?? ''}`.trim();
    }

    if (mode === 'preclose') {
      return `${reference.source} ${formatWon(reference.price)}${changeText} 기준. 동시호가는 현재가 부근 소액만 허용하고, ${formatWon(rebound)} 이상 추격은 보류합니다. 미체결되면 ${formatWon(support)} 부근 다음 세션 눌림 주문으로 넘깁니다. ${params?.addCaution ?? ''}`.trim();
    }

    return `${reference.source} ${formatWon(reference.price)}${changeText} 기준. ${formatWon(support)} 이탈 시 리스크를 재평가하고, ${formatWon(rebound)} 회복 전 추격매수는 보류합니다. ${params?.addCaution ?? ''}`.trim();
  }

  const tomorrowScenarios =
    mode === 'midday'
      ? [
          {
            scenario: '오후장 강세 유지',
            condition: '13:30 이후 KOSPI/KOSDAQ, KODEX/TIGER 반도체가 오전 고점 부근을 유지',
            action:
              `추격매수보다 보유 유지. 삼성전자와 SK하이닉스는 각 종목의 현재 시장 수집가 기준으로 오후장 상승폭 유지 여부를 확인합니다.`,
          },
          {
            scenario: '오후장 상승분 반납',
            condition: '오전 고점 이탈, 환율 재상승, 반도체 ETF 상승폭 축소',
            action:
              '신규매수 없음. SOL은 현재 평가단가 기준 약 -2~3% 추가 이탈 시 5~10주 추가 축소 검토, 대형주는 보유 중심으로 대응합니다.',
          },
          {
            scenario: '종목별 차별화',
            condition: '반도체는 강하지만 현대차가 약하거나, 전력기기 ETF만 강한 흐름',
            action:
              '강한 섹터를 따라 새로 늘리기보다 기존 중복 노출을 점검합니다.',
          },
        ]
      : mode === 'preclose'
        ? [
            {
              scenario: '동시호가 강세 유지',
              condition: '현재가 부근에서 예상체결가가 유지되고 KOSPI/KOSDAQ 및 반도체 proxy가 장중 상승폭을 크게 반납하지 않음',
              action:
                '보유 중심. 신규 액션은 미리 정한 추격 금지선 아래에서 2~3주 같은 소액만 허용하고, 미체결은 그대로 둡니다.',
            },
            {
              scenario: '동시호가 급격한 위로 쏠림',
              condition: '예상체결가가 현재가 대비 빠르게 올라가며 no-chase line을 넘김',
              action:
                '추격 취소. 우호 신호가 있어도 종가 직전 급등 체결은 다음 세션 눌림 주문으로 넘깁니다.',
            },
            {
              scenario: '종가 전 상승폭 반납',
              condition: '예상체결가가 현재가 아래로 밀리고 KOSDAQ/테마 ETF 상승폭이 축소됨',
              action:
                '신규매수 없음. 기존 보유는 유지하되, 다음 세션 buy1/buy2 가격대에서만 다시 판단합니다.',
            },
          ]
      : mode === 'morning'
        ? [
            {
              scenario: '야간 우호 신호가 시초가에 과반 반영',
              condition: `${afterMarketSignalText} ${nightFuturesSignalText} 장초 갭상승 후 10시까지 상승폭을 유지`,
              action:
                '추격매수보다 보유 유지. 신규매수는 첫 눌림 뒤 전일 종가와 넥장 후보 가격을 모두 지키는 종목만 소액 검토합니다.',
            },
            {
              scenario: '야간 우호 신호를 시초가에서 과소 반영',
              condition:
                '야간선물/넥장 후보는 우호적인데 시초가 상승폭이 제한적이고 10시 이후 매수세가 살아남',
              action:
                '보유 종목 중 손실률이 큰 종목만 buy1 가격대에서 소액 평균단가 개선을 검토합니다. 반도체 중복 ETF는 추격하지 않습니다.',
            },
            {
              scenario: '야간 신호와 장초 수급 불일치',
              condition:
                '야간선물 또는 넥장 후보는 우호적이지만 장초 30~60분 동안 KOSPI/KOSDAQ이나 보유 종목이 밀림',
              action:
                '야간 신호보다 정규장 수급을 우선합니다. 신규매수 없음, 기존 보유만 관찰합니다.',
            },
          ]
      : mode === 'evening'
        ? [
            {
              scenario: '넥장/야선 동반 우호',
              condition: `${afterMarketSignalText} ${nightFuturesSignalText}`,
              action:
                '내일 장초 갭상승 가능성은 인정하되, 시초 추격은 금지합니다. 보유 우위로 두고 10시 이후 상승 유지 여부를 확인합니다.',
            },
            {
              scenario: '넥장 우호, 야선 중립/약세',
              condition: '개별 종목 시간외/NXT 후보는 강하지만 KOSPI200 야간선물은 보합 이하',
              action:
                '개별 호재성 반등일 수 있으므로 추가매수보다 종목별 상대강도 확인을 우선합니다. 중복 섹터 ETF는 늘리지 않습니다.',
            },
            {
              scenario: '넥장/야선 동반 약세',
              condition: '시간외/NXT 후보 평균이 음수이거나 KOSPI200 야간선물이 음수',
              action:
                '내일 장초 방어 모드입니다. 신규매수는 보류하고, 손실 종목은 장초 투매 손절보다 10시 이후 회복 여부를 확인합니다.',
            },
          ]
      : [
          {
            scenario: '미국장 강한 반등',
            condition: '나스닥 +1% 이상, SOX 반등, NVDA/MU/AMD 반등, USD/KRW 안정',
            action:
              mode === 'morning'
                ? '장초반 추격매수 금지. NXT/시초가 반영 뒤 10시 이후 삼성전자와 SK하이닉스가 현재 시장 수집가 대비 상승폭을 유지하는지 확인 후 보유 유지.'
                : '미국 선물 초반 강세가 유지되는지 확인. 내일 시초가 갭상승이면 추격보다 10시 이후 눌림 확인.',
          },
          {
            scenario: '미국장 혼조',
            condition: '나스닥 보합권, SOX 약보합, 유가/환율 혼재',
            action:
              mode === 'evening'
                ? '신규매수 없음. 야간 대체 지표와 미국 선물 초반 흐름이 엇갈리면 내일 장초 관망. SOL은 현재 평가단가 기준 약 -2~3% 추가 이탈 시 5~10주 추가 축소 검토.'
                : '신규매수 없음. SOL은 현재 평가단가 기준 약 -2~3% 추가 이탈 전까지 보유, 이탈 시 5~10주 추가 축소 검토.',
          },
          {
            scenario: '미국 반도체 재급락',
            condition: 'SOX -3% 이하 또는 NVDA/MU/AMD 동반 급락',
            action:
              '대형주 본체는 패닉 매도하지 않고, 중복 반도체 ETF인 SOL 잔여 25주 중 5~10주 추가 축소.',
          },
        ];

  const positionRules = portfolio.positions.map((position) => {
    if (position.name === 'SK하이닉스') {
      return {
        name: position.name,
        action: '보유',
        trigger: buildDynamicTrigger(position),
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 손실률은 크지만 1주라 부분조절이 불가능합니다. HBM/AI 메모리 공급 부족 논리는 살아 있으므로 장초반 투매 손절은 비효율적입니다.`,
      };
    }

    if (position.name === '삼성전자') {
      return {
        name: position.name,
        action: '보유',
        trigger: buildDynamicTrigger(position),
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 반도체 본체는 오늘 급락장에서 이미 큰 충격을 반영했습니다. 추가 조정 시에도 신규매수보다 보유 판단이 우선입니다.`,
      };
    }

    if (position.name === 'SOL AI반도체TOP2플러스') {
      return {
        name: position.name,
        action: '조건부 추가 축소',
        trigger: buildDynamicTrigger(position, {
          supportPct: 0.02,
          addCaution: '중복 반도체 노출 조절용이므로 방어선 이탈 시 5~10주 추가 축소를 검토합니다.',
        }),
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 삼성전자·SK하이닉스와 중복 노출입니다. 이미 10주를 줄였으므로 남은 25주는 추가 급락 시 방어 카드로 사용합니다.`,
      };
    }

    if (position.name === 'TIGER 코리아AI전력기기TOP3플러스') {
      return {
        name: position.name,
        action: '보유',
        trigger: buildDynamicTrigger(position, {
          supportPct: 0.03,
        }),
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 단기 손실은 크지만 반도체 본체와 직접 중복은 낮고, 전력 인프라/AI 데이터센터 수요 논리가 남아 있습니다.`,
      };
    }

    if (position.name === '현대차') {
      return {
        name: position.name,
        action: '보유',
        trigger: buildDynamicTrigger(position),
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 유가와 경기민감주 부담은 있지만 오늘 하락은 개별 악재보다 시장 전체 리스크오프 성격이 큽니다.`,
      };
    }

    if (false) {
      return {
        name: position.name,
        action: '정찰 보유',
        trigger: buildDynamicTrigger(position, {
          supportPct: 0.03,
          addCaution: '정찰 포지션이므로 방어선 이탈 시 추가매수보다 관찰 유지가 우선입니다.',
        }),
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 급락장 상대강도가 확인됐지만 신규 진입 종목입니다. 추가매수보다는 1주 정찰병으로 관찰하는 게 맞습니다.`,
      };
    }

    return {
      name: position.name,
      action: '보유',
      trigger: '추가 기준 필요.',
      reason: '아직 별도 규칙이 없습니다.',
    };
  });

  return {
    headline,
    actionItems,
    rationale,
    tomorrowScenarios,
    positionRules,
    orderRecommendations,
    guardrails: buildGuardrails(portfolioSummary),
    decisionReviews: buildDecisionReviews({
      tradeEvents,
      portfolioSummary,
      marketItems,
    }),
  };
}

function buildMarkdown(output: AnalysisOutput): string {
  const lines: string[] = [];
  const cell = (value: string): string => value.replace(/\|/g, '/');
  const decisivePosts = output.communitySummary.highConfidenceClaims
    .filter((post, index, array) => {
      return array.findIndex((candidate) => candidate.url === post.url) === index;
    })
    .slice(0, 3);
  const supportPosts = output.communitySummary.posts
    .filter((post) => {
      const text = `${post.cleanTitle} ${post.bodyText} ${post.rawListText}`;
      return (
        post.stance !== 'neutral' &&
        post.stance !== 'meme' &&
        post.evidenceQualityScore >= 2.5 &&
        post.marketAlignment !== 'conflicted' &&
        post.directAffectedPositions.some((positionName) => {
          return textMentionsPosition(text, positionName);
        })
      );
    })
    .sort((a, b) => b.influenceScore - a.influenceScore)
    .slice(0, 2);
  const appendixPosts = output.communitySummary.posts
    .filter((post) => post.stance !== 'meme' && post.evidenceQualityScore >= 2)
    .sort((a, b) => b.influenceScore - a.influenceScore)
    .slice(0, 5);
  const marketFocusItems = output.marketSummary.items.filter((item) => {
    return [
      'us_futures',
      'rates',
      'fx',
      'global_semiconductor',
      'commodity',
      'crypto',
      'credit',
      'korea_derivatives_proxy',
      'korea_etf',
      'korea_sector_etf',
      'korea_after_market',
      'korea_night_futures',
    ].includes(item.group);
  });

  lines.push(`# Stock Insight Local Analysis v2`);
  lines.push('');
  lines.push(`Generated at: ${output.generatedAt}`);
  lines.push(`Mode: ${output.mode}`);
  lines.push(`Source: ${output.sourceFile}`);
  lines.push('');

  lines.push(`## 0. 핵심 요약`);
  lines.push('');
  lines.push(`**${output.strategy.headline}**`);
  lines.push('');
  lines.push(`### 실행 지도`);
  lines.push(`| 종목 | 액션 | 1차 가격 | 2차 가격 | 추격 금지선 | 축소 기준 | 근거 |`);
  lines.push(`|---|---|---:|---:|---:|---:|---|`);
  for (const item of output.strategy.orderRecommendations) {
    lines.push(
      `| ${cell(item.name)} | ${item.actionSignal} | ${item.buy1 === null ? 'N/A' : formatWon(item.buy1)} | ${item.buy2 === null ? 'N/A' : formatWon(item.buy2)} | ${item.noChaseAbove === null ? 'N/A' : formatWon(item.noChaseAbove)} | ${item.trimAbove === null ? 'N/A' : formatWon(item.trimAbove)} | ${cell(item.signalBasis)} |`,
    );
  }
  lines.push('');
  lines.push(`### Action Items`);
  for (const item of output.strategy.actionItems) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push(`- 시장 국면: ${output.marketRegime.regime}`);
  lines.push(`- 시장 해석: ${output.marketRegime.description}`);
  if (output.communityWindow) {
    lines.push(
      `- 커뮤니티 기준 시간: ${output.communityWindow.from} ~ ${output.communityWindow.to} (${output.communityWindow.lookbackHours}h)`,
    );
  }
  if (output.communityFilter) {
    lines.push(
      `- 커뮤니티 시간 필터: ${output.communityFilter.originalCount}건 중 ${output.communityFilter.filteredCount}건 반영, ${output.communityFilter.excludedCount}건 제외`,
    );
  }
  lines.push(
    `- 커뮤니티 분류: 상승 ${output.communitySummary.stanceCounts.bullish}, 하락 ${output.communitySummary.stanceCounts.bearish}, 관망/정보 ${output.communitySummary.stanceCounts.neutral}, 밈/감정 ${output.communitySummary.stanceCounts.meme}`,
  );
  lines.push(`- 종목 뉴스: ${output.newsSummary.total}건`);
  lines.push(`- 본문 반영 커뮤니티 근거: 결정적 ${decisivePosts.length}개, 참고 후보 ${supportPosts.length}개`);
  lines.push('');

  lines.push(`## 1. 시장 선행 체크`);
  lines.push('');
  if (output.marketRegime.keySignals.length === 0) {
    lines.push('- 뚜렷하게 움직인 핵심 선행 지표가 없습니다.');
  } else {
    for (const signal of output.marketRegime.keySignals.slice(0, 8)) {
      lines.push(`- ${signal}`);
    }
  }
  lines.push('');

  lines.push(`### 긍정 신호`);
  if (output.marketRegime.bullishSignals.length === 0) {
    lines.push('- 없음');
  } else {
    for (const signal of output.marketRegime.bullishSignals.slice(0, 5)) {
      lines.push(`- ${signal}`);
    }
  }

  lines.push('');
  lines.push(`### 부정 신호`);
  if (output.marketRegime.bearishSignals.length === 0) {
    lines.push('- 없음');
  } else {
    for (const signal of output.marketRegime.bearishSignals.slice(0, 5)) {
      lines.push(`- ${signal}`);
    }
  }

  lines.push('');
  lines.push(`### NXT/야간선물 데이터 상태`);
  if (output.marketSummary.unavailableData.length === 0) {
    lines.push('- 별도로 누락 표시된 시장 데이터가 없습니다.');
  } else {
    for (const item of output.marketSummary.unavailableData) {
      lines.push(`- **${item.name}**: ${item.reason}`);
      lines.push(`  - 다음 작업: ${item.nextStep}`);
    }
  }

  lines.push('');
  lines.push(`### 확인 중인 지표`);
  lines.push('');
  lines.push(`### NXT Candidate Signals`);
  if (output.marketSummary.nxtSignals.length === 0) {
    lines.push('- No active-position NXT candidate prices were matched.');
  } else {
    lines.push(`| name | regular close | NXT candidate | day change | NXT-only | vs portfolio input | vs break-even | signal |`);
    lines.push(`|---|---:|---:|---:|---:|---:|---:|---|`);
    for (const item of output.marketSummary.nxtSignals) {
      lines.push(
        `| ${cell(item.name)} | ${item.regularClosePrice === null ? 'N/A' : formatWon(item.regularClosePrice)} | ${formatWon(item.price)} | ${item.dayChangeRate ?? 'N/A'}% | ${item.nxtOnlyChangeRate ?? 'N/A'}% | ${item.vsLastSeenChangeRate ?? 'N/A'}% | ${item.vsBreakEvenRate ?? 'N/A'}% | ${item.signal} |`,
      );
    }
  }

  if (marketFocusItems.length === 0) {
    lines.push('- 시장 선행 지표가 수집되지 않았습니다.');
  } else {
    lines.push(`| 구분 | 이름 | 심볼 | 가격 | 등락률 |`);
    lines.push(`|---|---|---|---:|---:|`);
    for (const item of marketFocusItems) {
      lines.push(
        `| ${item.group} | ${cell(item.name)} | ${cell(item.symbol)} | ${formatMarketPrice(item)} | ${formatChangeRate(item)} |`,
      );
    }
  }

  lines.push('');
  lines.push(`## 2. 포트폴리오 종목별 대응`);
  lines.push('');
  for (const rule of output.strategy.positionRules) {
    lines.push(`### ${rule.name}`);
    lines.push(`- 액션: ${rule.action}`);
    lines.push(`- 기준: ${rule.trigger}`);
    lines.push(`- 근거: ${rule.reason}`);
    lines.push('');
  }

  lines.push(`## 3. 커뮤니티 흐름`);
  lines.push('');
  lines.push(`- 전체 글 수: ${output.communitySummary.total}`);
  lines.push(
    `- 상승/하락/관망/밈: ${output.communitySummary.stanceCounts.bullish}/${output.communitySummary.stanceCounts.bearish}/${output.communitySummary.stanceCounts.neutral}/${output.communitySummary.stanceCounts.meme}`,
  );
  lines.push(`- 평균 근거 품질: ${output.communitySummary.averageEvidenceQualityScore}`);
  lines.push(`- 평균 시장지표 부합: ${output.communitySummary.averageMarketAlignmentScore}`);
  lines.push('');
  lines.push(`### 결정적 근거`);
  if (decisivePosts.length === 0) {
    lines.push('- 결정적으로 볼 만한 커뮤니티 글은 아직 부족합니다. 현재 커뮤니티는 흐름 참고용입니다.');
  } else {
    for (const post of decisivePosts) {
      lines.push(
        `- **[${post.stance}] ${post.community} / ${post.board} #${post.rank}** ${post.cleanTitle}: ${post.claim}`,
      );
    }
  }
  if (supportPosts.length > 0) {
    lines.push('');
    lines.push(`### 참고 후보`);
    for (const post of supportPosts) {
      lines.push(
        `- **[${post.stance}] ${post.community} / ${post.board} #${post.rank}** ${post.cleanTitle}: ${post.claim}`,
      );
    }
  }
  lines.push('');
  lines.push(`### 노이즈 판단`);
  lines.push('- 밈/감정 글은 본문 판단에서 제외하고, 커뮤니티 과열도 참고용으로만 사용합니다.');
  lines.push('- 개별 글보다 같은 방향의 뉴스, 선물, 환율, 반도체 지표가 같이 움직이는지를 우선 봅니다.');

  lines.push('');
  lines.push(`## 4. 뉴스 흐름`);
  lines.push('');
  if (output.newsSummary.topItems.length === 0) {
    lines.push('- 수집된 종목 뉴스가 없습니다.');
  } else {
    for (const item of output.newsSummary.topItems.slice(0, 8)) {
      lines.push(`- **${item.stockName}**: ${item.title}`);
    }
  }

  lines.push('');
  lines.push(`## 5. 포트폴리오 노출`);
  lines.push('');
  lines.push(`- 총 매수금액: ${output.portfolioSummary.totalBuyAmount.toLocaleString()}원`);
  lines.push(`- 주식 평가금액: ${output.portfolioSummary.totalStockEvalAmount.toLocaleString()}원`);
  lines.push(
    `- 평가손익: ${output.portfolioSummary.totalPnlAmount.toLocaleString()}원 (${output.portfolioSummary.totalPnlRate ?? 'N/A'}%)`,
  );
  lines.push(`- 추정 예수금: ${output.portfolioSummary.cashEstimated.toLocaleString()}원`);
  lines.push(`- 추정 총자산: ${output.portfolioSummary.totalEstimatedAsset.toLocaleString()}원`);
  lines.push('');
  lines.push(`| 종목 | 수량 | 매수금액 | 손익분기 | 현재가 | 평가금액 | 평가손익 | 수익률 | 가격출처 |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|---:|---|`);
  for (const position of output.portfolioSummary.positions) {
    lines.push(
      `| ${cell(position.name)} | ${position.sellableQty}/${position.qty} | ${position.buyAmount.toLocaleString()}원 | ${position.breakEvenPrice === null ? 'N/A' : `${position.breakEvenPrice.toLocaleString()}원`} | ${position.currentPrice === null ? 'N/A' : `${position.currentPrice.toLocaleString()}원`} | ${position.evalAmount.toLocaleString()}원 | ${position.pnlAmount.toLocaleString()}원 | ${position.pnlRate ?? 'N/A'}% | ${position.priceSource} |`,
    );
  }
  lines.push('');
  lines.push(`| 섹터 | 평가금액 | 총자산 대비 |`);
  lines.push(`|---|---:|---:|`);
  for (const [sector, amount] of Object.entries(output.portfolioSummary.sectorExposure)) {
    lines.push(
      `| ${sector} | ${amount.toLocaleString()}원 | ${output.portfolioSummary.sectorExposureRate[sector]}% |`,
    );
  }

  lines.push('');
  if (output.portfolioSummary.priceWarnings.length > 0) {
    lines.push('');
    lines.push(`### Price Freshness Warnings`);
    for (const warning of output.portfolioSummary.priceWarnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('');
  lines.push(`### Portfolio Price Delta`);
  lines.push(`| name | input price | collected price | delta | stale |`);
  lines.push(`|---|---:|---:|---:|---|`);
  for (const position of output.portfolioSummary.positions) {
    lines.push(
      `| ${cell(position.name)} | ${position.lastSeenPrice === null ? 'N/A' : formatWon(position.lastSeenPrice)} | ${position.currentPrice === null ? 'N/A' : formatWon(position.currentPrice)} | ${position.marketVsLastSeenRate ?? 'N/A'}% | ${position.isInputPriceStale ? 'yes' : 'no'} |`,
    );
  }

  const checklistTitle =
    output.mode === 'midday'
      ? '오후장 체크리스트'
      : output.mode === 'preclose'
        ? '장마감 체크리스트'
        : '내일 체크리스트';
  const scenarioTitle =
    output.mode === 'midday'
      ? '오후장 시나리오'
      : output.mode === 'preclose'
        ? '동시호가 시나리오'
        : '내일 시나리오';
  lines.push(`## 6. ${checklistTitle}`);
  lines.push('');
  lines.push(`**${output.strategy.headline}**`);
  lines.push('');
  for (const reason of output.strategy.rationale.slice(0, 6)) {
    lines.push(`- ${reason}`);
  }

  lines.push('');
  lines.push(`### ${scenarioTitle}`);
  lines.push('');
  for (const scenario of output.strategy.tomorrowScenarios) {
    lines.push(`- **${scenario.scenario}**`);
    lines.push(`  - 조건: ${scenario.condition}`);
    lines.push(`  - 대응: ${scenario.action}`);
  }

  lines.push('');
  lines.push(`## 부록. 커뮤니티 상세 후보`);
  lines.push('');
  if (appendixPosts.length === 0) {
    lines.push('- 부록에 표시할 커뮤니티 글이 없습니다.');
  } else {
    lines.push(`| 출처 | 게시판 | 제목 | 분류 | 근거 품질 | 판단 |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const post of appendixPosts) {
      lines.push(
        `| ${cell(post.community)} | ${cell(post.board)} | ${cell(post.cleanTitle)} | ${post.stance} | ${post.evidenceQuality} (${post.evidenceQualityScore}) | ${cell(post.claim)} |`,
      );
    }
  }

  lines.push('');
  lines.push(`## Order Plan`);
  lines.push('');
  lines.push(`### Effective Sector Exposure`);
  lines.push(`| sector | amount | total asset rate |`);
  lines.push(`|---|---:|---:|`);
  for (const item of output.portfolioSummary.weightedSectorExposure) {
    lines.push(`| ${cell(item.sector)} | ${item.amount.toLocaleString()} KRW | ${item.rate}% |`);
  }

  if (output.portfolioSummary.concentrationWarnings.length > 0) {
    lines.push('');
    lines.push(`### Concentration Warnings`);
    for (const warning of output.portfolioSummary.concentrationWarnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('');
  lines.push(`### Order Recommendations`);
  lines.push(`| name | action | stance | buy1 | buy2 | no chase above | trim above | qty unit | basis | reason |`);
  lines.push(`|---|---|---|---:|---:|---:|---:|---:|---|---|`);
  for (const item of output.strategy.orderRecommendations) {
    lines.push(
      `| ${cell(item.name)} | ${item.actionSignal} | ${item.stance} | ${item.buy1 === null ? 'N/A' : formatWon(item.buy1)} | ${item.buy2 === null ? 'N/A' : formatWon(item.buy2)} | ${item.noChaseAbove === null ? 'N/A' : formatWon(item.noChaseAbove)} | ${item.trimAbove === null ? 'N/A' : formatWon(item.trimAbove)} | ${item.suggestedQty} | ${cell(item.signalBasis)} | ${cell(item.reason)} |`,
    );
  }

  lines.push('');
  lines.push(`### Guardrails`);
  for (const guardrail of output.strategy.guardrails) {
    lines.push(`- ${guardrail}`);
  }

  if (output.strategy.decisionReviews.length > 0) {
    lines.push('');
    lines.push(`## Trade Review`);
    lines.push('');
    lines.push(`| event | current | opportunity pnl | NXT candidate | NXT opportunity pnl | verdict | next rule |`);
    lines.push(`|---|---:|---:|---:|---:|---|---|`);
    for (const review of output.strategy.decisionReviews) {
      const eventLabel = `${review.event.executedAt} ${review.event.action} ${review.event.name} ${review.event.qty ?? ''}`.trim();
      lines.push(
        `| ${cell(eventLabel)} | ${review.currentPrice === null ? 'N/A' : formatWon(review.currentPrice)} | ${review.opportunityPnl === null ? 'N/A' : `${review.opportunityPnl.toLocaleString()} KRW`} | ${review.nxtPrice === null ? 'N/A' : formatWon(review.nxtPrice)} | ${review.nxtOpportunityPnl === null ? 'N/A' : `${review.nxtOpportunityPnl.toLocaleString()} KRW`} | ${cell(review.verdict)} | ${cell(review.nextRule)} |`,
      );
    }
  }

  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const outputDir = resolveFromRoot('data', 'output');
  const reportInputFile = findLatestFile(outputDir, 'report-input-');

  const reportInput = readJson<ReportInput>(reportInputFile);
  const mode = reportInput.mode ?? 'daily';
  const news = reportInput.news ?? [];

  const marketRegime = buildMarketRegime(reportInput.market.items);

  const analyzedPosts: AnalyzedPost[] = reportInput.community.map((post) => {
    const text = `${post.cleanTitle} ${post.bodyText} ${post.rawListText}`;
    const claim = analyzeClaim(post);
    const tags = extractEvidenceTags(text);
    const evidence = analyzeEvidenceQuality(post, tags);
    const alignment = analyzeMarketAlignment({
      stance: claim.stance,
      tags,
      marketItems: reportInput.market.items,
    });
    const portfolioImpact = analyzePortfolioImpact({
      post,
      tags,
      positions: reportInput.portfolio.positions,
    });

    return {
      ...post,
      claim: claim.claim,
      stance: claim.stance,
      stanceReason: claim.stanceReason,
      evidenceTags: evidence.tags,
      evidenceQuality: evidence.quality,
      evidenceQualityScore: evidence.qualityScore,
      evidenceQualityReason: evidence.qualityReason,
      marketAlignment: alignment.alignment,
      marketAlignmentScore: alignment.alignmentScore,
      marketAlignmentReason: alignment.reason,
      affectedPositions: portfolioImpact.affectedPositions,
      directAffectedPositions: portfolioImpact.directAffectedPositions,
      macroAffectedPositions: portfolioImpact.macroAffectedPositions,
      portfolioImpactSummary: portfolioImpact.impactSummary,
      influenceScore: calculateInfluenceScore(
        post,
        evidence.qualityScore,
        alignment.alignmentScore,
      ),
    };
  });

  const stanceCounts = countStances(analyzedPosts);
  const evidenceTagCounts = countEvidenceTags(analyzedPosts);

  const averageEvidenceQualityScore = round(
    analyzedPosts.reduce((sum, post) => sum + post.evidenceQualityScore, 0) /
      Math.max(1, analyzedPosts.length),
    2,
  );

  const averageMarketAlignmentScore = round(
    analyzedPosts.reduce((sum, post) => sum + post.marketAlignmentScore, 0) /
      Math.max(1, analyzedPosts.length),
    2,
  );

  const highConfidenceClaims = analyzedPosts
    .filter((post) => {
      return (
        post.stance !== 'neutral' &&
        post.stance !== 'meme' &&
        post.evidenceQualityScore >= 3 &&
        ['aligned', 'partially-aligned'].includes(post.marketAlignment)
      );
    })
    .sort((a, b) => b.influenceScore - a.influenceScore)
    .slice(0, 5);

  const informativeClaims = analyzedPosts
    .filter((post) => {
      return (
        post.stance === 'neutral' &&
        post.evidenceQualityScore >= 3 &&
        !post.evidenceTags.includes('meme')
      );
    })
    .sort((a, b) => b.influenceScore - a.influenceScore)
    .slice(0, 7);

  const lowConfidenceClaims = analyzedPosts
    .filter((post) => {
      return post.evidenceQualityScore < 2 || post.marketAlignment === 'conflicted';
    })
    .sort((a, b) => b.influenceScore - a.influenceScore)
    .slice(0, 5);

  const portfolioSummary = buildPortfolioSummary(reportInput.portfolio, reportInput.market.items);
  const nxtSignals = buildNxtSignals(reportInput.portfolio.positions, reportInput.market.items);

  const output: AnalysisOutput = {
    mode,
    generatedAt: formatKstDateTime(),
    sourceFile: reportInputFile,
    communityWindow: reportInput.communityWindow,
    communityFilter: reportInput.communityFilter,
    marketRegime,
    communitySummary: {
      total: analyzedPosts.length,
      stanceCounts,
      evidenceTagCounts,
      averageEvidenceQualityScore,
      averageMarketAlignmentScore,
      highConfidenceClaims,
      informativeClaims,
      lowConfidenceClaims,
      posts: analyzedPosts,
    },
    marketSummary: {
      modeFocus: reportInput.market.modeFocus ?? [],
      unavailableData: reportInput.market.unavailableData ?? [],
      items: reportInput.market.items,
      nxtSignals,
    },
    newsSummary: {
      total: news.length,
      topItems: selectRepresentativeNews(news, 2),
    },
    portfolioSummary,
    strategy: buildStrategy({
      mode,
      marketRegime,
      marketItems: reportInput.market.items,
      analyzedPosts,
      portfolio: reportInput.portfolio,
      portfolioSummary,
      nxtSignals,
      news,
      tradeEvents: reportInput.tradeEvents ?? [],
    }),
  };

  const now = new Date();

  const outputId = formatKstTimestampId(now);
  const jsonOutputPath = resolveFromRoot('data', 'output', `analysis-v2-${outputId}.json`);
  const markdownOutputPath = resolveFromRoot('data', 'output', `analysis-v2-${outputId}.md`);

  saveJson(jsonOutputPath, output);
  fs.writeFileSync(markdownOutputPath, buildMarkdown(output), 'utf-8');

  console.log('');
  console.log(`분석 JSON 저장 완료: ${jsonOutputPath}`);
  console.log(`분석 Markdown 저장 완료: ${markdownOutputPath}`);
  console.log('');
  console.log('=== 분석 요약 ===');
  console.log(`총 글 수: ${output.communitySummary.total}`);
  console.log(
    `분류: bullish ${output.communitySummary.stanceCounts.bullish}, ` +
      `bearish ${output.communitySummary.stanceCounts.bearish}, ` +
      `neutral ${output.communitySummary.stanceCounts.neutral}, ` +
      `meme ${output.communitySummary.stanceCounts.meme}`,
  );
  console.log(`시장 국면: ${output.marketRegime.regime}`);
  console.log(`High confidence: ${output.communitySummary.highConfidenceClaims.length}`);
  console.log(`Informative: ${output.communitySummary.informativeClaims.length}`);
  console.log(`Headline: ${output.strategy.headline}`);

  const topClaims = output.communitySummary.highConfidenceClaims.slice(0, 3);

  if (topClaims.length > 0) {
    console.log('Top claims:');
    for (const post of topClaims) {
      console.log(`- [${post.stance}] ${post.community}/${post.board}: ${post.cleanTitle}`);
    }
  }
  console.log('');
}

main().catch((error) => {
  console.error('로컬 분석 v2 실행 중 오류가 발생했습니다.');
  console.error(error);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import { resolveFromRoot, saveJson } from '../utils/file';

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
};

type Position = {
  name: string;
  symbol: string | null;
  qty: number;
  evalAmount: number;
  pnlRate: number;
  sectorTag: string;
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
  mode?: 'daily' | 'morning' | 'evening' | string;
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
  community: CommunityPost[];
  news?: NewsItem[];
  market: {
    mode?: string;
    modeFocus?: string[];
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
    items: MarketItem[];
  };
  newsSummary: {
    total: number;
    topItems: NewsItem[];
  };
  portfolioSummary: {
    totalStockEvalAmount: number;
    cashEstimated: number;
    totalEstimatedAsset: number;
    sectorExposure: Record<string, number>;
    sectorExposureRate: Record<string, number>;
  };
  strategy: {
    headline: string;
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

  if (containsAny(text, ['네이버', 'NAVER'])) tags.add('naver');

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
      claim: 'NAVER는 급락장에서도 상대강도가 있었고 매수 기회가 있었다는 주장입니다.',
      stanceReason: '개별 호재와 상대강도를 근거로 NAVER를 긍정적으로 해석합니다.',
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
  const naver = getMarket(marketItems, 'NAVER');

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

  if (tags.includes('naver')) {
    if ((naver?.changeRate ?? 0) > 5 && stance === 'bullish') {
      score += 1.5;
      reasons.push(`NAVER ${formatChangeRate(naver)}로 상대강도 주장은 실제 가격과 부합합니다.`);
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
      (position.name === 'NAVER' && containsAny(text, ['NAVER', '네이버']));

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

    if (tags.includes('naver') && position.name === 'NAVER') {
      directAffected.add(position.name);
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
  const vix = getMarket(items, 'VIX');
  const usdkrw = getMarket(items, 'USD/KRW');
  const wti = getMarket(items, 'WTI Crude Oil Futures');
  const brent = getMarket(items, 'Brent Crude Oil Futures');

  const bullishSignals: string[] = [];
  const bearishSignals: string[] = [];
  const mixedSignals: string[] = [];

  if ((nq?.changeRate ?? 0) > 0.7) {
    bullishSignals.push(`나스닥100 선물 ${formatChangeRate(nq)}로 기술주 반등 기대가 있습니다.`);
  }

  if ((es?.changeRate ?? 0) > 0.3) {
    bullishSignals.push(`S&P500 선물 ${formatChangeRate(es)}로 위험선호가 일부 회복 중입니다.`);
  }

  if ((vix?.changeRate ?? 0) < 0) {
    bullishSignals.push(`VIX ${formatChangeRate(vix)}로 공포지수는 완화 방향입니다.`);
  }

  if ((usdkrw?.changeRate ?? 0) < 0) {
    bullishSignals.push(`USD/KRW ${usdkrw?.price}, ${formatChangeRate(usdkrw)}로 환율 부담은 완화되었습니다.`);
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

  if ((wti?.changeRate ?? 0) > 0.5 || (brent?.changeRate ?? 0) > 0.5) {
    bearishSignals.push(`WTI ${formatChangeRate(wti)}, Brent ${formatChangeRate(brent)}로 유가 부담이 남아 있습니다.`);
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

  return {
    regime,
    description,
    bullishSignals,
    bearishSignals,
    mixedSignals,
  };
}

function buildPortfolioSummary(portfolio: ReportInput['portfolio']) {
  const totalStockEvalAmount = portfolio.positions.reduce((sum, position) => {
    return sum + position.evalAmount;
  }, 0);

  const totalEstimatedAsset = totalStockEvalAmount + portfolio.cashEstimated;

  const sectorExposure: Record<string, number> = {};

  for (const position of portfolio.positions) {
    sectorExposure[position.sectorTag] =
      (sectorExposure[position.sectorTag] ?? 0) + position.evalAmount;
  }

  const sectorExposureRate: Record<string, number> = {};

  for (const [sector, amount] of Object.entries(sectorExposure)) {
    sectorExposureRate[sector] = round((amount / totalEstimatedAsset) * 100, 2);
  }

  return {
    totalStockEvalAmount,
    cashEstimated: portfolio.cashEstimated,
    totalEstimatedAsset,
    sectorExposure,
    sectorExposureRate,
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

function buildStrategy(params: {
  mode: string;
  marketRegime: MarketRegimeSummary;
  analyzedPosts: AnalyzedPost[];
  portfolio: ReportInput['portfolio'];
  news: NewsItem[];
}) {
  const { mode, marketRegime, analyzedPosts, portfolio, news } = params;
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

  const naverBullish = directBullishByPosition.get('NAVER') ?? 0;
  const autoBullish = directBullishByPosition.get('현대차') ?? 0;
  const newsSignal = analyzeNewsSignals(news, portfolio.positions);
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
      marketRegime.regime === 'risk-on-rebound'
        ? '아침 전략: 미국장 반등은 우호적이지만, 장초 NXT/시초가 반영 여부 확인 후 대응합니다.'
        : `아침 전략: ${headline}`;
  }

  if (mode === 'evening') {
    headline =
      marketRegime.regime === 'risk-off-continuation'
        ? '저녁 전략: 내일 장초 방어를 우선하고, 야간선물/NXT 되돌림 확인 전 추가매수는 보류합니다.'
        : `저녁 전략: ${headline}`;
  }

  const rationale = [
    marketRegime.description,
    `근거 품질이 중간 이상인 상승 주장은 ${highConfidenceBullish.length}개, 하락 경계 주장은 ${highConfidenceBearish.length}개입니다.`,
    `직접 영향 신호는 ${directSignalSummary}입니다.`,
    `반도체 관련 상승 신호는 ${semiconductorBullish}개, 반도체 하락 경계 신호는 ${semiconductorBearish}개입니다.`,
    `지정학 하락 경계 신호는 ${geopoliticsBearish}개입니다.`,
    `NAVER 직접 상승 신호는 ${naverBullish}개, 현대차 직접 상승 신호는 ${autoBullish}개입니다.`,
    newsSummaryText,
    newsSignal.topBearish.length > 0
      ? `주의 뉴스는 ${newsSignal.topBearish.map((item) => `${item.stockName}: ${item.title}`).join(' / ')}입니다.`
      : '뉴스 기준의 뚜렷한 부정 신호는 제한적입니다.',
    mode === 'morning'
      ? '아침 모드는 미국장 종가와 NXT/장전 반영 여부를 우선 확인해 오늘 장중 대응을 판단합니다.'
      : mode === 'evening'
        ? '저녁 모드는 NXT장, 야간선물, 미국 선물 초반 흐름을 우선 확인해 내일 전략을 준비합니다.'
        : '일일 모드는 커뮤니티, 시장지표, 뉴스의 통합 흐름을 점검합니다.',
    '커뮤니티의 반등 기대는 나스닥 선물·VIX·환율 완화와 일부 부합하지만, 국내장 급락과 유가/지정학 변수는 아직 부담입니다.',
    '따라서 내일 전략은 상승 확신이 아니라 장초반 가격 재확인 이후의 조건부 대응입니다.',
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

  const tomorrowScenarios = [
    {
      scenario: '미국장 강한 반등',
      condition: '나스닥 +1% 이상, SOX 반등, NVDA/MU/AMD 반등, USD/KRW 안정',
        action:
        mode === 'morning'
          ? '장초반 추격매수 금지. NXT/시초가 반영 뒤 10시 이후 삼성전자 300,000원, SK하이닉스 1,950,000원 회복 여부 확인 후 보유 유지.'
          : '미국 선물 초반 강세가 유지되는지 확인. 내일 시초가 갭상승이면 추격보다 10시 이후 눌림 확인.',
    },
    {
      scenario: '미국장 혼조',
      condition: '나스닥 보합권, SOX 약보합, 유가/환율 혼재',
      action:
        mode === 'evening'
          ? '신규매수 없음. 야간 대체 지표와 미국 선물 초반 흐름이 엇갈리면 내일 장초 관망. SOL은 20,500원 이탈 시 5~10주 추가 축소 검토.'
          : '신규매수 없음. SOL은 20,500원 이탈 전까지 보유, 이탈 시 5~10주 추가 축소 검토.',
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
        trigger: '1,950,000원 회복 여부 확인. 1,850,000원 이탈 시 재평가.',
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 손실률은 크지만 1주라 부분조절이 불가능합니다. HBM/AI 메모리 공급 부족 논리는 살아 있으므로 장초반 투매 손절은 비효율적입니다.`,
      };
    }

    if (position.name === '삼성전자') {
      return {
        name: position.name,
        action: '보유',
        trigger: '300,000원 회복 여부 확인. 290,000원 이탈 시 리스크 재평가.',
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 반도체 본체는 오늘 급락장에서 이미 큰 충격을 반영했습니다. 추가 조정 시에도 신규매수보다 보유 판단이 우선입니다.`,
      };
    }

    if (position.name === 'SOL AI반도체TOP2플러스') {
      return {
        name: position.name,
        action: '조건부 추가 축소',
        trigger: '20,500원 이탈 시 5~10주 추가 매도 검토.',
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 삼성전자·SK하이닉스와 중복 노출입니다. 이미 10주를 줄였으므로 남은 25주는 추가 급락 시 방어 카드로 사용합니다.`,
      };
    }

    if (position.name === 'TIGER 코리아AI전력기기TOP3플러스') {
      return {
        name: position.name,
        action: '보유',
        trigger: '20,000원 이탈 시에도 바로 손절보다 시장 전체 흐름 확인.',
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 단기 손실은 크지만 반도체 본체와 직접 중복은 낮고, 전력 인프라/AI 데이터센터 수요 논리가 남아 있습니다.`,
      };
    }

    if (position.name === '현대차') {
      return {
        name: position.name,
        action: '보유',
        trigger: '630,000원 회복 여부 확인. 615,000원 이탈 시 재평가.',
        reason:
          `${buildPositionSignalReason(position.name)} ${buildNewsSignalReason(position.name)} 유가와 경기민감주 부담은 있지만 오늘 하락은 개별 악재보다 시장 전체 리스크오프 성격이 큽니다.`,
      };
    }

    if (position.name === 'NAVER') {
      return {
        name: position.name,
        action: '정찰 보유',
        trigger: '280,000원 이상 유지 시 보유. 270,000원 이탈 시 추가매수 금지.',
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
    rationale,
    tomorrowScenarios,
    positionRules,
  };
}

function buildMarkdown(output: AnalysisOutput): string {
  const lines: string[] = [];
  const cell = (value: string): string => value.replace(/\|/g, '/');

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
  lines.push(`- 시장 국면: ${output.marketRegime.regime}`);
  if (output.communityWindow) {
    lines.push(
      `- 커뮤니티 기준 시간: ${output.communityWindow.from} ~ ${output.communityWindow.to} (${output.communityWindow.lookbackHours}h)`,
    );
  }
  if (output.communityFilter) {
    lines.push(
      `- 커뮤니티 시간 필터: ${output.communityFilter.originalCount}건 중 ${output.communityFilter.filteredCount}건 반영, ${output.communityFilter.excludedCount}건 제외, 시간 파싱 불가 ${output.communityFilter.unknownTimestampCount}건 보존`,
    );
  }
  lines.push(
    `- 커뮤니티 분류: 상승 ${output.communitySummary.stanceCounts.bullish}, 하락 ${output.communitySummary.stanceCounts.bearish}, 관망/정보 ${output.communitySummary.stanceCounts.neutral}, 밈/감정 ${output.communitySummary.stanceCounts.meme}`,
  );
  lines.push(`- 종목 뉴스: ${output.newsSummary.total}건`);
  lines.push(`- 신뢰도 높은 주장: ${output.communitySummary.highConfidenceClaims.length}개`);
  lines.push(`- 관찰 가치 정보성 글: ${output.communitySummary.informativeClaims.length}개`);
  lines.push('');
  lines.push(`### 핵심 주장 TOP 5`);
  if (output.communitySummary.highConfidenceClaims.length === 0) {
    lines.push('- 신뢰도 높은 주장이 충분하지 않습니다.');
  } else {
    for (const post of output.communitySummary.highConfidenceClaims.slice(0, 5)) {
      lines.push(
        `- **[${post.stance}] ${post.community} / ${post.board} #${post.rank}** ${post.cleanTitle}: ${post.claim}`,
      );
    }
  }
  lines.push('');
  lines.push(`### 종목 뉴스 TOP 5`);
  if (output.newsSummary.topItems.length === 0) {
    lines.push('- 수집된 종목 뉴스가 없습니다.');
  } else {
    for (const item of output.newsSummary.topItems.slice(0, 5)) {
      lines.push(`- **${item.stockName}**: ${item.title}`);
    }
  }
  lines.push('');
  lines.push(`### 종목별 대응 요약`);
  for (const rule of output.strategy.positionRules) {
    lines.push(`- **${rule.name}**: ${rule.action} / ${rule.trigger}`);
  }
  lines.push('');

  lines.push(`## 1. 시장 국면`);
  lines.push('');
  lines.push(`**${output.marketRegime.regime}**`);
  lines.push('');
  lines.push(output.marketRegime.description);
  lines.push('');

  lines.push(`### 긍정 신호`);
  if (output.marketRegime.bullishSignals.length === 0) {
    lines.push('- 없음');
  } else {
    for (const signal of output.marketRegime.bullishSignals) {
      lines.push(`- ${signal}`);
    }
  }

  lines.push('');
  lines.push(`### 부정 신호`);
  if (output.marketRegime.bearishSignals.length === 0) {
    lines.push('- 없음');
  } else {
    for (const signal of output.marketRegime.bearishSignals) {
      lines.push(`- ${signal}`);
    }
  }

  lines.push('');
  lines.push(`## 2. 커뮤니티 여론 요약`);
  lines.push('');
  lines.push(`- 총 글 수: ${output.communitySummary.total}`);
  lines.push(`- 상승론: ${output.communitySummary.stanceCounts.bullish}`);
  lines.push(`- 하락론: ${output.communitySummary.stanceCounts.bearish}`);
  lines.push(`- 관망/정보: ${output.communitySummary.stanceCounts.neutral}`);
  lines.push(`- 밈/감정: ${output.communitySummary.stanceCounts.meme}`);
  lines.push(`- 평균 근거 품질 점수: ${output.communitySummary.averageEvidenceQualityScore}`);
  lines.push(`- 평균 시장지표 부합 점수: ${output.communitySummary.averageMarketAlignmentScore}`);
  lines.push('');

  lines.push(`## 3. 글별 주장 평가`);
  lines.push('');
  lines.push(
    `| 출처 | 게시판 | Rank | 제목 | 분류 | 근거 품질 | 지표 부합 | 직접 영향 | 간접 영향 | 핵심 판단 |`,
  );
  lines.push(`|---|---|---:|---|---|---|---|---|---|---|`);

  for (const post of output.communitySummary.posts) {
    lines.push(
      `| ${cell(post.community)} | ${cell(post.board)} | ${post.rank} | ${cell(post.cleanTitle)} | ${post.stance} | ${post.evidenceQuality} (${post.evidenceQualityScore}) | ${post.marketAlignment} (${post.marketAlignmentScore}) | ${cell(post.directAffectedPositions.join(', ') || '-')} | ${cell(post.macroAffectedPositions.join(', ') || '-')} | ${cell(post.claim)} |`,
    );
  }

  lines.push('');
  lines.push(`## 4. 신뢰도 높은 주장`);
  lines.push('');

  if (output.communitySummary.highConfidenceClaims.length === 0) {
    lines.push('- 신뢰도 높은 주장이 충분하지 않습니다.');
  } else {
    for (const post of output.communitySummary.highConfidenceClaims) {
      lines.push(
        `- **${post.cleanTitle}**: ${post.claim} / ${post.marketAlignmentReason}`,
      );
    }
  }

  lines.push('');
  lines.push(`## 5. 관찰 가치 있는 정보성 글`);
  lines.push('');

  if (output.communitySummary.informativeClaims.length === 0) {
    lines.push('- 관찰 가치 있는 정보성 글이 충분하지 않습니다.');
  } else {
    for (const post of output.communitySummary.informativeClaims) {
      lines.push(
        `- **[${post.community} / ${post.board} #${post.rank}] ${post.cleanTitle}**: ${post.claim} / ${post.evidenceQualityReason}`,
      );
    }
  }

  lines.push('');
  lines.push(`## 6. 신뢰도 낮은 주장`);
  lines.push('');

  if (output.communitySummary.lowConfidenceClaims.length === 0) {
    lines.push('- 신뢰도 낮은 주장이 뚜렷하지 않습니다.');
  } else {
    for (const post of output.communitySummary.lowConfidenceClaims) {
      lines.push(
        `- **${post.cleanTitle}**: ${post.claim} / ${post.evidenceQualityReason}`,
      );
    }
  }

  lines.push('');
  lines.push(`## 7. 포트폴리오 노출`);
  lines.push('');
  lines.push(`- 주식 평가금액: ${output.portfolioSummary.totalStockEvalAmount.toLocaleString()}원`);
  lines.push(`- 추정 예수금: ${output.portfolioSummary.cashEstimated.toLocaleString()}원`);
  lines.push(`- 추정 총자산: ${output.portfolioSummary.totalEstimatedAsset.toLocaleString()}원`);
  lines.push('');

  lines.push(`| 섹터 | 평가금액 | 총자산 대비 |`);
  lines.push(`|---|---:|---:|`);

  for (const [sector, amount] of Object.entries(output.portfolioSummary.sectorExposure)) {
    lines.push(
      `| ${sector} | ${amount.toLocaleString()}원 | ${output.portfolioSummary.sectorExposureRate[sector]}% |`,
    );
  }

  lines.push('');
  lines.push(`## 8. 대응 전략`);
  lines.push('');
  lines.push(`**${output.strategy.headline}**`);
  lines.push('');

  for (const reason of output.strategy.rationale) {
    lines.push(`- ${reason}`);
  }

  lines.push('');
  lines.push(`### 내일 시나리오`);
  lines.push('');

  for (const scenario of output.strategy.tomorrowScenarios) {
    lines.push(`- **${scenario.scenario}**`);
    lines.push(`  - 조건: ${scenario.condition}`);
    lines.push(`  - 대응: ${scenario.action}`);
  }

  lines.push('');
  lines.push(`### 종목별 규칙`);
  lines.push('');

  for (const rule of output.strategy.positionRules) {
    lines.push(`- **${rule.name}**: ${rule.action}`);
    lines.push(`  - 기준: ${rule.trigger}`);
    lines.push(`  - 이유: ${rule.reason}`);
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

  const portfolioSummary = buildPortfolioSummary(reportInput.portfolio);

  const output: AnalysisOutput = {
    mode,
    generatedAt: new Date().toISOString(),
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
      items: reportInput.market.items,
    },
    newsSummary: {
      total: news.length,
      topItems: news.slice(0, 10),
    },
    portfolioSummary,
    strategy: buildStrategy({
      mode,
      marketRegime,
      analyzedPosts,
      portfolio: reportInput.portfolio,
      news,
    }),
  };

  const now = Date.now();

  const jsonOutputPath = resolveFromRoot('data', 'output', `analysis-v2-${now}.json`);
  const markdownOutputPath = resolveFromRoot('data', 'output', `analysis-v2-${now}.md`);

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

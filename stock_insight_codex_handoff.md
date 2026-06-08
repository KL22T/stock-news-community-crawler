# Stock Insight Crawler / Analyzer - Codex CLI 작업 인수인계 문서

## 0. 목적

이 프로젝트는 로컬 PC에서 주식 커뮤니티 글과 시장지표를 수집하고, 이를 병합한 뒤 투자 판단 보조용 로컬 분석 리포트를 생성하는 Node.js / Playwright 기반 도구다.

최종 목표는 다음과 같다.

1. 커뮤니티 인기글 자동 수집
2. 시장지표 자동 수집
3. 포트폴리오 상태와 병합
4. 커뮤니티 주장 분류
5. 근거 품질 평가
6. 시장지표와 주장 부합/충돌 여부 평가
7. 보유 종목별 대응안 생성
8. 나중에 GUI 또는 클라우드 연동으로 확장

현재는 로컬 CLI MVP를 만들고 있으며, GUI와 클라우드 연동은 후순위다.

---

## 1. 현재 개발 환경

### OS / IDE

- Windows PC
- VS Code 사용
- VS Code UI는 한국어로 설정
- VS Code 확장
  - Korean Language Pack
  - Playwright Test for VSCode
  - ESLint
  - Prettier
  - DotENV 선택 가능

### Node / npm / Playwright

현재 확인된 버전:

```powershell
node -v
# v26.3.0

npm -v
# 11.16.0

npx playwright --version
# Version 1.60.0
```

주의:
- Node v26은 꽤 최신 버전이므로 패키지 호환성 문제가 생기면 Node LTS로 낮추는 것을 1순위로 검토한다.
- 현재는 `npm`, `npx`, `playwright`가 정상 동작한다.

---

## 2. 프로젝트 루트

```text
C:\stock-community-crawler
```

현재 기본 구조:

```text
stock-community-crawler/
  data/
    input/
      portfolio.json
    output/
      fmkorea-stock-*.json
      dcinside-stock-*.json
      market-snapshot-*.json
      report-input-*.json
      analysis-v2-*.json
      analysis-v2-*.md
    raw/
  playwright/
    .auth/
  src/
    analysis/
      build-report-input.ts
      analyze-report-input.ts
    community/
      crawl-fmkorea.ts
      crawl-dcinside.ts
      login.ts          # FM코리아에는 현재 불필요. 추후 로그인 사이트용.
    market/
      collect-market.ts
    utils/
      file.ts
  package.json
  tsconfig.json
  .gitignore
```

`.gitignore`에는 아래 항목이 포함되어야 한다.

```gitignore
node_modules/
playwright/.auth/
data/raw/
data/output/
.env
```

`playwright/.auth/`는 로그인 쿠키/세션 파일이 들어갈 수 있으므로 절대 커밋하면 안 된다.

---

## 3. package.json scripts 현황

현재 또는 목표 scripts:

```json
{
  "scripts": {
    "login:fmkorea": "tsx src/community/login.ts fmkorea",
    "crawl:fmkorea:dev": "cross-env NODE_ENV=development tsx src/community/crawl-fmkorea.ts",
    "crawl:fmkorea": "cross-env NODE_ENV=production tsx src/community/crawl-fmkorea.ts",
    "crawl:dc:dev": "cross-env NODE_ENV=development tsx src/community/crawl-dcinside.ts",
    "crawl:dc": "cross-env NODE_ENV=production tsx src/community/crawl-dcinside.ts",
    "collect:market": "tsx src/market/collect-market.ts",
    "build:report-input": "tsx src/analysis/build-report-input.ts",
    "analyze:local": "tsx src/analysis/analyze-report-input.ts"
  }
}
```

개발 모드:
- `:dev`가 붙은 명령은 `headless: false`로 브라우저가 보이게 실행된다.

운영 모드:
- `:dev`가 없는 명령은 `headless: true`로 브라우저 없이 실행된다.
- 모니터를 꺼도 괜찮다.
- 단, Windows 절전/최대절전/로그아웃은 금지다.

---

## 4. 현재까지 성공한 기능

### 4.1 FM코리아 수집기

파일:

```text
src/community/crawl-fmkorea.ts
```

수집 URL:

```text
https://www.fmkorea.com/index.php?mid=stock&sort_index=pop&order_type=desc&listStyle=webzine
```

기준:
- FM코리아 주식 게시판
- 인기순 정렬
- 공지/운영글 제외
- 일반 게시글 상위 10개 수집

현재 수집되는 필드:

```ts
{
  community: 'FM코리아',
  board: 'stock',
  rank: number,
  title: string,
  cleanTitle: string,
  url: string,
  commentCount: number | null,
  author: string | null,
  createdAt: string | null,
  views: number | null,
  likes: number | null,
  bodyText: string,
  rawListText: string,
  capturedAt: string
}
```

검증 결과:
- 공지글 제외 성공
- 작성자, 작성시간, 조회수, 추천수, 댓글 수 수집 성공
- 일부 글은 본문이 `복사`, 이미지/짤 중심이라 텍스트가 짧을 수 있음
- 이 경우 수집 실패가 아니라 원문 특성으로 보면 됨

실행:

```powershell
npm run crawl:fmkorea:dev
npm run crawl:fmkorea
```

---

### 4.2 시장지표 수집기

파일:

```text
src/market/collect-market.ts
```

수집 소스:
- Yahoo Finance chart endpoint
- MVP 용도
- 실제 매매 판단 시 증권사/공식 지표와 교차 확인 필요

현재 수집 대상:

```text
국내:
- KOSPI (^KS11)
- KOSDAQ (^KQ11)
- 삼성전자 (005930.KS)
- SK하이닉스 (000660.KS)
- 현대차 (005380.KS)
- NAVER (035420.KS)

미국/글로벌:
- Nasdaq 100 Futures (NQ=F)
- S&P 500 Futures (ES=F)
- NASDAQ Composite (^IXIC)
- PHLX Semiconductor Index (^SOX)
- VIX (^VIX)

미국 반도체 참고:
- NVIDIA (NVDA)
- Micron (MU)
- AMD (AMD)

환율/원자재:
- USD/KRW (KRW=X)
- WTI (CL=F)
- Brent (BZ=F)
```

실행:

```powershell
npm run collect:market
```

생성 파일:

```text
data/output/market-snapshot-*.json
```

검증 결과:
- KOSPI, KOSDAQ, 삼성전자, 하이닉스, 현대차, NAVER 수집 성공
- 나스닥100 선물, S&P500 선물, VIX, USD/KRW, WTI, Brent 수집 성공
- SOX도 수집 성공
- 일부 미국 개별주 dataTime/volume은 프리마켓/야후 응답 특성상 주의 필요

---

### 4.3 report-input 병합기

파일:

```text
src/analysis/build-report-input.ts
```

역할:
- 최신 커뮤니티 수집 파일
- 최신 시장지표 파일
- `data/input/portfolio.json`

을 하나로 병합해 ChatGPT 또는 로컬 분석기에 넣을 수 있는 `report-input-*.json` 생성.

현재 목표 구조:

```json
{
  "generatedAt": "...",
  "files": {
    "communityFile": "...",
    "marketFile": "...",
    "portfolioFile": "..."
  },
  "portfolio": {},
  "community": [],
  "market": {}
}
```

주의:
- 처음에는 FM코리아 파일만 읽었다.
- 디시 추가 후에는 `fmkorea-stock-*`, `dcinside-stock-*` 최신 파일을 모두 읽어서 `community` 배열로 병합하도록 수정해야 한다.
- 이미 수정했는지 확인 필요.

실행:

```powershell
npm run build:report-input
```

---

### 4.4 로컬 분석기 v2

파일:

```text
src/analysis/analyze-report-input.ts
```

역할:
- `report-input-*.json` 최신 파일을 읽는다.
- 커뮤니티 글별 주장 분류
- 근거 태그 추출
- 근거 품질 점수화
- 시장지표 부합/충돌 평가
- 포트폴리오 영향 종목 매핑
- Markdown 리포트 생성

생성 파일:

```text
data/output/analysis-v2-*.json
data/output/analysis-v2-*.md
```

현재 리포트 섹션:

```text
1. 시장 국면
2. 커뮤니티 여론 요약
3. 글별 주장 평가
4. 신뢰도 높은 주장
5. 신뢰도 낮은 주장
6. 포트폴리오 노출
7. 대응 전략
```

현재 잘 되는 부분:
- 시장 국면 판단은 괜찮음
- 포트폴리오 대응안은 대략 의미 있음
- 수집/병합/분석 파이프라인 전체 동작 확인됨

현재 부족한 부분:
- 커뮤니티별 출처가 표에서 잘 안 보임
- neutral 글이 너무 많음
- high confidence claims에 neutral이 올라감
- 지정학 글이 `not-verifiable`로 너무 많이 떨어짐
- NAVER 관련 글이 meme으로 오분류되는 경우 있음
- 직접 영향 종목과 간접 매크로 영향 종목이 섞임
- 디시 노이즈가 아직 일부 들어올 수 있음

---

## 5. 포트폴리오 입력 파일

파일:

```text
data/input/portfolio.json
```

현재 예시:

```json
{
  "capturedAt": "2026-06-08T15:30:00+09:00",
  "cashEstimated": 590000,
  "positions": [
    {
      "name": "SK하이닉스",
      "symbol": "000660.KS",
      "qty": 1,
      "evalAmount": 1932000,
      "pnlRate": -18.51,
      "sectorTag": "semiconductor"
    },
    {
      "name": "현대차",
      "symbol": "005380.KS",
      "qty": 3,
      "evalAmount": 1911000,
      "pnlRate": -10.43,
      "sectorTag": "auto"
    },
    {
      "name": "삼성전자",
      "symbol": "005930.KS",
      "qty": 9,
      "evalAmount": 2686500,
      "pnlRate": -4.22,
      "sectorTag": "semiconductor"
    },
    {
      "name": "TIGER 코리아AI전력기기TOP3플러스",
      "symbol": null,
      "qty": 16,
      "evalAmount": 333440,
      "pnlRate": -13.41,
      "sectorTag": "power-equipment"
    },
    {
      "name": "SOL AI반도체TOP2플러스",
      "symbol": null,
      "qty": 25,
      "evalAmount": 523875,
      "pnlRate": -9.71,
      "sectorTag": "semiconductor-etf"
    },
    {
      "name": "NAVER",
      "symbol": "035420.KS",
      "qty": 1,
      "evalAmount": 282500,
      "pnlRate": -0.38,
      "sectorTag": "platform-ai"
    }
  ]
}
```

TODO:
- SOL AI반도체TOP2플러스, TIGER 코리아AI전력기기TOP3플러스의 6자리 종목코드 확인 후 `.KS` 형태로 추가
- 보유 수량/평가금액/손익률은 수동 업데이트 방식 유지

---

## 6. 디시 수집기 현황

파일:

```text
src/community/crawl-dcinside.ts
```

처음에 잘못 사용했던 기본 URL:

```text
https://gall.dcinside.com/board/lists/?id=stock_new2
```

문제:
- 정치/선거/ㅎㅂ/잡담이 너무 많이 섞임
- 시장 심리 분석용으로 부적합

현재 적절하다고 판단한 URL:

```text
한국 주식 갤 개념글:
https://gall.dcinside.com/mgallery/board/lists/?id=krstock&exception_mode=recommend

미국 주식 갤 개념글:
https://gall.dcinside.com/mgallery/board/lists/?id=stockus&exception_mode=recommend
```

`DEFAULT_TARGETS`는 아래처럼 설정하는 것이 좋다.

```ts
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
```

실행:

```powershell
npm run crawl:dc:dev
npm run crawl:dc
```

---

## 7. 디시 수집기 추가 필터 요구사항

한국주식갤에는 `🤤계집`이라는 말머리가 있으며, 야한 짤/성인성 글 분류다.  
이 분류는 시장 분석에서 무조건 제외해야 한다.

### 추가할 필드

`DcinsideListItem`, `CommunityPost`에 `category` 추가.

```ts
category: string | null;
```

### 제외 분류

```ts
const EXCLUDE_CATEGORIES = [
  '🤤계집',
  '계집',
];
```

### 제외 키워드

```ts
const EXCLUDE_NOISE_KEYWORDS = [
  '19금',
  'ㅎㅂ',
  '후방',
  '야짤',
  '라방',
  '플러팅',
];
```

주의:
- `여자` 같은 넓은 키워드는 제외하지 말 것.
- 너무 넓게 잡으면 정상 글도 제거될 수 있음.

### category 추출 셀렉터

디시 목록 row에서 아래 시도:

```ts
const category =
  row.querySelector<HTMLElement>('td.gall_subject')?.innerText?.trim() ??
  row.querySelector<HTMLElement>('.gall_subject')?.innerText?.trim() ??
  null;
```

### 필터 조건

```ts
if (isExcludedCategory(category)) continue;
if (isNoiseText(title) || isNoiseText(parentText)) continue;
```

### 저장 결과

```json
{
  "community": "디시인사이드",
  "board": "한국주식갤-개념글",
  "rank": 1,
  "title": "...",
  "cleanTitle": "...",
  "category": "국장",
  "url": "..."
}
```

---

## 8. 분석기 v3 개선 계획

현재 v2 결과는 구조는 좋지만 분석 품질이 아직 아쉽다.

### 문제 1: 출처 컬럼 부족

현재 글별 평가 표에는 Rank만 있어 출처 구분이 안 된다.

수정:

```text
출처 | 게시판 | Rank | 제목 | 분류 | 근거 품질 | 지표 부합 | 직접 영향 | 간접 영향 | 핵심 판단
```

### 문제 2: highConfidenceClaims에 neutral/meme 포함

현재 신뢰도 높은 주장에 neutral 글이 올라오는 문제가 있다.

수정 조건:

```ts
const highConfidenceClaims = analyzedPosts
  .filter((post) => {
    return (
      post.stance !== 'neutral' &&
      post.stance !== 'meme' &&
      post.evidenceQualityScore >= 3 &&
      ['aligned', 'partially-aligned'].includes(post.marketAlignment)
    );
  })
```

### 문제 3: neutral 정보글을 따로 관리

neutral을 버리면 안 된다.  
속보, 공시, 환율, 나선, 옵션 보고서 등은 관찰 가치가 있다.

추가:

```ts
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
```

Markdown 섹션 추가:

```text
## 5. 관찰 가치 있는 정보글
```

### 문제 4: analyzeClaim 분류 강화

아래 분기를 `meme` 분기보다 앞에 둬야 한다.

#### NAVER 상대강도

```ts
if (containsAny(text, ['네이버', 'NAVER']) && containsAny(text, ['쎈데', '강한데', '탑승', '상승', '후장'])) {
  return {
    stance: 'bullish',
    claim: 'NAVER가 급락장에서도 상대강도를 보였다는 주장입니다.',
    stanceReason: '개별 종목 상대강도와 AI/NAVER 호재 기대를 반영합니다.',
  };
}
```

#### 나스닥/야선 반등

```ts
if (containsAny(text, ['나선', '야선']) && containsAny(text, ['1.', '상승', '풀발기', '오름', '반등'])) {
  return {
    stance: 'bullish',
    claim: '미국 선물 반등을 다음날 국내장 반등 근거로 보는 주장입니다.',
    stanceReason: '나스닥 선물 상승은 국내 반도체·성장주 심리에 우호적입니다.',
  };
}
```

#### 지정학 완화

```ts
if (containsAny(text, ['공격중단', '종전', '영공 재개방']) && !containsAny(text, ['안했', '장기전', '레바논 타격'])) {
  return {
    stance: 'bullish',
    claim: '중동 지정학 리스크 완화를 반등 재료로 보는 주장입니다.',
    stanceReason: '전쟁 리스크 완화는 유가와 위험회피 심리를 낮출 수 있습니다.',
  };
}
```

#### 지정학 악화/불확실

```ts
if (containsAny(text, ['공격중단 한다고 안했', '공격중단인척', '장기전', '레바논 타격', '종전 없'])) {
  return {
    stance: 'bearish',
    claim: '중동 리스크 완화가 아직 확정되지 않았다는 경계성 주장입니다.',
    stanceReason: '유가와 지정학 리스크가 다시 커질 수 있다는 관점입니다.',
  };
}
```

#### 외국인 수급 완화

```ts
if (containsAny(text, ['외국인 이제 주식안판대', '외국인 이제 주식 안판대', '외궈'])) {
  return {
    stance: 'bullish',
    claim: '외국인 매도 압력 완화를 기대하는 주장입니다.',
    stanceReason: '외국인 수급 개선 기대는 대형주 반등 논리로 연결됩니다.',
  };
}
```

#### CPI / 금리 부담

```ts
if (containsAny(text, ['CPI', 'cpi', '높게나올', '금리', '연준'])) {
  return {
    stance: 'bearish',
    claim: '물가·금리 부담이 아직 남아 있다는 경계성 주장입니다.',
    stanceReason: 'CPI와 금리 부담은 성장주와 반도체 밸류에이션에 부정적입니다.',
  };
}
```

### 문제 5: 지정학 글을 유가와 대조

`analyzeMarketAlignment()`에서 지정학/유가 태그를 더 적극적으로 평가해야 한다.

```ts
if (tags.includes('geopolitics') || tags.includes('oil')) {
  const oilStillUp = (wti?.changeRate ?? 0) > 0.5 || (brent?.changeRate ?? 0) > 0.5;

  if (stance === 'bullish') {
    if (oilStillUp) {
      score -= 0.8;
      reasons.push(
        `지정학 완화 주장이 있지만 WTI ${formatChangeRate(wti)}, Brent ${formatChangeRate(brent)}로 유가는 아직 상승 중이라 완전 부합하지 않습니다.`,
      );
    } else {
      score += 1.2;
      reasons.push('유가가 안정되어 지정학 완화 주장과 부합합니다.');
    }
  }

  if (stance === 'bearish') {
    if (oilStillUp) {
      score += 1.2;
      reasons.push(
        `WTI ${formatChangeRate(wti)}, Brent ${formatChangeRate(brent)}로 지정학 경계론과 부합합니다.`,
      );
    } else {
      score -= 0.5;
      reasons.push('유가가 안정되어 지정학 경계론은 일부 약화됩니다.');
    }
  }
}
```

### 문제 6: 직접 영향 / 간접 영향 분리

현재는 영향 종목이 너무 넓게 잡힌다.

새 타입:

```ts
type PortfolioImpact = {
  directAffectedPositions: string[];
  macroAffectedPositions: string[];
  impactSummary: string;
};
```

직접 영향:
- 본문/제목에 종목명이 직접 언급된 경우

간접 영향:
- 나스닥/환율/VIX/유가 등 매크로 지표가 섹터에 영향을 주는 경우

예시:

```text
하이닉스 GDR +12% → 직접 영향: SK하이닉스, SOL
나스닥 선물 반등 → 간접 영향: 삼성전자, SK하이닉스, SOL, NAVER
유가 상승 → 직접 영향/간접 영향: 현대차
```

---

## 9. 현재 리포트 해석 기준

현재 v2 리포트의 큰 방향은 맞다.

핵심 결론:

```text
국내장은 패닉성 급락
나스닥 선물, VIX, 환율은 완화 신호
SOX 급락과 유가 상승은 여전히 부담
내일 장초반 추격매수 금지
대형주 보유
SOL은 추가 급락 시 방어 카드
NAVER는 정찰 보유
```

다만 중간 분석 품질은 개선 필요:

```text
시장 국면 판단: 좋음
포트폴리오 대응안: 괜찮음
커뮤니티 글 분류: 거침
근거 신뢰도 랭킹: 수정 필요
출처별 비교: 부족
노이즈 필터: 계속 보강 필요
```

---

## 10. 앞으로 실행할 전체 파이프라인

디버깅 모드:

```powershell
npm run crawl:fmkorea:dev
npm run crawl:dc:dev
npm run collect:market
npm run build:report-input
npm run analyze:local
```

운영 모드:

```powershell
npm run crawl:fmkorea
npm run crawl:dc
npm run collect:market
npm run build:report-input
npm run analyze:local
```

나중에 하나로 합칠 수 있다.

```json
{
  "scripts": {
    "run:daily": "npm run crawl:fmkorea && npm run crawl:dc && npm run collect:market && npm run build:report-input && npm run analyze:local"
  }
}
```

---

## 11. VS Code에서 Codex CLI를 쓰는 방식

### 전제

- VS Code에서 프로젝트 루트 `C:\stock-community-crawler`를 연다.
- 터미널을 연다.
- 현재 작업 디렉터리가 프로젝트 루트인지 확인한다.

```powershell
pwd
```

기대:

```text
Path
----
C:\stock-community-crawler
```

### Codex CLI 기본 사용 흐름

1. 작업 전 Git 상태 확인

```powershell
git status
```

2. 필요하면 현재 상태 커밋 또는 백업

```powershell
git add .
git commit -m "checkpoint before codex task"
```

3. Codex CLI 실행

설치된 명령이 `codex`라면:

```powershell
codex
```

혹은 Codex CLI가 프롬프트 인자 실행을 지원하는 환경이면:

```powershell
codex "DEVELOPMENT_PLAN_FOR_CODEX.md를 읽고, 디시 수집기의 category 필터를 구현해줘. 기존 로직은 최대한 유지하고 변경 파일과 테스트 방법을 설명해줘."
```

4. Codex가 수정한 뒤 반드시 확인

```powershell
git diff
npm run crawl:dc:dev
npm run build:report-input
npm run analyze:local
```

5. 정상일 때만 커밋

```powershell
git add .
git commit -m "improve dcinside crawler filtering"
```

---

## 12. Codex에게 줄 작업 프롬프트 예시

### 프롬프트 1: 디시 수집기 category 필터

```text
이 프로젝트는 stock-community-crawler입니다.
DEVELOPMENT_PLAN_FOR_CODEX.md를 먼저 읽고 맥락을 파악하세요.

작업 목표:
src/community/crawl-dcinside.ts를 수정해서 디시 목록의 말머리/category를 수집하고, 한국주식갤의 '🤤계집' 또는 '계집' 분류를 제외하세요.

요구사항:
1. DcinsideListItem과 CommunityPost에 category: string | null 추가
2. 목록 row에서 td.gall_subject 또는 .gall_subject로 category 추출
3. EXCLUDE_CATEGORIES = ['🤤계집', '계집'] 추가
4. EXCLUDE_NOISE_KEYWORDS = ['19금', 'ㅎㅂ', '후방', '야짤', '라방', '플러팅'] 추가
5. isExcludedCategory, isNoiseText 함수 추가
6. category 제외 필터와 noise keyword 필터 적용
7. 저장 JSON에 category 필드 포함
8. 기존 수집 로직과 파일명 규칙은 유지

작업 후:
- 변경 파일 목록
- 실행 명령
- 예상 결과를 설명하세요.

테스트 명령:
npm run crawl:dc:dev
```

### 프롬프트 2: report-input 병합기 다중 커뮤니티 지원

```text
DEVELOPMENT_PLAN_FOR_CODEX.md를 읽고 작업하세요.

작업 목표:
src/analysis/build-report-input.ts가 FM코리아와 디시 최신 수집 파일을 모두 읽어 community 배열로 병합하도록 수정하세요.

요구사항:
1. fmkorea-stock-*.json 최신 파일 읽기
2. dcinside-stock-*.json 최신 파일 읽기
3. 둘 중 하나만 있어도 동작
4. 둘 다 없으면 오류
5. files.communityFile에는 병합된 파일 경로를 세미콜론으로 이어서 기록
6. community는 배열 형태로 flatten
7. 기존 market, portfolio 로직은 유지

테스트:
npm run crawl:fmkorea
npm run crawl:dc
npm run collect:market
npm run build:report-input
```

### 프롬프트 3: 분석기 v3 1차 개선

```text
DEVELOPMENT_PLAN_FOR_CODEX.md를 읽고, src/analysis/analyze-report-input.ts를 v3 방향으로 개선하세요.

이번 작업 범위:
1. Markdown의 글별 평가 표에 community, board 컬럼 추가
2. highConfidenceClaims 조건에서 neutral/meme 제외
3. informativeClaims 섹션 추가
4. AnalysisOutput 타입에 informativeClaims 추가
5. analyzeClaim에 NAVER, 나선/야선, 지정학 완화, 지정학 악화, 외국인 수급, CPI/금리 분기 추가
6. NAVER 분기는 meme 분기보다 앞에 둠
7. 기존 전략 문구와 시장 국면 로직은 최대한 유지

테스트:
npm run build:report-input
npm run analyze:local

출력 확인:
data/output/analysis-v2-*.md 또는 새 analysis-v3-*.md 파일에서 다음 섹션이 보여야 함:
- 관찰 가치 있는 정보글
- 글별 평가 표에 출처/게시판 컬럼
```

### 프롬프트 4: 직접 영향 / 간접 영향 분리

```text
DEVELOPMENT_PLAN_FOR_CODEX.md를 읽고 분석기 영향 종목 매핑을 개선하세요.

작업 목표:
src/analysis/analyze-report-input.ts에서 PortfolioImpact를 directAffectedPositions와 macroAffectedPositions로 분리하세요.

요구사항:
1. type PortfolioImpact 수정
2. AnalyzedPost 타입에 directAffectedPositions, macroAffectedPositions 추가
3. 직접 영향은 제목/본문에 종목명 또는 명확한 산업 키워드가 있는 경우만
4. 매크로 영향은 us-futures, vix, fx, oil, geopolitics 태그 기반
5. Markdown 표에 직접 영향과 간접 영향을 분리 표시
6. 기존 strategy 생성 로직은 깨지지 않게 유지

테스트:
npm run analyze:local
```

---

## 13. Codex 작업 시 안전 규칙

1. 한 번에 한 기능만 맡긴다.
2. 수집기와 분석기를 동시에 크게 갈아엎지 않는다.
3. Codex 실행 전 Git checkpoint를 만든다.
4. Codex 수정 후 반드시 `git diff`를 본다.
5. 네트워크 요청/크롤링 로직은 요청 간격을 유지한다.
6. 로그인 쿠키 파일은 절대 업로드/커밋하지 않는다.
7. 분석 결과가 그럴듯해도 실제 매매 판단에는 증권사/공식 데이터로 교차 확인한다.
8. 수집 결과에 노이즈가 섞이면 분석기보다 수집기 필터를 먼저 고친다.
9. 크롤러는 개인 분석용·저빈도 사용을 전제로 한다.
10. 차단 우회, 캡차 우회, 추천/댓글/글쓰기 같은 쓰기 작업은 구현하지 않는다.

---

## 14. 다음 권장 작업 순서

1. `crawl-dcinside.ts`에 category 필터 추가
2. `build-report-input.ts`가 FM코리아 + 디시 파일을 안정적으로 병합하는지 확인
3. `analyze-report-input.ts` v3 1차 개선
   - 출처 컬럼
   - highConfidenceClaims 수정
   - informativeClaims 추가
   - analyzeClaim 분기 강화
4. v3 리포트 확인
5. direct/macro 영향 종목 분리
6. 네이버 종목토론방 수집기 추가 여부 검토
7. `run:daily` 통합 명령 추가
8. 나중에 Vue/Electron 또는 클라우드 업로드 GUI 검토

---

## 15. 현재 최우선 Codex 프롬프트

아래 프롬프트부터 쓰는 것을 추천한다.

```text
DEVELOPMENT_PLAN_FOR_CODEX.md를 읽고 프로젝트 맥락을 파악하세요.

현재 목표는 디시인사이드 수집기의 노이즈를 줄이는 것입니다.

src/community/crawl-dcinside.ts를 수정해서 다음을 구현하세요.

1. DcinsideListItem과 CommunityPost에 category: string | null 추가
2. 디시 목록 row에서 td.gall_subject 또는 .gall_subject로 category 추출
3. EXCLUDE_CATEGORIES = ['🤤계집', '계집'] 추가
4. EXCLUDE_NOISE_KEYWORDS = ['19금', 'ㅎㅂ', '후방', '야짤', '라방', '플러팅'] 추가
5. isExcludedCategory(category), isNoiseText(text) 함수 추가
6. category가 제외 분류면 수집하지 않음
7. title 또는 parentText에 noise keyword가 있으면 수집하지 않음
8. 결과 JSON에 category 필드 저장
9. 기존 DEFAULT_TARGETS는 한국주식갤-개념글, 미국주식갤-개념글 두 개를 유지
10. 기존 파일명 dcinside-stock-*.json 저장 규칙 유지

작업 후 변경 파일과 테스트 명령을 설명하세요.

테스트 명령:
npm run crawl:dc:dev
```

---

## 16. 사용자 선호

- 기존 로직과 아키텍처를 최대한 유지한다.
- 코드 수정은 필요한 부분만 한다.
- 큰 기능을 구현하기 전에는 애매한 점과 충돌점을 먼저 제시한다.
- Vue3, Pinia, Spring Boot, PostgreSQL 경험이 있으나 이 프로젝트는 현재 Node.js / Playwright / TypeScript 기반이다.
- 답변은 한국어가 편하다.
- 문장별 줄바꿈을 선호한다.

# Stock News Community Crawler - Current Handoff

Last updated: 2026-06-10 02:20 KST
Repository: https://github.com/KL22T/stock-news-community-crawler
Local path used so far: `C:\stock-community-crawler`

## 0. Latest 2026-06-10 Overnight Update

Important: the user clarified that handoff files are tracked and should be updated, but code changes should not be committed or pushed until explicitly requested.

New automation:

- Added `src/utils/report-mode.ts`.
- `REPORT_MODE` now defaults to `auto` when missing.
- `npm.cmd run run:auto` was added and maps to the full daily pipeline.
- Auto mode resolves KST report mode:
  - `05:00~10:30`: `morning`
  - `10:30~14:30`: `midday`
  - `14:30~16:00`: `preclose`
  - otherwise: `evening`
- Auto mode also records `marketPhase`.
  - `22:30~05:00`: `us_regular`
  - `05:00~09:00`: `korea_preopen`
  - `09:00~14:30`: `korea_regular`
  - `14:30~15:30`: `korea_closing`
  - `15:30~22:30`: `korea_after_market`

Market/analysis changes:

- In `marketPhase=us_regular`, analysis prioritizes US cash/current market data such as NASDAQ Composite, SOX, SMH, NVDA, MU, AMD, and AVGO over NQ/ES futures.
- Market snapshots and report inputs now store `requestedMode`, `autoDetectedMode`, and `marketPhase`.
- Community analysis now has recency weighting:
  - `ageMinutes`
  - `timeWeight`
  - `weightedInfluenceScore`
  - `weightedStanceCounts`
  - `recentStanceCounts` for latest 90 minutes
  - `staleStanceCounts` for posts older than 4 hours
- Fixed the `속보)마벨 사망` misclassification. If the title says death but body contains `부활`, `죽음을 경험한 적이 없`, or `섹벨 테크놀로지`, classify as `meme`, not bearish evidence.

Community crawler changes:

- Crawlers now scan popularity/list pages and then filter by the auto-resolved community time window instead of collecting a fixed top-N count.
- `COMMUNITY_SCAN_MAX_PAGES` controls scan depth. Default is `3`.
- A previous default of `10` was too slow; a full run took about 11-12 minutes.
- Naver discussion no longer uses fixed post-count limits by default; body collection can still be capped manually with `NAVER_DISCUSSION_BODY_MAX_POSTS`.

Latest full auto run:

- Generated at: `2026-06-10T02:09:23+09:00`
- Mode: `evening`
- Requested mode: `auto`
- Market phase: `us_regular`
- Community: 246 retained
- Raw stances: bullish 34, bearish 3, neutral 175, meme 34
- Time-weighted stances: bullish 23.08, bearish 2.36, neutral 125.38, meme 25.98
- Recent 90m stances: bullish 15, bearish 2, neutral 98, meme 23
- Market regime: `mixed`
- Headline: `저녁 전략: 내일 장초 방어를 우선하고, 야간선물/NXT 되돌림 확인 전 추가매수는 보류합니다.`
- Key current market signals:
  - NASDAQ Composite: -2.6507%
  - SOX: -6.1586%
  - SMH: -5.0639%
  - NVDA: -2.8111%
  - MU: -7.1091%
  - AMD: -8.0069%
  - VIX: +21.7759%
  - KOSPI200 night future: -6.38% in full run; -6.18% in follow-up `collect:market` at `2026-06-10T02:10:35+09:00`.

Final overnight user-facing conclusion:

- Community rebound hopes exist, but US semiconductor cash-market weakness and KOSPI200 night future weakness dominate.
- Tomorrow morning should be defense/observation first.
- No chase buys.
- If there is a gap down, cash buying can be considered only after the open stabilizes, preferably after 09:30~10:00 KST and only in small staged units.
- Duplicate semiconductor exposure, especially SOL AI반도체TOP2플러스, should be trimmed only into strength, not panic-sold into weakness.

## 1. Current Goal

This project collects stock community posts, Naver stock discussion posts, portfolio-related news, and market indicators, then generates local strategy reports for the user's actual portfolio.

Current report modes:

- `morning`: US close, futures, previous after-hours/NXT candidate data, and today's strategy.
- `midday`: morning market result, relative strength, macro/sector proxies, and afternoon strategy.
- `preclose`: close/auction readiness, same-day strength, and end-of-day order guardrails.
- `evening`: NXT/after-hours candidate data, KOSPI200 night future, US futures early flow, and tomorrow's strategy.
- `daily`: general integrated run.

## 2. Current Git/Branch State

Latest known branch:

- `main`

Important commits before this handoff:

- `5426021 initial commit`
- `c5414bc Add Naver news search fallback`
- `5d3d152 Improve report windows news signals and market proxies`
- `23cf9bd Add current project handoff`
- `e6b0f04 Merge pull request #1 from KL22T/20260609_work`

Latest local work after `e6b0f04`:

- Normalized active portfolio/trade-event Korean names.
- Cleaned market snapshot mode/unavailable-data Korean metadata.
- Clarified Trade Review when execution price/qty is missing.
- Fixed KST timestamp IDs to include milliseconds, preventing output file overwrite within the same second.
- Cross-checked 2026-06-09 brokerage NXT close screenshot against collector values for Samsung Electronics, SK Hynix, and Hyundai Motor. Held ETFs are not NXT-traded and are excluded from NXT signals.
- Added local NXT candidate signal, portfolio price freshness warning, and Trade Review NXT opportunity-cost reporting.
- Added action signals to the report: `NO_BUY`, `WATCH_BUY`, `BUY_1`, `BUY_2`, `HOLD`, `TRIM`.
- `BUY_1` / `BUY_2` mean staged pullback orders at the generated buy levels, not market buys.
- The report Action Items now explicitly states that `BUY_1`/`BUY_2` are pullback orders, `WATCH_BUY` is a candidate only, and `TRIM` is partial reduction into strength.
- NXT-only change is now separated from day change. Day change includes the regular session; NXT-only is regular close to NXT candidate.
- ETFs are excluded from NXT signals and are judged from regular/latest price plus sector and market proxies.

Do not push until the user explicitly asks for the final GitHub update.

## 3. Main Commands

Use `npm.cmd` on Windows PowerShell if script execution policy blocks `npm`.

```powershell
npm.cmd exec -- tsc --noEmit
npm.cmd run crawl:fmkorea
npm.cmd run crawl:dc
npm.cmd run crawl:naver
npm.cmd run collect:news
npm.cmd run collect:market
npm.cmd run build:report-input
npm.cmd run analyze:local
npm.cmd run run:daily
npm.cmd run run:morning
npm.cmd run run:midday
npm.cmd run run:preclose
npm.cmd run run:evening
```

Full pipeline:

```text
FMKorea -> DCInside -> Naver discussion -> Naver news -> market snapshot -> report input -> analysis
```

## 4. Inputs

Tracked input files:

- `data/input/portfolio.json`
- `data/input/trade-events.json`
- `data/input/nxt-validation.json`

Current active portfolio as of `2026-06-09T14:00:00+09:00`:

- SK하이닉스: `000660.KS`, 1 share
- 현대차: `005380.KS`, 3 shares
- 삼성전자: `005930.KS`, 8 shares
- TIGER 코리아AI전력기기TOP3플러스: `0117V0`, 16 shares
- SOL AI반도체TOP2플러스: `0167A0`, 10 shares

Trade events:

- SOL AI반도체TOP2플러스 trimmed by 20 shares at 23,340 KRW.

Important:

- NAVER is intentionally forgotten for current reports and Trade Review.
- For future trade events, always record `qty` and `price`.

## 5. Generated Outputs

Ignored by git:

- `data/output/`
- `data/raw/`
- `node_modules/`
- `playwright/.auth/`
- `.env`

Output files now use KST timestamp IDs with milliseconds:

```text
market-snapshot-YYYYMMDDHHMMSSmmm.json
report-input-YYYYMMDDHHMMSSmmm.json
analysis-v2-YYYYMMDDHHMMSSmmm.json
analysis-v2-YYYYMMDDHHMMSSmmm.md
```

This was changed because second-level IDs caused overwrite when `build-report-input` was run twice in the same second.

## 6. Implemented Components

### Community Crawlers

Files:

- `src/community/crawl-fmkorea.ts`
- `src/community/crawl-dcinside.ts`
- `src/community/crawl-naver-discussion.ts`

Current behavior:

- FMKorea stock board crawler.
- DCInside Korean/US stock gallery crawler with category/relevance/noise filtering.
- Naver Finance discussion crawler for portfolio symbols.
- Naver discussion crawler now opens some posts and captures `bodyText`.
- Env knobs:
  - `FMKOREA_MAX_POSTS`
  - `DCINSIDE_MAX_POSTS`
  - `NAVER_DISCUSSION_MAX_POSTS`
  - `NAVER_DISCUSSION_BODY_MAX_POSTS`
  - `NAVER_DISCUSSION_BODY_DELAY_MS`
  - `COMMUNITY_MAX_POSTS`

Known limitations:

- Naver discussion body collection is intentionally capped for speed.
- Community filtering is still mostly keyword/rule based.

### News Collector

File:

- `src/news/collect-naver-news.ts`

Current behavior:

- Tries Naver Finance item news first.
- Falls back to Naver search news when Finance has no rows.
- Uses stock/sector aliases for relatedness filtering.
- Uses multiple fallback search queries for ETF/theme products.
- Deduplicates by URL.

Latest verified evening run:

- 5 active portfolio positions x 10 = 50 news items.

### Market Collector

File:

- `src/market/collect-market.ts`

Sources:

- Yahoo Finance chart endpoint.
- Naver Finance page for Korean ETF prices not stable on Yahoo.
- Naver mobile basic API `overMarketPriceInfo` for after-hours/NXT candidate prices.
- Chartlog KOSPI200 night futures page.

Tracked groups include:

- Korea indices
- Korea derivatives proxies
- Korea stocks
- Korea sector ETFs
- US futures
- US indices/stocks
- Global semiconductor names
- Rates
- FX
- Commodities
- Crypto
- Credit ETFs
- Korean ETF portfolio items
- Korea after-market/NXT candidates
- KOSPI200 night future

Important caveat:

- `korea_after_market` values matched the user's 2026-06-09 brokerage NXT close screenshot for the manually checked names. Treat them as validated NXT close candidates for now, but keep cross-checking more dates because the endpoint is still unofficial.
- KOSPI200 night future is collected.
- KOSDAQ150 night future direct value is still missing.

### Report Input Builder

File:

- `src/analysis/build-report-input.ts`

Current behavior:

- Combines latest community, news, market, portfolio, and trade events.
- Adds `mode`, `communityWindow`, `communityFilter`.
- Filters community posts by `createdAt` if parseable.
- Keeps unknown timestamp posts to avoid dropping an entire source after a markup change.
- Uses KST timestamps in filenames and metadata.

### Analysis

File:

- `src/analysis/analyze-report-input.ts`

Current behavior:

- Rule-based stance analysis: `bullish`, `bearish`, `neutral`, `meme`.
- Evidence quality and market alignment scoring.
- Portfolio impact split into direct/macro exposure.
- News signal aggregation.
- Market regime classification.
- Mode-specific strategy text for morning/midday/preclose/evening/daily.
- Order recommendations.
- Guardrails.
- Trade Review.
- NXT candidate signal table for active NXT-traded stock positions; held ETFs are excluded because they are not traded on NXT.
- Portfolio price freshness warnings when collected prices differ from portfolio input prices by 3% or more.
- Trade Review NXT opportunity PnL when event qty/price and NXT candidate price are available.
- Top-of-report execution map with per-position action signal, buy levels, no-chase level, trim level, and signal basis.
- Market support score added to Action Items using currently collected Nasdaq futures, SOX, KOSPI200 night future, VIX, and USD/KRW.

Trade Review behavior:

- For sell/trim events with `qty` and `price`, calculates opportunity PnL versus current market price.
- For events missing `qty` or `price`, now explicitly says which fields are missing.

## 7. Latest Verification

Commands successfully run on 2026-06-09 KST:

```powershell
npm.cmd run run:evening
npm.cmd exec -- tsc --noEmit
```

Also verified mode-specific build/analyze with latest collected data:

```powershell
$env:REPORT_MODE='midday'
$env:COMMUNITY_LOOKBACK_HOURS='5'
npm.cmd run build:report-input
npm.cmd run analyze:local

$env:REPORT_MODE='preclose'
$env:COMMUNITY_LOOKBACK_HOURS='3'
npm.cmd run build:report-input
npm.cmd run analyze:local
```

Latest full evening run result:

- Mode: `evening`
- Community: 133 original, 90 retained, 43 excluded
- News: 50
- Trade events: 2
- Market regime: `risk-on-rebound`
- Headline: `저녁 전략: 야간선물과 넥장 후보가 우호적이므로 내일 장초 추격보다 눌림 확인 후 보유 우위로 대응합니다.`
- NXT/after-hours candidate values collected for Samsung Electronics, SK Hynix, and Hyundai Motor.
- KOSPI200 night future collected.

Midday/preclose analysis paths also succeeded using latest collected data.

## 8. Immediate Next Tasks

### 1. Cross-check NXT/after-hours candidate values

Continue comparing Naver mobile `overMarketPriceInfo` values against:

- brokerage screen
- NXT official/public page if available
- Naver Finance UI

Goal:

- Build a multi-day validation history.
- Once stable, rename `korea_after_market` and source notes more precisely.

### 2. Record complete trade event fields

For future trading decisions, update `trade-events.json` with:

- `qty`
- `price`
- `referencePrice` if useful
- reason/lesson

NAVER is intentionally excluded from Trade Review unless the user adds it back later.

### 3. Add tests for pure logic

High-value test targets:

- `formatKstTimestampId` uniqueness
- `parseCommunityTime`
- community lookback filtering
- news relatedness filtering
- Trade Review opportunity PnL
- mode-specific strategy headline selection

### 4. Improve Naver discussion body collection

Current body collection is capped.

Next options:

- Increase `NAVER_DISCUSSION_BODY_MAX_POSTS` only for full evening/morning runs.
- Keep lower cap for midday/preclose.
- Add body extraction tests or snapshot checks.

### 5. Improve analysis quality

Potential improvements:

- Add recency weighting inside the lookback window.
- Add source weighting by community/board.
- Penalize meme/noise posts more aggressively.
- Use current market price and break-even price to make order recommendations more position-specific.
- Add `BUY_MOMENTUM` as a separate small-size action for confirmed trend continuation after an opening pullback, distinct from pullback-only `BUY_1`.
- Add foreigner/institution flow and market breadth when reliable sources are found.

## 9. Suggested Start For Next Agent

1. Pull latest `main`.
2. Run:

```powershell
npm.cmd install
npm.cmd exec -- tsc --noEmit
npm.cmd run run:evening
```

3. Inspect latest analysis:

```powershell
Get-ChildItem data\output | Sort-Object LastWriteTime -Descending | Select-Object -First 10 Name,Length,LastWriteTime
```

4. Start with NXT/after-hours candidate validation or pure logic tests.

## 10. Caveats

- This is a decision-support report generator, not a trading system.
- All market data should be verified against brokerage/official data before making trades.
- Yahoo Finance and Naver endpoints are unofficial and can change.
- `data/output` is intentionally not tracked in git.

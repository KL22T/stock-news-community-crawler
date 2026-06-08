# Stock News Community Crawler - Current Handoff

Last updated: 2026-06-09 KST
Repository: https://github.com/KL22T/stock-news-community-crawler
Local path used so far: `C:\stock-community-crawler`

## 1. Project Goal

This project collects Korean/US stock community posts, Naver stock discussion posts, portfolio-related news, and market indicators, then builds a local analysis report for the user's portfolio.

Current focus:

- Morning run: summarize US market close/futures, NXT/pre-market implications, portfolio news, and today's expected strategy.
- Evening run: summarize NXT/after-hours style signals, Korean overnight proxy indicators, US futures early flow, portfolio news, and tomorrow's expected strategy.
- Keep the pipeline runnable locally without a paid API dependency.

## 2. Current Git State

Important pushed commits:

- `5426021 initial commit`
- `c5414bc Add Naver news search fallback`
- `5d3d152 Improve report windows news signals and market proxies`

The latest pushed branch is `main`.

## 3. Main Scripts

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by script execution policy.

```powershell
npm.cmd run crawl:fmkorea
npm.cmd run crawl:dc
npm.cmd run crawl:naver
npm.cmd run collect:news
npm.cmd run collect:market
npm.cmd run build:report-input
npm.cmd run analyze:local
npm.cmd run run:daily
npm.cmd run run:morning
npm.cmd run run:evening
```

Current `package.json` pipeline:

- `run:daily`: FMKorea -> DCInside -> Naver discussion -> Naver news -> market -> report input -> local analysis
- `run:morning`: `REPORT_MODE=morning`, `COMMUNITY_LOOKBACK_HOURS=14`, larger community counts
- `run:evening`: `REPORT_MODE=evening`, `COMMUNITY_LOOKBACK_HOURS=8`, smaller community counts

## 4. Implemented Components

### Community Crawlers

Files:

- `src/community/crawl-fmkorea.ts`
- `src/community/crawl-dcinside.ts`
- `src/community/crawl-naver-discussion.ts`

Implemented:

- FMKorea stock board crawler.
- DCInside Korean stock and US stock gallery crawler.
- Naver Finance stock discussion crawler for current portfolio symbols.
- Env-based max counts:
  - `FMKOREA_MAX_POSTS`
  - `DCINSIDE_MAX_POSTS`
  - `NAVER_DISCUSSION_MAX_POSTS`
  - fallback: `COMMUNITY_MAX_POSTS`
- DCInside category/relevance/noise filtering was improved earlier.
- Naver discussion supports ETF-like alphanumeric Naver codes from `portfolio.json`.

Known limitation:

- Some source code and older output display Korean mojibake in PowerShell, but JSON values collected from recent runs are generally usable.
- Naver discussion currently collects list data only. It does not open each post body.

### News Collection

File:

- `src/news/collect-naver-news.ts`

Implemented:

- First tries Naver Finance item news.
- If finance news returns 0 rows, falls back to Naver news search.
- Handles Naver Finance EUC-KR decoding.
- Uses stock/sector aliases for relatedness filtering.
- Uses multiple fallback search queries for ETFs and theme products.
- Excludes obvious unrelated news keywords.
- Deduplicates by URL.
- Default: up to 10 news items per portfolio position.

Recent validation:

- `npm.cmd run collect:news` collected 60 items: 6 portfolio positions x 10 items.

Known limitation:

- Naver search page structure can change.
- News sentiment is keyword-based, not model-based.
- ETF news uses theme proxies, so it can include broader sector news rather than exact ETF-only articles.

### Market Collection

File:

- `src/market/collect-market.ts`

Implemented via Yahoo Finance chart endpoint:

- Korean indices: `^KS11`, `^KQ11`
- Korean derivatives proxies:
  - `^KS200` as KOSPI200 proxy
  - `229200.KS` as KODEX KOSDAQ150 proxy
- Korean portfolio stocks: Samsung Electronics, SK Hynix, Hyundai Motor, NAVER
- US futures: `NQ=F`, `ES=F`, `YM=F`, `RTY=F`, `NKD=F`
- US indices/stocks: NASDAQ Composite, SOX, VIX, NVDA, MU, AMD
- FX/commodities: USD/KRW, WTI, Brent
- Adds `modeFocus` depending on `REPORT_MODE`.
- Adds `unavailableData` metadata for missing direct NXT and Korean overnight futures sources.

Known limitation:

- NXT individual stock traded prices are not implemented.
- Direct KOSPI/KOSDAQ overnight futures are not implemented.
- Current Korean overnight-related values are proxies, not direct futures.

### Report Input Builder

File:

- `src/analysis/build-report-input.ts`

Implemented:

- Combines latest community, news, market, and portfolio files.
- Adds:
  - `mode`
  - `communityWindow`
  - `communityFilter`
  - `files.newsFile`
  - `news`
- Applies actual community time filtering using `createdAt` when parseable.
- Keeps posts with unknown/unparseable timestamps to avoid accidentally dropping whole sources.

Current filter behavior:

- Mode: `createdAt-or-keep-unknown`
- Parseable timestamps outside the lookback window are excluded.
- Unparseable timestamps are preserved and counted in `unknownTimestampCount`.

Recent validation:

- Evening run example: 153 original community posts -> 86 retained, 67 excluded, 0 unknown timestamp.
- Morning run example: 153 original community posts -> 139 retained.

### Analysis

File:

- `src/analysis/analyze-report-input.ts`

Implemented:

- Local rule-based analysis.
- Stance classification: `bullish`, `bearish`, `neutral`, `meme`.
- Evidence tags and quality scoring.
- Market alignment scoring.
- Portfolio impact split into:
  - direct affected positions
  - macro affected positions
- Mode-aware strategy headline/rationale for morning/evening/daily.
- News signal aggregation:
  - bullish news count
  - bearish news count
  - neutral news count
  - top bearish/bullish news
  - per-position news signal counts
- Markdown report includes:
  - mode
  - community window
  - community filter stats
  - news top items
  - position rules

Known limitation:

- Analysis is still rule/keyword based.
- Korean mojibake exists in some older hardcoded strings. Recent additions are mostly normal Korean.
- `High confidence` can be 0 after time filtering because stricter windows reduce older high-signal posts.

## 5. Latest Verification Performed

Commands run successfully:

```powershell
npm.cmd exec -- tsc --noEmit
npm.cmd run collect:news
npm.cmd run collect:market
npm.cmd run build:report-input
npm.cmd run analyze:local
npm.cmd run run:morning
npm.cmd run run:evening
```

Latest full evening run succeeded.

Observed latest evening summary:

- Mode: `evening`
- Community filter: 153 original, 86 retained, 67 excluded
- News: 60 items
- Market proxy items: 2 Korean derivatives proxies
- US futures tracked: `NQ=F`, `ES=F`, `YM=F`, `RTY=F`, `NKD=F`
- Headline: evening strategy generated successfully

## 6. Important Data Files

Tracked:

- `data/input/portfolio.json`

Ignored by git:

- `node_modules/`
- `playwright/.auth/`
- `data/raw/`
- `data/output/`
- `.env`

Generated outputs are local only and not pushed.

## 7. Current Portfolio Input

Portfolio file:

- `data/input/portfolio.json`

Positions currently include:

- SK Hynix: `000660.KS`
- Hyundai Motor: `005380.KS`
- Samsung Electronics: `005930.KS`
- TIGER Korea AI power equipment ETF: `0117V0`
- SOL AI semiconductor TOP2 ETF: `0167A0`
- NAVER: `035420.KS`

Note:

- Some names may display mojibake depending on terminal encoding.

## 8. Highest Priority Next Tasks

### 1. Fix Korean Encoding / Mojibake

Several source files contain hardcoded Korean strings that appear corrupted in PowerShell and in some outputs.

Recommended approach:

- Normalize source files to UTF-8.
- Replace mojibake hardcoded strings in:
  - `src/community/crawl-fmkorea.ts`
  - `src/community/crawl-dcinside.ts`
  - `src/community/crawl-naver-discussion.ts`
  - `src/market/collect-market.ts`
  - `src/analysis/analyze-report-input.ts`
  - `data/input/portfolio.json`
- Avoid changing behavior while doing this.
- Run full typecheck and at least one full pipeline after cleanup.

### 2. Add Robust Unit Tests For Pure Logic

Add tests for:

- `parseCommunityTime`
- community lookback filtering
- news relatedness filtering
- news signal classification
- market regime classification

This will make future rule changes safer.

### 3. Improve Naver Discussion Body Collection

Current Naver discussion crawler collects list rows only.

Next improvement:

- Open each `board_read.naver` URL.
- Capture body text.
- Improve direct signal analysis from full text, not just title/list row.

Risk:

- More requests, slower run.
- Need delay/throttle.

### 4. Find Reliable NXT / Korean Overnight Futures Sources

Current state:

- NXT direct prices: not implemented.
- KOSPI/KOSDAQ overnight futures: not implemented.
- Current system uses KOSPI200 and KOSDAQ150 ETF proxies.

Next source discovery targets:

- KRX public pages/APIs
- NXT public pages
- brokerage APIs
- paid market data APIs

Implementation should include source metadata and clear distinction between direct data and proxy data.

### 5. Improve Analysis Quality

Current analysis is rule-based.

Next steps:

- Add stronger Korean keyword normalization.
- Add source weighting by community and board.
- Add recency weighting inside the lookback window.
- Penalize meme/noise posts more aggressively.
- Improve morning/evening strategy templates:
  - Morning: US close, US futures, NXT/pre-market, expected same-day strategy
  - Evening: NXT/after-hours, Korean overnight proxies, US futures early flow, next-day strategy

### 6. Add Daily Run Documentation

Create a short user-facing `README.md` with:

- install
- commands
- environment variables
- output locations
- caveats

The current handoff is developer-oriented; a README would make normal use easier.

## 9. Suggested Next Session Starting Point

Recommended first task in the next environment:

1. Pull latest `main`.
2. Run:

```powershell
npm.cmd install
npm.cmd exec -- tsc --noEmit
npm.cmd run run:evening
```

3. Inspect latest:

```powershell
Get-ChildItem data\output | Sort-Object LastWriteTime -Descending | Select-Object -First 10 Name,Length,LastWriteTime
```

4. Start with encoding cleanup or test coverage before adding more crawler behavior.

## 10. Operational Caveats

- Network access is required for all crawl/collect scripts.
- Playwright is required for FMKorea and DCInside crawlers.
- Yahoo Finance chart endpoint is unofficial and may fail/change.
- Naver search HTML structure can change.
- This is a decision-support report generator, not a trading system.
- Generated report should be verified against brokerage/official data before making trades.

export type ReportMode = 'daily' | 'morning' | 'midday' | 'preclose' | 'evening';

export type MarketPhase =
  | 'korea_preopen'
  | 'korea_regular'
  | 'korea_closing'
  | 'korea_after_market'
  | 'us_premarket'
  | 'us_regular'
  | 'overnight';

export type ResolvedReportConfig = {
  requestedMode: string;
  mode: ReportMode;
  marketPhase: MarketPhase;
  isAutoMode: boolean;
  lookbackHours: number;
  fmkoreaMaxPosts: number;
  dcinsideMaxPosts: number;
  naverDiscussionMaxPosts: number;
  naverDiscussionBodyMaxPosts?: number;
  communityScanMaxPages: number;
};

function getKstMinuteOfDay(date: Date): number {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

function isBetween(minute: number, start: number, end: number): boolean {
  return minute >= start && minute < end;
}

function isBetweenOverMidnight(minute: number, start: number, end: number): boolean {
  return minute >= start || minute < end;
}

function detectMode(minute: number): ReportMode {
  if (isBetween(minute, 5 * 60, 10 * 60 + 30)) return 'morning';
  if (isBetween(minute, 10 * 60 + 30, 14 * 60 + 30)) return 'midday';
  if (isBetween(minute, 14 * 60 + 30, 16 * 60)) return 'preclose';
  return 'evening';
}

function detectMarketPhase(minute: number): MarketPhase {
  if (isBetweenOverMidnight(minute, 22 * 60 + 30, 5 * 60)) return 'us_regular';
  if (isBetween(minute, 5 * 60, 9 * 60)) return 'korea_preopen';
  if (isBetween(minute, 9 * 60, 14 * 60 + 30)) return 'korea_regular';
  if (isBetween(minute, 14 * 60 + 30, 15 * 60 + 30)) return 'korea_closing';
  if (isBetween(minute, 15 * 60 + 30, 22 * 60 + 30)) return 'korea_after_market';
  return 'overnight';
}

function defaultsForMode(mode: ReportMode): Omit<
  ResolvedReportConfig,
  'requestedMode' | 'mode' | 'marketPhase' | 'isAutoMode' | 'communityScanMaxPages'
> {
  if (mode === 'morning') {
    return {
      lookbackHours: 14,
      fmkoreaMaxPosts: 30,
      dcinsideMaxPosts: 30,
      naverDiscussionMaxPosts: 20,
    };
  }

  if (mode === 'midday') {
    return {
      lookbackHours: 5,
      fmkoreaMaxPosts: 20,
      dcinsideMaxPosts: 20,
      naverDiscussionMaxPosts: 10,
      naverDiscussionBodyMaxPosts: 5,
    };
  }

  if (mode === 'preclose') {
    return {
      lookbackHours: 3,
      fmkoreaMaxPosts: 15,
      dcinsideMaxPosts: 15,
      naverDiscussionMaxPosts: 10,
      naverDiscussionBodyMaxPosts: 5,
    };
  }

  if (mode === 'evening') {
    return {
      lookbackHours: 8,
      fmkoreaMaxPosts: 25,
      dcinsideMaxPosts: 25,
      naverDiscussionMaxPosts: 15,
    };
  }

  return {
    lookbackHours: 12,
    fmkoreaMaxPosts: 10,
    dcinsideMaxPosts: 10,
    naverDiscussionMaxPosts: 10,
  };
}

function parseMode(value: string): ReportMode | null {
  if (['daily', 'morning', 'midday', 'preclose', 'evening'].includes(value)) {
    return value as ReportMode;
  }
  return null;
}

export function resolveReportConfig(date = new Date(), env = process.env): ResolvedReportConfig {
  const requestedMode = env.REPORT_MODE ?? 'auto';
  const minute = getKstMinuteOfDay(date);
  const autoDetectedMode = detectMode(minute);
  const explicitMode = requestedMode === 'auto' ? null : parseMode(requestedMode);
  const mode = explicitMode ?? autoDetectedMode;
  const defaults = defaultsForMode(mode);

  return {
    requestedMode,
    mode,
    marketPhase: detectMarketPhase(minute),
    isAutoMode: !explicitMode,
    lookbackHours: Number(env.COMMUNITY_LOOKBACK_HOURS ?? defaults.lookbackHours),
    fmkoreaMaxPosts: Number(env.FMKOREA_MAX_POSTS ?? env.COMMUNITY_MAX_POSTS ?? defaults.fmkoreaMaxPosts),
    dcinsideMaxPosts: Number(env.DCINSIDE_MAX_POSTS ?? env.COMMUNITY_MAX_POSTS ?? defaults.dcinsideMaxPosts),
    naverDiscussionMaxPosts: Number(
      env.NAVER_DISCUSSION_MAX_POSTS ?? env.COMMUNITY_MAX_POSTS ?? defaults.naverDiscussionMaxPosts,
    ),
    naverDiscussionBodyMaxPosts:
      env.NAVER_DISCUSSION_BODY_MAX_POSTS !== undefined
        ? Number(env.NAVER_DISCUSSION_BODY_MAX_POSTS)
        : defaults.naverDiscussionBodyMaxPosts,
    communityScanMaxPages: Number(env.COMMUNITY_SCAN_MAX_PAGES ?? 3),
  };
}

export function getCommunityWindow(date = new Date(), env = process.env): {
  from: Date;
  to: Date;
  lookbackHours: number;
} {
  const config = resolveReportConfig(date, env);
  return {
    from: new Date(date.getTime() - config.lookbackHours * 60 * 60 * 1000),
    to: date,
    lookbackHours: config.lookbackHours,
  };
}

export function parseCommunityTime(value: string | null | undefined, referenceDate = new Date()): Date | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

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

  const yyMmDd = raw.match(/^(\d{2})[.-](\d{1,2})[.-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (yyMmDd) {
    const [, year, month, day, hour, minute, second] = yyMmDd;
    return new Date(
      2000 + Number(year),
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

  const relative = raw.match(/(\d+)\s*(분|시간|일|minute|minutes|hour|hours|day|days)/i);
  if (relative) {
    const [, amountText, unitText] = relative;
    const amount = Number(amountText);
    const unit = unitText.toLowerCase();
    const ms =
      unit === '분' || unit.startsWith('minute')
        ? amount * 60 * 1000
        : unit === '시간' || unit.startsWith('hour')
          ? amount * 60 * 60 * 1000
          : amount * 24 * 60 * 60 * 1000;
    return new Date(referenceDate.getTime() - ms);
  }

  const iso = Date.parse(raw);
  if (Number.isFinite(iso)) return new Date(iso);

  return null;
}

export function isWithinCommunityWindow(
  value: string | null | undefined,
  window: { from: Date; to: Date },
  referenceDate = window.to,
): boolean | null {
  const parsed = parseCommunityTime(value, referenceDate);
  if (!parsed) return null;
  return parsed >= window.from && parsed <= window.to;
}

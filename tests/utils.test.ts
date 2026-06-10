import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatKstDateTime, formatKstTimestampId } from '../src/utils/file';
import {
  isWithinCommunityWindow,
  parseCommunityTime,
  resolveReportConfig,
} from '../src/utils/report-mode';

describe('KST file timestamp formatting', () => {
  it('formats KST datetimes from UTC input', () => {
    const date = new Date('2026-06-09T20:00:00.123Z');

    assert.equal(formatKstDateTime(date), '2026-06-10T05:00:00+09:00');
    assert.equal(formatKstTimestampId(date), '20260610050000123');
  });

  it('keeps millisecond precision in timestamp IDs', () => {
    const first = new Date('2026-06-09T20:00:00.001Z');
    const second = new Date('2026-06-09T20:00:00.002Z');

    assert.notEqual(formatKstTimestampId(first), formatKstTimestampId(second));
    assert.equal(formatKstTimestampId(first).length, 17);
  });
});

describe('report mode auto detection', () => {
  it('detects morning mode and Korea preopen at 05:00 KST', () => {
    const config = resolveReportConfig(new Date('2026-06-09T20:00:00.000Z'), {});

    assert.equal(config.requestedMode, 'auto');
    assert.equal(config.mode, 'morning');
    assert.equal(config.marketPhase, 'korea_preopen');
    assert.equal(config.lookbackHours, 14);
  });

  it('uses US regular market phase during the KST overnight window', () => {
    const config = resolveReportConfig(new Date('2026-06-09T17:00:00.000Z'), {});

    assert.equal(config.mode, 'evening');
    assert.equal(config.marketPhase, 'us_regular');
  });

  it('honors explicit report mode while still detecting market phase', () => {
    const config = resolveReportConfig(new Date('2026-06-10T03:00:00.000Z'), {
      REPORT_MODE: 'preclose',
      COMMUNITY_LOOKBACK_HOURS: '2',
    });

    assert.equal(config.requestedMode, 'preclose');
    assert.equal(config.mode, 'preclose');
    assert.equal(config.marketPhase, 'korea_regular');
    assert.equal(config.isAutoMode, false);
    assert.equal(config.lookbackHours, 2);
  });
});

describe('community time parsing and window filtering', () => {
  const referenceDate = new Date('2026-06-10T12:00:00+09:00');

  it('parses common absolute community timestamp formats', () => {
    assert.equal(parseCommunityTime('2026.06.10 11:30', referenceDate)?.getTime(), new Date(2026, 5, 10, 11, 30).getTime());
    assert.equal(parseCommunityTime('26.06.10 11:30:05', referenceDate)?.getTime(), new Date(2026, 5, 10, 11, 30, 5).getTime());
    assert.equal(parseCommunityTime('06.10 11:30', referenceDate)?.getTime(), new Date(2026, 5, 10, 11, 30).getTime());
  });

  it('parses English relative community timestamps', () => {
    assert.equal(parseCommunityTime('15 minutes ago', referenceDate)?.getTime(), referenceDate.getTime() - 15 * 60 * 1000);
    assert.equal(parseCommunityTime('2 hours ago', referenceDate)?.getTime(), referenceDate.getTime() - 2 * 60 * 60 * 1000);
    assert.equal(parseCommunityTime('1 day ago', referenceDate)?.getTime(), referenceDate.getTime() - 24 * 60 * 60 * 1000);
  });

  it('returns tri-state community window decisions', () => {
    const window = {
      from: new Date('2026-06-10T10:00:00+09:00'),
      to: referenceDate,
    };

    assert.equal(isWithinCommunityWindow('06.10 11:30', window, referenceDate), true);
    assert.equal(isWithinCommunityWindow('06.10 09:30', window, referenceDate), false);
    assert.equal(isWithinCommunityWindow(null, window, referenceDate), null);
  });
});

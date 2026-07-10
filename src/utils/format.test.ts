import { describe, it, expect } from 'vitest';
import { fmtQty, fmtNum, titleCase, fmtDate, fmtTime } from './format';

describe('fmtQty / fmtNum', () => {
  it('formats quantities with a unit and thousands separators', () => {
    expect(fmtQty(12000)).toBe('12,000 L');
    expect(fmtQty(500, 'gal')).toBe('500 gal');
  });
  it('formats plain numbers', () => {
    expect(fmtNum(1234567)).toBe('1,234,567');
  });
});

describe('titleCase', () => {
  it('replaces underscores and capitalises each word', () => {
    expect(titleCase('in_transit')).toBe('In Transit');
    expect(titleCase('on_shift')).toBe('On Shift');
  });
});

describe('fmtDate', () => {
  it('formats a date-only string', () => {
    expect(fmtDate('2026-07-10')).toMatch(/2026/);
  });
  it('formats a full ISO timestamp', () => {
    expect(fmtDate('2026-07-10T08:30:00.000Z')).toMatch(/2026/);
  });
});

describe('fmtTime', () => {
  it('formats an ISO timestamp as hh:mm', () => {
    expect(fmtTime('2026-07-10T08:30:00')).toMatch(/\d{1,2}:\d{2}/);
  });
  it('renders a dash for empty/null input', () => {
    expect(fmtTime()).toBe('—');
    expect(fmtTime(null)).toBe('—');
  });
});

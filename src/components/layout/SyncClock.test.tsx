import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncClock } from './SyncClock';
import { today } from '@/utils/clock';
import { fmtDate } from '@/utils/format';

describe('SyncClock', () => {
  it("renders today's date, formatted", () => {
    render(<SyncClock />);
    expect(screen.getByText(fmtDate(today()))).toBeInTheDocument();
  });
});

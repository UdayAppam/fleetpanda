import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

function ToastProbe() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Saved')}>ok</button>
      <button onClick={() => toast.error('Nope')}>err</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ToastProvider>
      <ToastProbe />
    </ToastProvider>,
  );
}

describe('ToastContext', () => {
  it('shows a toast message in the live region', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('ok'));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('dismisses a toast when its close button is clicked', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('err'));
    expect(screen.getByText('Nope')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Nope')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the timeout', async () => {
    vi.useFakeTimers();
    try {
      render(
        <ToastProvider>
          <ToastProbe />
        </ToastProvider>,
      );
      act(() => {
        screen.getByText('ok').click();
      });
      expect(screen.getByText('Saved')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4600);
      });
      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws when used outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastProbe />)).toThrow(/useToast must be used within/i);
    vi.restoreAllMocks();
  });
});

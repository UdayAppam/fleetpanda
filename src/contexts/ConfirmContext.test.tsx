import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmProvider, useConfirm } from './ConfirmContext';

function ConfirmProbe() {
  const confirm = useConfirm();
  const [result, setResult] = useState<string>('pending');
  return (
    <div>
      <span data-testid="result">{result}</span>
      <button
        onClick={async () => {
          const ok = await confirm({
            title: 'Delete order?',
            message: 'This cannot be undone.',
            confirmLabel: 'Delete',
            danger: true,
          });
          setResult(ok ? 'confirmed' : 'cancelled');
        }}
      >
        open
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <ConfirmProvider>
      <ConfirmProbe />
    </ConfirmProvider>,
  );
}

describe('ConfirmContext', () => {
  it('opens a dialog with the supplied title and message', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog', { name: 'Delete order?' })).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('resolves true when the confirm action is clicked', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('confirmed')).toBeInTheDocument();
  });

  it('resolves false when cancelled', async () => {
    renderProbe();
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(await screen.findByText('cancelled')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card, Spinner, Skeleton, EmptyState, ErrorState } from './misc';

describe('Card', () => {
  it('renders its children', () => {
    render(<Card>content</Card>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('exposes a status role and optional label', () => {
    render(<Spinner label="Loading…" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders the requested number of placeholder rows', () => {
    const { container } = render(<Skeleton rows={4} />);
    const wrap = container.querySelector('[aria-hidden="true"]');
    expect(wrap?.children).toHaveLength(4);
  });
});

describe('EmptyState', () => {
  it('renders title, hint and action', () => {
    render(<EmptyState title="No orders" hint="Create one" action={<button>New</button>} />);
    expect(screen.getByText('No orders')).toBeInTheDocument();
    expect(screen.getByText('Create one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('shows the message with an alert role', () => {
    render(<ErrorState message="Failed to load" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load');
  });

  it('renders a retry button only when onRetry is given', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState message="x" />);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();

    rerender(<ErrorState message="x" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

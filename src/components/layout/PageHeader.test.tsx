import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    render(<PageHeader title="Orders" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
  });

  it('renders the eyebrow and actions when provided', () => {
    render(<PageHeader eyebrow="Admin" title="Orders" actions={<button>New</button>} />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('omits the eyebrow when not provided', () => {
    render(<PageHeader title="Orders" />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});

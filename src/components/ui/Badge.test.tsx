import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, StatusBadge } from './Badge';

describe('Badge', () => {
  it('renders children with the given tone and title', () => {
    render(
      <Badge tone="crit" title="Critical">
        Low
      </Badge>,
    );
    const el = screen.getByText('Low');
    expect(el).toHaveAttribute('data-tone', 'crit');
    expect(el).toHaveAttribute('title', 'Critical');
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>Plain</Badge>);
    expect(screen.getByText('Plain')).toHaveAttribute('data-tone', 'neutral');
  });
});

describe('StatusBadge', () => {
  it('maps an order status to its tone and humanises underscores', () => {
    render(<StatusBadge status="in_transit" />);
    const el = screen.getByText('in transit');
    expect(el).toHaveAttribute('data-tone', 'warn');
  });

  it('maps delivered to the ok tone', () => {
    render(<StatusBadge status="delivered" />);
    expect(screen.getByText('delivered')).toHaveAttribute('data-tone', 'ok');
  });

  it('uses the map tone table when kind="map"', () => {
    render(<StatusBadge status="idle" kind="map" />);
    expect(screen.getByText('idle')).toHaveAttribute('data-tone', 'neutral');
  });

  it('falls back to neutral for an unknown status', () => {
    render(<StatusBadge status="mystery" />);
    expect(screen.getByText('mystery')).toHaveAttribute('data-tone', 'neutral');
  });
});

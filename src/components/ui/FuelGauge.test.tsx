import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FuelGauge } from './FuelGauge';
import type { Product } from '@/types';

const product: Product = {
  id: 'prod-diesel',
  key: 'diesel',
  name: 'Diesel',
  unit: 'L',
  lowStockThreshold: 5000,
  tankCapacity: 20000,
};

describe('FuelGauge', () => {
  it('shows the quantity formatted with thousands separators', () => {
    render(<FuelGauge qty={12000} product={product} />);
    expect(screen.getByText('12,000')).toBeInTheDocument();
  });

  it('marks the track "ok" when comfortably above threshold', () => {
    const { container } = render(<FuelGauge qty={15000} product={product} />);
    expect(container.querySelector('[data-level="ok"]')).not.toBeNull();
  });

  it('marks the track "crit" when below threshold', () => {
    const { container } = render(<FuelGauge qty={1000} product={product} />);
    expect(container.querySelector('[data-level="crit"]')).not.toBeNull();
  });

  it('exposes a capacity tooltip', () => {
    render(<FuelGauge qty={12000} product={product} />);
    expect(screen.getByTitle('12,000 / 20,000 L')).toBeInTheDocument();
  });
});

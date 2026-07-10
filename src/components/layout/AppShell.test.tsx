import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './AppShell';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';

beforeEach(() => resetDb());

function renderShell(variant: 'admin' | 'driver') {
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell variant={variant} />}>
        <Route path="/" element={<div>page body</div>} />
      </Route>
    </Routes>,
  );
}

describe('AppShell', () => {
  it('renders the brand and the admin navigation', () => {
    renderShell('admin');
    expect(screen.getByText('FleetPanda')).toBeInTheDocument();
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /fleet map/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /master data/i })).toBeInTheDocument();
  });

  it('renders the driver navigation for the driver variant', () => {
    renderShell('driver');
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /shift/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /history/i })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /orders/i })).not.toBeInTheDocument();
  });

  it('renders the routed outlet content', () => {
    renderShell('admin');
    expect(screen.getByText('page body')).toBeInTheDocument();
  });
});

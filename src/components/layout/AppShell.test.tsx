import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './AppShell';
import { renderWithProviders, makeStore } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';
import { loginSuccess } from '@/store/slices/authSlice';

beforeEach(() => resetDb());
afterEach(() => {
  // Remove the matchMedia stub so it can't leak into other tests.
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderShell(
  variant: 'admin' | 'driver',
  { route = '/', store = makeStore() } = {},
) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell variant={variant} />}>
        <Route path="/" element={<div>page body</div>} />
        <Route path="/admin" element={<div>admin home</div>} />
        <Route path="/admin/orders" element={<div>orders body</div>} />
        <Route path="/admin/map" element={<div>map body</div>} />
        <Route path="/driver" element={<div>driver home</div>} />
      </Route>
    </Routes>,
    { route, store },
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

  it('shows the signed-in user name in the top bar', () => {
    const store = makeStore();
    store.dispatch(
      loginSuccess({
        user: { id: 'u1', email: 'dana@fleetpanda.com', name: 'Dana', role: 'admin' },
        token: 'tok',
      }),
    );
    renderShell('admin', { store });
    expect(screen.getByText('Dana')).toBeInTheDocument();
  });

  it('marks the nav link for the current route as active', () => {
    renderShell('admin', { route: '/admin/orders' });
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /orders/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('toggles the desktop sidebar rail from the hamburger button', async () => {
    setMatchMedia(false);
    const store = makeStore();
    renderShell('admin', { store });
    expect(store.getState().ui.sidebarCollapsed).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /toggle navigation/i }));
    expect(store.getState().ui.sidebarCollapsed).toBe(true);
  });

  it('opens and closes the mobile drawer via the hamburger and scrim', async () => {
    setMatchMedia(true);
    const { container } = renderShell('admin');
    const shell = container.querySelector('[data-variant="admin"]') as HTMLElement;
    expect(shell).toHaveAttribute('data-mobile-open', 'false');

    await userEvent.click(screen.getByRole('button', { name: /toggle navigation/i }));
    expect(shell).toHaveAttribute('data-mobile-open', 'true');

    // When open, the scrim is rendered between the sidebar and the main column.
    const scrim = shell.children[1] as HTMLElement;
    await userEvent.click(scrim);
    expect(shell).toHaveAttribute('data-mobile-open', 'false');
  });

  it('closes the mobile drawer when a nav link is clicked', async () => {
    setMatchMedia(true);
    const { container } = renderShell('admin');
    const shell = container.querySelector('[data-variant="admin"]') as HTMLElement;

    await userEvent.click(screen.getByRole('button', { name: /toggle navigation/i }));
    expect(shell).toHaveAttribute('data-mobile-open', 'true');

    const nav = screen.getByRole('navigation');
    await userEvent.click(within(nav).getByRole('link', { name: /fleet map/i }));
    expect(shell).toHaveAttribute('data-mobile-open', 'false');
  });
});

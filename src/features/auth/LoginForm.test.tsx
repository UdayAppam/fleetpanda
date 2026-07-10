import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';
import { api } from '@/api/endpoints';

// A configurable router seam so a single test can supply a `loc.state.from` and assert navigation.
const rr = vi.hoisted(() => ({ navSpy: vi.fn(), locState: null as unknown }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => rr.navSpy,
    useLocation: () => ({ pathname: '/login', search: '', hash: '', key: 'test', state: rr.locState }),
  };
});

beforeEach(() => {
  resetDb();
  rr.navSpy.mockClear();
  rr.locState = null;
});
afterEach(() => vi.restoreAllMocks());

describe('LoginForm', () => {
  it('validates required email/password', async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it('quick-login chip fills credentials and signs in', async () => {
    const { store } = renderWithProviders(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Admin' }));
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(store.getState().auth.user?.role).toBe('admin'));
    // With no `from` in location state, it lands on the role home.
    expect(rr.navSpy).toHaveBeenCalledWith('/admin', { replace: true });
  });

  it('redirects to the original destination captured in location state', async () => {
    rr.locState = { from: '/admin/reports' };
    renderWithProviders(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Admin' }));
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(rr.navSpy).toHaveBeenCalledWith('/admin/reports', { replace: true }));
  });

  it('shows an error on bad credentials', async () => {
    renderWithProviders(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@fleetpanda.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/invalid/i)).toBeInTheDocument();
  });

  it('shows a generic message when login fails with a non-ApiError', async () => {
    vi.spyOn(api, 'login').mockRejectedValue(new Error('network down'));
    renderWithProviders(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Admin' }));
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });
});

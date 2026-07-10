import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth, roleHome } from './AuthContext';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';

beforeEach(() => resetDb());

function AuthProbe() {
  const { user, role, isAuthed, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="authed">{String(isAuthed)}</span>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="name">{user?.name ?? 'anon'}</span>
      <button onClick={() => login('admin@fleetpanda.com', 'admin123')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  it('starts unauthenticated', () => {
    renderWithProviders(<AuthProbe />);
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(screen.getByTestId('role')).toHaveTextContent('none');
  });

  it('logs in through the API and exposes the user/role', async () => {
    renderWithProviders(<AuthProbe />);
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(screen.getByTestId('name')).toHaveTextContent('Dana');
  });

  it('logs out again', async () => {
    renderWithProviders(<AuthProbe />);
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
    await userEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });

  it('throws when useAuth is called outside an AuthProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/within AuthProvider/);
    vi.restoreAllMocks();
  });
});

describe('roleHome', () => {
  it('routes drivers to /driver and everyone else to /admin', () => {
    expect(roleHome('driver')).toBe('/driver');
    expect(roleHome('admin')).toBe('/admin');
    expect(roleHome(null)).toBe('/admin');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, RoleRoute } from './guards';
import { makeStore } from '@/test/renderWithProviders';
import { AuthProvider } from '@/contexts/AuthContext';
import { loginSuccess } from '@/store/slices/authSlice';
import { resetDb } from '@/test/mswServer';
import type { User } from '@/types';

beforeEach(() => resetDb());

const admin: User = { id: 'u1', email: 'a@b.com', name: 'Dana', role: 'admin' };
const driver: User = { id: 'u2', email: 'd@b.com', name: 'John', role: 'driver', driverId: 'driver-1' };

function renderAt(route: string, user?: User) {
  const store = makeStore();
  if (user) store.dispatch(loginSuccess({ user, token: 't' }));
  return render(
    <Provider store={store}>
      <AuthProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/login" element={<div>login screen</div>} />
            <Route path="/admin" element={<div>admin home</div>} />
            <Route path="/driver" element={<div>driver home</div>} />
            <Route element={<ProtectedRoute />}>
              <Route element={<RoleRoute role="admin" />}>
                <Route path="/admin/secret" element={<div>admin secret</div>} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    renderAt('/admin/secret');
    expect(screen.getByText('login screen')).toBeInTheDocument();
  });

  it('lets an authenticated admin through', () => {
    renderAt('/admin/secret', admin);
    expect(screen.getByText('admin secret')).toBeInTheDocument();
  });
});

describe('RoleRoute', () => {
  it('redirects a driver away from an admin-only route to their home', () => {
    renderAt('/admin/secret', driver);
    expect(screen.getByText('driver home')).toBeInTheDocument();
  });
});

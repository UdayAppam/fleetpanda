import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { makeStore } from '@/test/renderWithProviders';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { loginSuccess } from '@/store/slices/authSlice';
import { resetDb } from '@/test/mswServer';
import type { User } from '@/types';

beforeEach(() => resetDb());

function renderLogin(user?: User) {
  const store = makeStore();
  if (user) store.dispatch(loginSuccess({ user, token: 't' }));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={['/login']}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin" element={<div>admin home</div>} />
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('LoginPage', () => {
  it('shows the login form when signed out', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('redirects to the role home when already signed in', () => {
    renderLogin({ id: 'u1', email: 'a@b.com', name: 'Dana', role: 'admin' });
    expect(screen.getByText('admin home')).toBeInTheDocument();
  });
});

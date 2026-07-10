import type { ReactElement, ReactNode } from 'react';
import { render, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import auth from '@/store/slices/authSlice';
import shift from '@/store/slices/shiftSlice';
import mapFilters from '@/store/slices/mapFiltersSlice';
import ui from '@/store/slices/uiSlice';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ConfirmProvider } from '@/contexts/ConfirmContext';
import { AuthProvider } from '@/contexts/AuthContext';

export function makeStore() {
  return configureStore({ reducer: { auth, shift, mapFilters, ui } });
}

type MakeWrapper = ReturnType<typeof makeStore>;

function buildWrapper(route: string, store: MakeWrapper) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>
                <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
              </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
}

export function renderWithProviders(
  element: ReactElement,
  { route = '/', store = makeStore() } = {},
) {
  const Wrapper = buildWrapper(route, store);
  return { store, ...render(element, { wrapper: Wrapper }) };
}

export function renderHookWithProviders<Result, Props>(
  hook: (initialProps: Props) => Result,
  { route = '/', store = makeStore() } = {},
) {
  const Wrapper = buildWrapper(route, store);
  return { store, ...renderHook(hook, { wrapper: Wrapper }) };
}

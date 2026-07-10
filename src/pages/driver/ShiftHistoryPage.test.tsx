import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import ShiftHistoryPage from './ShiftHistoryPage';
import { makeStore } from '@/test/renderWithProviders';
import { AuthProvider } from '@/contexts/AuthContext';
import { loginSuccess } from '@/store/slices/authSlice';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';
import type { User } from '@/types';

const driver: User = { id: 'u2', email: 'd@b.com', name: 'John', role: 'driver', driverId: 'driver-1' };

function renderPage() {
  const store = makeStore();
  store.dispatch(loginSuccess({ user: driver, token: 't' }));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter>
            <ShiftHistoryPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => resetDb());

describe('ShiftHistoryPage', () => {
  it('shows an empty state when there are no past shifts', async () => {
    renderPage();
    expect(await screen.findByText(/no past shifts yet/i)).toBeInTheDocument();
  });

  it('lists ended shifts with delivered/failed counts', async () => {
    getDb().shifts = [
      { id: 'shift-1', driverId: 'driver-1', vehicleId: 'vehicle-1', date: '2025-11-24', status: 'ended', startedAt: '2025-11-24T08:00:00', endedAt: '2025-11-24T16:00:00', orderIds: ['order-1', 'order-2'] },
    ];
    getDb().orders = [
      { id: 'order-1', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'delivered' },
      { id: 'order-2', sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000, deliveryDate: '2025-11-24', assignedDriverId: 'driver-1', status: 'failed' },
    ];
    renderPage();
    expect(await screen.findByText(/1 delivered/i)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument();
    expect(screen.getByText(/TRK-101/)).toBeInTheDocument();
  });

  it('sorts multiple ended shifts newest-first', async () => {
    getDb().shifts = [
      { id: 'shift-a', driverId: 'driver-1', vehicleId: 'vehicle-1', date: '2025-11-20', status: 'ended', startedAt: '2025-11-20T08:00:00', endedAt: '2025-11-20T16:00:00', orderIds: [] },
      { id: 'shift-b', driverId: 'driver-1', vehicleId: 'vehicle-1', date: '2025-11-24', status: 'ended', startedAt: '2025-11-24T08:00:00', endedAt: '2025-11-24T16:00:00', orderIds: [] },
      { id: 'shift-c', driverId: 'driver-1', vehicleId: 'vehicle-1', date: '2025-11-22', status: 'ended', startedAt: '2025-11-22T08:00:00', endedAt: '2025-11-22T16:00:00', orderIds: [] },
    ];
    renderPage();
    const dates = await screen.findAllByText(/Nov \d+, 2025/);
    const text = dates.map((d) => d.textContent);
    // newest date first (the comparator returns both 1 and -1)
    expect(text[0]).toMatch(/Nov 24/);
    expect(text[text.length - 1]).toMatch(/Nov 20/);
  });

  it('renders the empty state when the shifts and orders payloads are null', async () => {
    server.use(
      http.get(`${API_URL}/shifts`, () => HttpResponse.json(null)),
      http.get(`${API_URL}/orders`, () => HttpResponse.json(null)),
    );
    renderPage();
    expect(await screen.findByText(/no past shifts yet/i)).toBeInTheDocument();
  });
});

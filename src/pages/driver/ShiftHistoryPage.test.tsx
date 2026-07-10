import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ShiftHistoryPage from './ShiftHistoryPage';
import { makeStore } from '@/test/renderWithProviders';
import { AuthProvider } from '@/contexts/AuthContext';
import { loginSuccess } from '@/store/slices/authSlice';
import { resetDb, getDb } from '@/test/mswServer';
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
});

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import InventoryPage from './InventoryPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, getDb, server } from '@/test/mswServer';
import { API_URL } from '@/config/env';

beforeEach(() => resetDb());

describe('InventoryPage', () => {
  it('renders hubs with fuel gauges once loaded', async () => {
    renderWithProviders(<InventoryPage />);
    expect(await screen.findByText('Downtown')).toBeInTheDocument();
    expect(screen.getByText('Northgate')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
  });

  it('shows a below-minimum alert and filters to critical hubs', async () => {
    getDb().hubs[0].inventory.diesel = 500; // Downtown critical
    renderWithProviders(<InventoryPage />);
    expect(await screen.findByText(/below minimum/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /Critical/ }));
    expect(screen.getByText('Downtown')).toBeInTheDocument();
    expect(screen.queryByText('Northgate')).not.toBeInTheDocument();
  });

  it('filters hubs by the search box', async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText('Downtown');
    await userEvent.type(screen.getByLabelText('Search'), 'north');
    await waitFor(() => expect(screen.queryByText('Downtown')).not.toBeInTheDocument());
    expect(screen.getByText('Northgate')).toBeInTheDocument();
  });

  it('renders an error state when the hubs request fails', async () => {
    server.use(http.get(`${API_URL}/hubs`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderWithProviders(<InventoryPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/boom|failed/i);
  });
});

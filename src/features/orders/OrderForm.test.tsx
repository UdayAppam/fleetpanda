import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { API_URL } from '@/config/env';
import { OrderForm } from './OrderForm';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb, server } from '@/test/mswServer';

beforeEach(() => resetDb());

describe('OrderForm', () => {
  it('renders hub options once lookups load', async () => {
    renderWithProviders(<OrderForm onSubmit={() => {}} />);
    // Each hub appears as an option in both the source and destination selects.
    expect(await screen.findAllByRole('option', { name: 'Downtown' })).toHaveLength(2);
    expect(screen.getAllByRole('option', { name: 'Northgate' })).toHaveLength(2);
  });

  it('confirms when the source hub can cover the order', async () => {
    renderWithProviders(<OrderForm onSubmit={() => {}} />);
    await screen.findAllByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Source hub'), 'hub-1');
    await userEvent.selectOptions(screen.getByLabelText('Product'), 'diesel');
    await userEvent.type(screen.getByLabelText(/quantity/i), '5000');
    expect(await screen.findByText(/can cover this order/i)).toBeInTheDocument();
  });

  it('warns when the source hub is short on stock', async () => {
    renderWithProviders(<OrderForm onSubmit={() => {}} />);
    await screen.findAllByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Source hub'), 'hub-1');
    await userEvent.selectOptions(screen.getByLabelText('Product'), 'diesel');
    await userEvent.type(screen.getByLabelText(/quantity/i), '99000');
    expect(await screen.findByText(/short by/i)).toBeInTheDocument();
  });

  it('submits valid values', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<OrderForm onSubmit={onSubmit} />);
    await screen.findAllByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Source hub'), 'hub-1');
    await userEvent.selectOptions(screen.getByLabelText('Destination'), 'hub-3');
    await userEvent.selectOptions(screen.getByLabelText('Product'), 'diesel');
    await userEvent.type(screen.getByLabelText(/quantity/i), '5000');
    await userEvent.click(screen.getByRole('button', { name: /create order/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const [values] = onSubmit.mock.calls[0];
    expect(values).toMatchObject({ sourceId: 'hub-1', destinationId: 'hub-3', product: 'diesel', quantity: 5000 });
  });

  it('shows required-field errors for source, destination and quantity', async () => {
    renderWithProviders(<OrderForm onSubmit={() => {}} />);
    await screen.findAllByRole('option', { name: 'Downtown' });
    await userEvent.click(screen.getByRole('button', { name: /create order/i }));
    expect(await screen.findByText(/select a source/i)).toBeInTheDocument();
    expect(screen.getByText(/select a destination/i)).toBeInTheDocument();
    expect(screen.getByText(/quantity must be positive/i)).toBeInTheDocument();
  });

  it('shows a product error when no products are available', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json([])));
    renderWithProviders(<OrderForm onSubmit={() => {}} />);
    await screen.findAllByRole('option', { name: 'Downtown' });
    await userEvent.click(screen.getByRole('button', { name: /create order/i }));
    expect(await screen.findByText(/select a product/i)).toBeInTheDocument();
  });

  it('surfaces a delivery-date error when the date is cleared', async () => {
    renderWithProviders(<OrderForm onSubmit={() => {}} />);
    await screen.findAllByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Source hub'), 'hub-1');
    await userEvent.selectOptions(screen.getByLabelText('Destination'), 'hub-3');
    await userEvent.selectOptions(screen.getByLabelText('Product'), 'diesel');
    await userEvent.type(screen.getByLabelText(/quantity/i), '5000');
    await userEvent.clear(screen.getByLabelText('Delivery date'));
    await userEvent.click(screen.getByRole('button', { name: /create order/i }));
    expect(await screen.findByText(/pick a date/i)).toBeInTheDocument();
  });

  it('blocks submission when source equals destination', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<OrderForm onSubmit={onSubmit} />);
    await screen.findAllByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Source hub'), 'hub-1');
    await userEvent.selectOptions(screen.getByLabelText('Destination'), 'hub-1');
    await userEvent.selectOptions(screen.getByLabelText('Product'), 'diesel');
    await userEvent.type(screen.getByLabelText(/quantity/i), '5000');
    await userEvent.click(screen.getByRole('button', { name: /create order/i }));
    expect(await screen.findByText(/source and destination must differ/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

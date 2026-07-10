import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from './UserMenu';
import { renderWithProviders } from '@/test/renderWithProviders';
import { resetDb } from '@/test/mswServer';

beforeEach(() => resetDb());

describe('UserMenu', () => {
  it('shows the avatar initial and maps the admin role to "Dispatcher"', () => {
    renderWithProviders(<UserMenu name="Dana" role="admin" />);
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('Dispatcher')).toBeInTheDocument();
  });

  it('labels a driver role as "Driver"', () => {
    renderWithProviders(<UserMenu name="John" role="driver" />);
    expect(screen.getByText('Driver')).toBeInTheDocument();
  });

  it('opens the dropdown and reveals a log-out action', async () => {
    renderWithProviders(<UserMenu name="Dana" role="admin" />);
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Dana'));
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });

  it('cycles the theme, updating the button label', async () => {
    renderWithProviders(<UserMenu name="Dana" role="admin" />);
    expect(screen.getByLabelText('Theme: system')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Theme: system'));
    expect(screen.getByLabelText('Theme: light')).toBeInTheDocument();
  });

  it('logs out, clearing auth state', async () => {
    const { store } = renderWithProviders(<UserMenu name="Dana" role="admin" />);
    await userEvent.click(screen.getByText('Dana'));
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(store.getState().auth.user).toBeNull();
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTheme } from './ThemeContext';
import { renderWithProviders } from '@/test/renderWithProviders';

function ThemeProbe() {
  const { theme, cycle, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={cycle}>cycle</button>
      <button onClick={() => setTheme('dark')}>go dark</button>
    </div>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  vi.restoreAllMocks();
});

describe('ThemeContext', () => {
  it('defaults to the system theme and clears the data-theme attribute', () => {
    renderWithProviders(<ThemeProbe />);
    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('cycles system → light → dark and reflects it on the root element', async () => {
    renderWithProviders(<ThemeProbe />);
    await userEvent.click(screen.getByText('cycle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    await userEvent.click(screen.getByText('cycle'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets a specific theme directly', async () => {
    renderWithProviders(<ThemeProbe />);
    await userEvent.click(screen.getByText('go dark'));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
  });

  it('throws when used outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeProbe />)).toThrow(/useTheme must be used within/i);
  });
});

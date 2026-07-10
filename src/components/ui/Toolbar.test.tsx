import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar, FilterChips } from './Toolbar';

describe('Toolbar', () => {
  it('renders a search box only when onSearch is provided', () => {
    const { rerender } = render(<Toolbar />);
    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
    rerender(<Toolbar onSearch={() => {}} />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('emits each keystroke through onSearch', async () => {
    const onSearch = vi.fn();
    render(<Toolbar onSearch={onSearch} />);
    await userEvent.type(screen.getByLabelText('Search'), 'ab');
    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith('b');
  });

  it('renders children and actions', () => {
    render(<Toolbar actions={<button>Add</button>}>{<span>child</span>}</Toolbar>);
    expect(screen.getByText('child')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('FilterChips', () => {
  const options = [
    { value: 'all', label: 'All', count: 5 },
    { value: 'open', label: 'Open', count: 2 },
  ] as const;

  it('marks the active option via aria-selected', () => {
    render(<FilterChips options={[...options]} value="open" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /Open/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows counts and fires onChange with the chosen value', async () => {
    const onChange = vi.fn();
    render(<FilterChips options={[...options]} value="all" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: /All/ })).toHaveTextContent('5');
    await userEvent.click(screen.getByRole('tab', { name: /Open/ }));
    expect(onChange).toHaveBeenCalledWith('open');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, type Column } from './Table';

interface Row {
  id: string;
  name: string;
}

const columns: Column<Row>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }];
const rowKey = (r: Row) => r.id;
const makeRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }));

describe('Table', () => {
  it('renders a skeleton while loading', () => {
    const { container } = render(
      <Table columns={columns} rows={[]} rowKey={rowKey} loading />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders an error state with a working retry button', async () => {
    const onRetry = vi.fn();
    render(
      <Table columns={columns} rows={[]} rowKey={rowKey} error="Boom" onRetry={onRetry} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders the default empty state when there are no rows', () => {
    render(<Table columns={columns} rows={[]} rowKey={rowKey} />);
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders a custom empty node when provided', () => {
    render(
      <Table columns={columns} rows={[]} rowKey={rowKey} empty={<div>All caught up</div>} />,
    );
    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('renders rows and their cells', () => {
    render(<Table columns={columns} rows={makeRows(3)} rowKey={rowKey} />);
    expect(screen.getByText('Row 0')).toBeInTheDocument();
    expect(screen.getByText('Row 2')).toBeInTheDocument();
  });

  it('paginates when rows exceed the page size', async () => {
    render(<Table columns={columns} rows={makeRows(12)} rowKey={rowKey} pageSize={10} />);
    expect(screen.getByText('Row 0')).toBeInTheDocument();
    expect(screen.queryByText('Row 10')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText('Row 10')).toBeInTheDocument();
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument();
  });

  it('disables the previous button on the first page', () => {
    render(<Table columns={columns} rows={makeRows(12)} rowKey={rowKey} pageSize={10} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });
});

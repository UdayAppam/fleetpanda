import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton, EmptyState, ErrorState } from './misc';
import styles from './Table.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: ReactNode;
  pageSize?: number;
}

export function Table<T>({ columns, rows, rowKey, loading, error, onRetry, empty, pageSize = 10 }: Props<T>) {
  const [page, setPage] = useState(0);
  // Reset to the first page when the (filtered) result set changes.
  const sig = rows.map(rowKey).join('|');
  useEffect(() => setPage(0), [sig]);

  if (loading) return <Skeleton rows={6} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (rows.length === 0)
    return <>{empty ?? <EmptyState title="Nothing here yet" hint="Create your first record." />}</>;

  const pageCount = Math.ceil(rows.length / pageSize);
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const visible = rows.slice(start, start + pageSize);

  return (
    <>
      <div className={`${styles.wrap} scroll`}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} data-align={c.align ?? 'left'} style={c.width ? { ['--col-w' as string]: c.width } : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} data-align={c.align ?? 'left'}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > pageSize && (
        <div className={styles.pager}>
          <span className={styles.pagerInfo}>
            {start + 1}–{Math.min(start + pageSize, rows.length)} of {rows.length}
          </span>
          <div className={styles.pagerNav}>
            <button
              className={styles.pagerBtn}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.pagerPage}>
              {current + 1} / {pageCount}
            </span>
            <button
              className={styles.pagerBtn}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

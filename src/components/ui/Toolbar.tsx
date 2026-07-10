import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import styles from './Toolbar.module.css';

export function Toolbar({
  search,
  onSearch,
  placeholder = 'Search…',
  children,
  actions,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.bar}>
      {onSearch && (
        <div className={styles.searchBox}>
          <Search size={16} />
          <input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            aria-label="Search"
          />
        </div>
      )}
      {children}
      <div className={styles.spacer} />
      {actions}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.chips} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={styles.chip}
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count != null && <span className={styles.count}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

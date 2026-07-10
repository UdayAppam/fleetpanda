import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Toolbar, FilterChips } from '@/components/ui/Toolbar';
import { Table, type Column } from '@/components/ui/Table';
import { Spinner, ErrorState } from '@/components/ui/misc';
import { FuelGauge } from '@/components/ui/FuelGauge';
import { useHubs, useProducts } from '@/hooks/queries';
import { stockLevel } from '@/services/rules';
import type { Hub, StockLevel } from '@/types';
import styles from './InventoryPage.module.css';

type LevelFilter = 'all' | StockLevel;

export default function InventoryPage() {
  const hubs = useHubs();
  const products = useProducts();
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');

  const q = search.trim().toLowerCase();
  const productList = products.data ?? [];

  const rows = useMemo(() => {
    return (hubs.data ?? []).filter((h) => {
      if (q && !h.name.toLowerCase().includes(q)) return false;
      if (level === 'all') return true;
      return productList.some((p) => stockLevel(h.inventory[p.key] ?? 0, p.lowStockThreshold) === level);
    });
  }, [hubs.data, q, level, productList]);

  const columns: Column<Hub>[] = useMemo(
    () => [
      {
        key: 'location',
        header: 'Location',
        render: (h) => (
          <div className={styles.hubCell}>
            <span className={styles.hubName}>{h.name}</span>
            <span className={styles.hubType}>{h.locationType}</span>
          </div>
        ),
      },
      ...productList.map<Column<Hub>>((p) => ({
        key: p.key,
        header: p.name,
        render: (h) => <FuelGauge qty={h.inventory[p.key] ?? 0} product={p} />,
      })),
    ],
    [productList],
  );

  if (hubs.isLoading || products.isLoading) return <Spinner label="Loading inventory…" />;
  if (hubs.error) return <ErrorState message={(hubs.error as Error).message} onRetry={() => hubs.refetch()} />;

  const alertCount = (hubs.data ?? []).reduce(
    (n, h) => n + productList.filter((p) => stockLevel(h.inventory[p.key] ?? 0, p.lowStockThreshold) === 'crit').length,
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Inventory"
        actions={
          alertCount > 0 ? (
            <span className={styles.alert}>
              <AlertTriangle size={15} /> {alertCount} below minimum
            </span>
          ) : undefined
        }
      />
      <FilterChips
        options={[
          { value: 'all', label: 'All' },
          { value: 'crit', label: 'Critical' },
          { value: 'warn', label: 'Low' },
          { value: 'ok', label: 'Healthy' },
        ]}
        value={level}
        onChange={setLevel}
      />
      <div className={styles.spacer} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Search hubs…" />
      <Table columns={columns} rows={rows} rowKey={(h) => h.id} pageSize={8} />
    </div>
  );
}

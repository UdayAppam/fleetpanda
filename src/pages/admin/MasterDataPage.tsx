import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Warehouse, Droplets, IdCard, Truck, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Toolbar, FilterChips } from '@/components/ui/Toolbar';
import { Table, type Column } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useHubs, useProducts, useDrivers, useVehicles } from '@/hooks/queries';
import { useEntityMutations } from '@/features/master-data/mutations';
import { HubForm, ProductForm, DriverForm, VehicleForm } from '@/features/master-data/forms';
import { useConfirm } from '@/contexts/ConfirmContext';
import { stockLevel } from '@/services/rules';
import type { Driver, Hub, Product, Vehicle } from '@/types';
import { fmtNum } from '@/utils/format';
import styles from './MasterDataPage.module.css';

type Tab = 'locations' | 'products' | 'drivers' | 'vehicles';
const RAIL: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'locations', label: 'Hubs & Terminals', icon: Warehouse },
  { value: 'products', label: 'Products', icon: Droplets },
  { value: 'drivers', label: 'Drivers', icon: IdCard },
  { value: 'vehicles', label: 'Vehicles', icon: Truck },
];

// Contextual attribute filters shown per tab (secondary to the search box).
const ATTR_FILTERS: Partial<Record<Tab, { value: string; label: string }[]>> = {
  locations: [
    { value: 'all', label: 'All' },
    { value: 'hub', label: 'Hubs' },
    { value: 'terminal', label: 'Terminals' },
  ],
  drivers: [
    { value: 'all', label: 'All' },
    { value: 'available', label: 'Available' },
    { value: 'on_shift', label: 'On shift' },
  ],
  vehicles: [
    { value: 'all', label: 'All' },
    { value: 'available', label: 'Available' },
    { value: 'on_shift', label: 'On shift' },
    { value: 'maintenance', label: 'Maintenance' },
  ],
};

export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>('locations');
  const [search, setSearch] = useState('');
  const [attr, setAttr] = useState('all');
  const [editing, setEditing] = useState<unknown | null>(null);
  const [creating, setCreating] = useState(false);
  const confirm = useConfirm();

  const hubs = useHubs();
  const products = useProducts();
  const drivers = useDrivers();
  const vehicles = useVehicles();

  const isLocation = tab === 'locations';
  const resource = isLocation ? 'hubs' : (tab as 'products' | 'drivers' | 'vehicles');
  const mutations = useEntityMutations(resource);

  const q = search.trim().toLowerCase();

  function rowActions(entity: { id: string; name?: string; registration?: string }) {
    return (
      <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(entity)} aria-label="Edit" />
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={14} />}
          aria-label="Delete"
          onClick={async () => {
            const ok = await confirm({
              title: 'Delete record?',
              message: `Remove "${entity.name ?? entity.registration ?? entity.id}"? This cannot be undone.`,
              confirmLabel: 'Delete',
              danger: true,
            });
            if (ok) mutations.remove.mutate(entity.id);
          }}
        />
      </span>
    );
  }

  const { rows, columns, loading, error, refetch } = useMemo(() => {
    const match = (s: string) => s.toLowerCase().includes(q);
    if (isLocation) {
      const rows = (hubs.data ?? []).filter(
        (h) => (attr === 'all' || h.locationType === attr) && (match(h.name) || match(h.address)),
      );
      const columns: Column<Hub>[] = [
        {
          key: 'name',
          header: 'Name',
          render: (h) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <MapPin size={14} /> {h.name}
            </span>
          ),
        },
        {
          key: 'type',
          header: 'Type',
          render: (h) => (
            <Badge tone={h.locationType === 'terminal' ? 'info' : 'neutral'}>{h.locationType}</Badge>
          ),
        },
        { key: 'address', header: 'Address', render: (h) => h.address },
        {
          key: 'inv',
          header: 'Inventory',
          render: (h) => (
            <div className={styles.invChips}>
              {(products.data ?? []).map((p) => {
                const qty = h.inventory[p.key];
                if (qty == null) return null;
                return (
                  <span key={p.key} className={styles.invChip} title={`${p.name}: ${fmtNum(qty)} ${p.unit}`}>
                    <span className={styles.invDot} data-level={stockLevel(qty, p.lowStockThreshold)} />
                    {p.name.split(' ')[0]} <span className="num">{fmtNum(qty)}</span>
                  </span>
                );
              })}
            </div>
          ),
        },
        { key: 'actions', header: '', align: 'right', render: (h) => rowActions(h) },
      ];
      return { rows, columns, loading: hubs.isLoading, error: hubs.error, refetch: hubs.refetch };
    }
    if (tab === 'products') {
      const rows = (products.data ?? []).filter((p) => match(p.name) || match(p.key));
      const columns: Column<Product>[] = [
        { key: 'name', header: 'Name', render: (p) => <strong>{p.name}</strong> },
        { key: 'key', header: 'Key', render: (p) => <span className="mono">{p.key}</span> },
        { key: 'unit', header: 'Unit', render: (p) => p.unit },
        { key: 'thr', header: 'Low-stock', align: 'right', render: (p) => fmtNum(p.lowStockThreshold) },
        { key: 'cap', header: 'Capacity', align: 'right', render: (p) => fmtNum(p.tankCapacity) },
        { key: 'actions', header: '', align: 'right', render: (p) => rowActions(p) },
      ];
      return { rows, columns, loading: products.isLoading, error: products.error, refetch: products.refetch };
    }
    if (tab === 'drivers') {
      const rows = (drivers.data ?? []).filter(
        (d) => (attr === 'all' || d.status === attr) && (match(d.name) || match(d.license) || match(d.phone)),
      );
      const columns: Column<Driver>[] = [
        { key: 'name', header: 'Name', render: (d) => <strong>{d.name}</strong> },
        { key: 'license', header: 'License', render: (d) => <span className="mono">{d.license}</span> },
        { key: 'phone', header: 'Phone', render: (d) => <span className="mono">{d.phone}</span> },
        { key: 'status', header: 'Status', render: (d) => <Badge tone={d.status === 'on_shift' ? 'info' : 'neutral'}>{d.status.replace('_', ' ')}</Badge> },
        { key: 'actions', header: '', align: 'right', render: (d) => rowActions(d) },
      ];
      return { rows, columns, loading: drivers.isLoading, error: drivers.error, refetch: drivers.refetch };
    }
    const rows = (vehicles.data ?? []).filter(
      (v) => (attr === 'all' || v.status === attr) && (match(v.registration) || match(v.type)),
    );
    const columns: Column<Vehicle>[] = [
      { key: 'reg', header: 'Registration', render: (v) => <span className="mono" style={{ fontWeight: 600 }}>{v.registration}</span> },
      { key: 'type', header: 'Type', render: (v) => v.type },
      { key: 'cap', header: 'Capacity', align: 'right', render: (v) => `${fmtNum(v.capacity)} L` },
      { key: 'status', header: 'Status', render: (v) => <Badge tone={v.status === 'on_shift' ? 'info' : v.status === 'maintenance' ? 'warn' : 'neutral'}>{v.status.replace('_', ' ')}</Badge> },
      { key: 'actions', header: '', align: 'right', render: (v) => rowActions(v) },
    ];
    return { rows, columns, loading: vehicles.isLoading, error: vehicles.error, refetch: vehicles.refetch };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, attr, hubs.data, products.data, drivers.data, vehicles.data, hubs.isLoading, products.isLoading, drivers.isLoading, vehicles.isLoading]);

  const handleSubmit = (values: Record<string, unknown>, id?: string) => {
    const done = () => {
      setCreating(false);
      setEditing(null);
    };
    // For locations the form's Type dropdown carries locationType, so no special-casing needed.
    if (id) mutations.update.mutate({ id, body: values }, { onSuccess: done });
    else mutations.create.mutate(values, { onSuccess: done });
  };

  const busy = mutations.create.isPending || mutations.update.isPending;
  const renderForm = (initial?: unknown) => {
    if (isLocation) return <HubForm initial={initial as Hub} onSubmit={handleSubmit} busy={busy} />;
    if (tab === 'products') return <ProductForm initial={initial as Product} onSubmit={handleSubmit} busy={busy} />;
    if (tab === 'drivers') return <DriverForm initial={initial as Driver} onSubmit={handleSubmit} busy={busy} />;
    return <VehicleForm initial={initial as Vehicle} onSubmit={handleSubmit} busy={busy} />;
  };

  const singular = tab === 'locations' ? 'Location' : tab.charAt(0).toUpperCase() + tab.slice(1, -1);
  const pluralLabel = RAIL.find((r) => r.value === tab)!.label;

  const counts: Record<Tab, number> = {
    locations: (hubs.data ?? []).length,
    products: (products.data ?? []).length,
    drivers: (drivers.data ?? []).length,
    vehicles: (vehicles.data ?? []).length,
  };

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Master Data" />

      <div className={styles.layout}>
        <nav className={styles.rail} aria-label="Entity types">
          {RAIL.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={styles.railBtn}
              data-active={tab === value}
              aria-current={tab === value}
              onClick={() => {
                setTab(value);
                setSearch('');
                setAttr('all');
              }}
            >
              <Icon size={18} />
              {label}
              <span className={styles.count}>{counts[value]}</span>
            </button>
          ))}
        </nav>

        <section className={styles.content}>
          <div className={styles.contentHead}>
            <h2 className={styles.contentTitle}>{pluralLabel}</h2>
            <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New {singular}
            </Button>
          </div>

          <Toolbar search={search} onSearch={setSearch} placeholder={`Search ${pluralLabel.toLowerCase()}…`}>
            {ATTR_FILTERS[tab] && <FilterChips options={ATTR_FILTERS[tab]!} value={attr} onChange={setAttr} />}
          </Toolbar>

          <Table
            columns={columns as Column<never>[]}
            rows={rows as never[]}
            rowKey={(r: { id: string }) => r.id}
            loading={loading}
            error={error ? (error as Error).message : null}
            onRetry={() => refetch()}
          />
        </section>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title={`New ${singular}`} variant="drawer">
        {renderForm(undefined)}
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit ${singular}`} variant="drawer">
        {editing ? renderForm(editing) : null}
      </Modal>
    </div>
  );
}

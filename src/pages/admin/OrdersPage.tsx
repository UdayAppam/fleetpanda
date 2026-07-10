import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Toolbar, FilterChips } from '@/components/ui/Toolbar';
import { Table, type Column } from '@/components/ui/Table';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { useOrders } from '@/hooks/queries';
import { useLookups } from '@/hooks/useLookups';
import { useOrderMutations } from '@/features/orders/mutations';
import { OrderForm } from '@/features/orders/OrderForm';
import { ReadinessPill, readinessGroup, READINESS_GROUP_LABEL, type ReadinessGroup } from '@/features/dispatch/readinessUi';
import { useReadinessResolver } from '@/features/dispatch/useDispatchReadiness';
import { useConfirm } from '@/contexts/ConfirmContext';
import type { Order, OrderStatus } from '@/types';
import { fmtDate, fmtQty } from '@/utils/format';

// Orders are only editable/removable before dispatch (source stock hasn't moved yet).
const EDITABLE: OrderStatus[] = ['pending', 'assigned'];

type Filter = OrderStatus | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
];

export default function OrdersPage() {
  const orders = useOrders();
  const { hub, driver, drivers } = useLookups();
  const { create, assign, update, remove } = useOrderMutations();
  const { resolve } = useReadinessResolver();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);

  // Deep-link support (from dashboard CTAs): ?status= focuses a status tab; ?readiness= a group
  // (optionally scoped to ?date= so the filtered count matches the dashboard tile).
  const readinessFilter = (searchParams.get('readiness') as ReadinessGroup | null) ?? null;
  const dateFilter = searchParams.get('date');
  useEffect(() => {
    const s = searchParams.get('status');
    if (s && FILTERS.some((f) => f.value === s)) setFilter(s as Filter);
  }, [searchParams]);

  const changeFilter = (f: Filter) => {
    setFilter(f);
    const next = new URLSearchParams(searchParams);
    if (f === 'all') next.delete('status');
    else next.set('status', f);
    setSearchParams(next, { replace: true });
  };

  const clearReadiness = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('readiness');
    next.delete('date');
    setSearchParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.data?.length ?? 0 };
    (orders.data ?? []).forEach((o) => (c[o.status] = (c[o.status] ?? 0) + 1));
    return c;
  }, [orders.data]);

  const q = search.trim().toLowerCase();
  const rows = (orders.data ?? []).filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (readinessFilter && readinessGroup(resolve(o).state) !== readinessFilter) return false;
    if (dateFilter && o.deliveryDate !== dateFilter) return false;
    if (!q) return true;
    const dest = hub.get(o.destinationId)?.name.toLowerCase() ?? '';
    return o.id.includes(q) || o.product.includes(q) || dest.includes(q);
  });

  const columns: Column<Order>[] = [
    { key: 'id', header: 'Order', render: (o) => <span className="mono">{o.id}</span> },
    {
      key: 'route',
      header: 'Route',
      render: (o) => (
        <span style={{ fontSize: 'var(--fs-sm)' }}>
          {hub.get(o.sourceId)?.name ?? '—'} <span style={{ color: 'var(--text-muted)' }}>→</span>{' '}
          <strong>{hub.get(o.destinationId)?.name ?? '—'}</strong>
        </span>
      ),
    },
    { key: 'product', header: 'Product', render: (o) => <span style={{ textTransform: 'capitalize' }}>{o.product}</span> },
    { key: 'qty', header: 'Qty', align: 'right', render: (o) => <span className="num">{fmtQty(o.quantity)}</span> },
    { key: 'date', header: 'Delivery', render: (o) => fmtDate(o.deliveryDate) },
    { key: 'status', header: 'Status', render: (o) => <StatusBadge status={o.status} /> },
    {
      key: 'readiness',
      header: 'Readiness',
      render: (o) => <ReadinessPill readiness={resolve(o)} />,
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (o) =>
        o.status === 'pending' || o.status === 'assigned' ? (
          <Select
            value={o.assignedDriverId ?? ''}
            onChange={(e) => e.target.value && assign.mutate({ id: o.id, driverId: e.target.value })}
            aria-label={`Assign driver to ${o.id}`}
            style={{ minWidth: 130 }}
          >
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.status === 'on_shift' ? ' · on shift' : ' · available'}
              </option>
            ))}
          </Select>
        ) : (
          (o.assignedDriverId && driver.get(o.assignedDriverId)?.name) || '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) =>
        EDITABLE.includes(o.status) ? (
          <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" icon={<Pencil size={14} />} aria-label={`Edit ${o.id}`} onClick={() => setEditing(o)} />
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 size={14} />}
              aria-label={`Delete ${o.id}`}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete order?',
                  message: `Remove ${o.id} (${fmtQty(o.quantity)} ${o.product})? This cannot be undone.`,
                  confirmLabel: 'Delete',
                  danger: true,
                });
                if (ok) remove.mutate(o.id);
              }}
            />
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Dispatch"
        title="Orders"
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New Order
          </Button>
        }
      />
      <FilterChips
        options={FILTERS.map((f) => ({ ...f, count: counts[f.value] ?? 0 }))}
        value={filter}
        onChange={changeFilter}
      />
      <div style={{ height: 'var(--sp-4)' }} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Search orders…">
        {readinessFilter && readinessFilter !== 'done' && (
          <button
            onClick={clearReadiness}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid var(--brand)',
              background: 'color-mix(in srgb, var(--brand) 14%, transparent)',
              color: 'var(--brand)',
              borderRadius: 'var(--r-full)',
              padding: '5px 12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 'var(--fs-sm)',
            }}
          >
            {READINESS_GROUP_LABEL[readinessFilter]}
            {dateFilter ? ` · ${fmtDate(dateFilter)}` : ''} <X size={13} />
          </button>
        )}
      </Toolbar>
      <Table
        columns={columns}
        rows={rows}
        rowKey={(o) => o.id}
        loading={orders.isLoading}
        error={orders.error ? (orders.error as Error).message : null}
        onRetry={() => orders.refetch()}
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="New Order" variant="drawer">
        <OrderForm
          busy={create.isPending}
          onSubmit={(v) => create.mutate(v, { onSuccess: () => setCreating(false) })}
        />
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`Edit ${editing?.id ?? ''}`} variant="drawer">
        {editing && (
          <OrderForm
            initial={editing}
            busy={update.isPending}
            onSubmit={(v, id) => update.mutate({ id: id!, input: v }, { onSuccess: () => setEditing(null) })}
          />
        )}
      </Modal>
    </div>
  );
}

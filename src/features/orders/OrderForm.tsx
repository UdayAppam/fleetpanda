import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, PackageCheck } from 'lucide-react';
import { orderSchema, type OrderInput } from '@/lib/schemas';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useLookups } from '@/hooks/useLookups';
import { orderStockCheck } from '@/services/rules';
import { today } from '@/utils/clock';
import { fmtQty } from '@/utils/format';
import type { Order } from '@/types';
import styles from '@/features/master-data/forms.module.css';

// One form for both create and edit — pass `initial` to edit (mirrors the master-data forms).
export function OrderForm({
  initial,
  onSubmit,
  busy,
}: {
  initial?: Order;
  onSubmit: (v: OrderInput, id?: string) => void;
  busy?: boolean;
}) {
  const { hubs, products, drivers, hub } = useLookups();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: initial
      ? {
          sourceId: initial.sourceId,
          destinationId: initial.destinationId,
          product: initial.product,
          quantity: initial.quantity,
          deliveryDate: initial.deliveryDate,
          assignedDriverId: initial.assignedDriverId,
        }
      : { sourceId: '', destinationId: '', deliveryDate: today(), assignedDriverId: null, product: products[0]?.key },
  });

  // Live operational feedback: does the chosen source hub hold enough of the product?
  const sourceId = watch('sourceId');
  const product = watch('product');
  const quantity = Number(watch('quantity')) || 0;
  const src = sourceId ? hub.get(sourceId) : undefined;
  const available = src ? src.inventory[product] ?? 0 : undefined;
  const stock = available != null && quantity > 0 ? orderStockCheck(available, quantity) : undefined;

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v, initial?.id))} className={styles.form}>
      <div className={styles.row}>
        <Field label="Source hub" error={errors.sourceId?.message}>
          <Select {...register('sourceId')}>
            <option value="" disabled>
              Select…
            </option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Destination" error={errors.destinationId?.message}>
          <Select {...register('destinationId')}>
            <option value="" disabled>
              Select…
            </option>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={styles.row}>
        <Field label="Product" error={errors.product?.message}>
          <Select {...register('product')}>
            {products.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Quantity (L)"
          error={errors.quantity?.message}
          hint={available != null ? `Source holds ${fmtQty(available)}` : undefined}
        >
          <Input type="number" min={1} {...register('quantity')} />
        </Field>
      </div>

      {stock && !stock.sufficient && (
        <div className={styles.opWarn} role="alert">
          <AlertTriangle size={16} />
          <span>
            {src?.name} has only {fmtQty(stock.available)} — short by{' '}
            <strong>{fmtQty(stock.shortBy)}</strong>. The order can be placed, but the shift
            can’t start until stock is replenished.
          </span>
        </div>
      )}
      {stock && stock.sufficient && (
        <div className={styles.opOk}>
          <PackageCheck size={16} />
          <span>
            {src?.name} can cover this order ({fmtQty(stock.available)} available).
          </span>
        </div>
      )}
      <div className={styles.row}>
        <Field label="Delivery date" error={errors.deliveryDate?.message}>
          <Input type="date" min={today()} {...register('deliveryDate')} />
        </Field>
        <Field label="Assign driver (optional)">
          <Select {...register('assignedDriverId')}>
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className={styles.actions}>
        <Button type="submit" loading={busy}>
          {initial ? 'Save changes' : 'Create order'}
        </Button>
      </div>
    </form>
  );
}

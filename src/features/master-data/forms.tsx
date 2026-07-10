import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import {
  makeHubSchema,
  productSchema,
  driverSchema,
  vehicleSchema,
  type HubInput,
  type ProductInput,
  type DriverInput,
  type VehicleInput,
} from '@/lib/schemas';
import { useProducts } from '@/hooks/queries';
import { LocationPicker } from './LocationPicker';
import type { Driver, Hub, Product, Vehicle } from '@/types';
import styles from './forms.module.css';

interface FormProps<T> {
  initial?: T;
  onSubmit: (values: Record<string, unknown>, id?: string) => void;
  busy?: boolean;
}

function Actions({ busy }: { busy?: boolean }) {
  return (
    <div className={styles.actions}>
      <Button type="submit" loading={busy}>
        Save
      </Button>
    </div>
  );
}

export function HubForm({ initial, onSubmit, busy }: FormProps<Hub>) {
  const { data: products = [] } = useProducts();
  const caps = useMemo(() => Object.fromEntries(products.map((p) => [p.key, p.tankCapacity])), [products]);
  const schema = useMemo(() => makeHubSchema(caps), [caps]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HubInput>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          name: initial.name,
          locationType: initial.locationType,
          address: initial.address,
          coordinates: initial.coordinates,
          inventory: initial.inventory,
        }
      : { locationType: 'hub', coordinates: { lat: 40.7128, lng: -74.006 }, inventory: {} },
  });

  const lat = Number(watch('coordinates.lat'));
  const lng = Number(watch('coordinates.lng'));
  const setCoords = (nextLat: number, nextLng: number) => {
    setValue('coordinates.lat', nextLat, { shouldValidate: true });
    setValue('coordinates.lng', nextLng, { shouldValidate: true });
  };

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v, initial?.id))} className={styles.form}>
      <Field label="Name" error={errors.name?.message}>
        <Input {...register('name')} />
      </Field>
      <Field label="Type" error={errors.locationType?.message}>
        <Select {...register('locationType')}>
          <option value="hub">Hub</option>
          <option value="terminal">Terminal</option>
        </Select>
      </Field>
      <Field label="Find location">
        <LocationPicker
          lat={lat}
          lng={lng}
          onChange={setCoords}
          onAddress={(a) => setValue('address', a, { shouldValidate: true })}
        />
      </Field>
      <Field label="Address" error={errors.address?.message} hint="Auto-filled from the map — edit if needed">
        <Input {...register('address')} placeholder="Search or click the map above…" />
      </Field>
      <div className={styles.row}>
        <Field label="Latitude" error={errors.coordinates?.lat?.message} hint="Auto-set from the map">
          <Input type="number" step="any" {...register('coordinates.lat')} />
        </Field>
        <Field label="Longitude" error={errors.coordinates?.lng?.message} hint="Auto-set from the map">
          <Input type="number" step="any" {...register('coordinates.lng')} />
        </Field>
      </div>
      <div className={styles.inventory}>
        <span className={styles.subLabel}>Inventory</span>
        <span className={styles.subHint}>Current stock per product — can’t exceed each product’s tank capacity.</span>
        <div className={styles.row}>
          {products.map((p) => {
            const invErrors = errors.inventory as Record<string, { message?: string }> | undefined;
            return (
              <Field
                key={p.key}
                label={`${p.name} (${p.unit})`}
                hint={`Max ${p.tankCapacity.toLocaleString()} ${p.unit}`}
                error={invErrors?.[p.key]?.message}
              >
                <Input type="number" min={0} max={p.tankCapacity} {...register(`inventory.${p.key}`)} />
              </Field>
            );
          })}
        </div>
      </div>
      <Actions busy={busy} />
    </form>
  );
}

export function ProductForm({ initial, onSubmit, busy }: FormProps<Product>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: initial ?? { unit: 'L' },
  });
  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v, initial?.id))} className={styles.form}>
      <Field label="Key (e.g. diesel)" error={errors.key?.message}>
        <Input {...register('key')} disabled={Boolean(initial)} />
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <Input {...register('name')} />
      </Field>
      <div className={styles.row}>
        <Field label="Unit" error={errors.unit?.message}>
          <Input {...register('unit')} />
        </Field>
        <Field
          label="Low-stock threshold"
          hint="Alert when a hub falls below this"
          error={errors.lowStockThreshold?.message}
        >
          <Input type="number" {...register('lowStockThreshold')} />
        </Field>
      </div>
      <Field
        label="Max tank capacity (L)"
        hint="The most a single hub can store of this product — used as the gauge full-scale and the inventory cap"
        error={errors.tankCapacity?.message}
      >
        <Input type="number" min={1} {...register('tankCapacity')} />
      </Field>
      <Actions busy={busy} />
    </form>
  );
}

export function DriverForm({ initial, onSubmit, busy }: FormProps<Driver>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DriverInput>({
    resolver: zodResolver(driverSchema),
    defaultValues: initial ?? { status: 'available' },
  });
  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v, initial?.id))} className={styles.form}>
      <Field label="Name" error={errors.name?.message}>
        <Input {...register('name')} />
      </Field>
      <div className={styles.row}>
        <Field label="License" error={errors.license?.message}>
          <Input {...register('license')} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} />
        </Field>
      </div>
      <Actions busy={busy} />
    </form>
  );
}

export function VehicleForm({ initial, onSubmit, busy }: FormProps<Vehicle>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VehicleInput>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: initial ?? { type: 'Tanker', status: 'available' },
  });
  return (
    <form onSubmit={handleSubmit((v) => onSubmit(v, initial?.id))} className={styles.form}>
      <Field label="Registration" error={errors.registration?.message}>
        <Input {...register('registration')} />
      </Field>
      <div className={styles.row}>
        <Field label="Capacity (L)" error={errors.capacity?.message}>
          <Input type="number" {...register('capacity')} />
        </Field>
        <Field label="Type" error={errors.type?.message}>
          <Input {...register('type')} />
        </Field>
      </div>
      <Field label="Status">
        <Select {...register('status')}>
          <option value="available">Available</option>
          <option value="maintenance">Maintenance</option>
        </Select>
      </Field>
      <Actions busy={busy} />
    </form>
  );
}

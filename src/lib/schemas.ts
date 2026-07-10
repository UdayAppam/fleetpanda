import { z } from 'zod';
import { today } from '@/utils/clock';

// Date-only strings compare lexicographically, so `>= today()` blocks past dates.
const notPast = (d: string) => d >= today();

const coord = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const hubSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  locationType: z.enum(['hub', 'terminal']),
  address: z.string().min(3, 'Address is required'),
  coordinates: coord,
  inventory: z.record(z.string(), z.coerce.number().min(0)).default({}),
});
export type HubInput = z.infer<typeof hubSchema>;

// Hub inventory can't exceed each product's tank capacity — built dynamically from products.
export function makeHubSchema(caps: Record<string, number>) {
  return hubSchema.superRefine((val, ctx) => {
    Object.entries(val.inventory ?? {}).forEach(([key, qty]) => {
      const cap = caps[key];
      if (cap != null && Number(qty) > cap) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['inventory', key],
          message: `Over tank capacity (max ${cap.toLocaleString()} L)`,
        });
      }
    });
  });
}

export const productSchema = z
  .object({
    key: z
      .string()
      .min(2)
      .regex(/^[a-z0-9_]+$/, 'lowercase letters/numbers only'),
    name: z.string().min(2, 'Name is required'),
    unit: z.string().min(1).default('L'),
    lowStockThreshold: z.coerce.number().min(0),
    tankCapacity: z.coerce.number().min(1),
  })
  .refine((p) => p.lowStockThreshold <= p.tankCapacity, {
    message: 'Low-stock threshold can’t exceed tank capacity',
    path: ['lowStockThreshold'],
  });
export type ProductInput = z.infer<typeof productSchema>;

export const driverSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  license: z.string().min(3, 'License is required'),
  phone: z.string().min(6, 'Phone is required'),
  status: z.enum(['available', 'on_shift']).default('available'),
});
export type DriverInput = z.infer<typeof driverSchema>;

export const vehicleSchema = z.object({
  registration: z.string().min(2, 'Registration is required'),
  capacity: z.coerce.number().min(1, 'Capacity must be positive'),
  type: z.string().min(2, 'Type is required'),
  status: z.enum(['available', 'on_shift', 'maintenance']).default('available'),
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export const orderSchema = z.object({
  sourceId: z.string().min(1, 'Select a source'),
  destinationId: z.string().min(1, 'Select a destination'),
  product: z.string().min(1, 'Select a product'),
  quantity: z.coerce.number().min(1, 'Quantity must be positive'),
  deliveryDate: z.string().min(1, 'Pick a date').refine(notPast, 'Delivery date can’t be in the past'),
  assignedDriverId: z.string().nullable().default(null),
}).refine((o) => o.sourceId !== o.destinationId, {
  message: 'Source and destination must differ',
  path: ['destinationId'],
});
export type OrderInput = z.infer<typeof orderSchema>;

export const allocationSchema = z.object({
  vehicleId: z.string().min(1, 'Select a vehicle'),
  driverId: z.string().min(1, 'Select a driver'),
  date: z.string().min(1, 'Pick a date').refine(notPast, 'Can’t allocate for a past date'),
});
export type AllocationInput = z.infer<typeof allocationSchema>;

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

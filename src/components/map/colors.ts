// Shared map colours. Product colours make cargo readable; status colours the vehicle state.
export const STATUS_COLOR: Record<string, string> = {
  in_transit: '#e8912b',
  loading: '#12a2ad',
  idle: '#7c8b90',
};
export const PRODUCT_COLOR: Record<string, string> = {
  diesel: '#c07b2e',
  petrol: '#16a34a',
  premium: '#7c5cff',
};
export const PICKUP_COLOR = '#0b7c86';
export const HUB_COLOR = '#0b3d4f';

export const statusColor = (s: string) => STATUS_COLOR[s] ?? '#7c8b90';
export const productColor = (p?: string) => (p ? PRODUCT_COLOR[p] ?? HUB_COLOR : HUB_COLOR);

export type Role = 'admin' | 'driver';
export type ProductKey = string;

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  driverId?: string;
}

export type LocationType = 'hub' | 'terminal';
export interface Hub {
  id: string;
  name: string;
  locationType: LocationType;
  address: string;
  coordinates: { lat: number; lng: number };
  inventory: Record<ProductKey, number>;
}

export interface Product {
  id: string;
  key: ProductKey;
  name: string;
  unit: string;
  lowStockThreshold: number;
  tankCapacity: number;
}

export type DriverStatus = 'available' | 'on_shift';
export interface Driver {
  id: string;
  name: string;
  license: string;
  phone: string;
  status: DriverStatus;
}

export type VehicleStatus = 'available' | 'on_shift' | 'maintenance';
export interface Vehicle {
  id: string;
  registration: string;
  capacity: number;
  type: string;
  status: VehicleStatus;
}

export type OrderStatus = 'pending' | 'assigned' | 'in_transit' | 'delivered' | 'failed';
export interface Order {
  id: string;
  sourceId: string;
  destinationId: string;
  product: ProductKey;
  quantity: number;
  deliveryDate: string;
  assignedDriverId: string | null;
  status: OrderStatus;
  failureReason?: string;
  completedAt?: string | null;
}

export interface Allocation {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
}

export type ShiftStatus = 'not_started' | 'active' | 'ended';
export interface Shift {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  status: ShiftStatus;
  startedAt: string | null;
  endedAt: string | null;
  orderIds: string[];
}

export type VehicleMapStatus = 'idle' | 'loading' | 'in_transit';
export interface VehiclePosition {
  id: string;
  vehicleId: string;
  driverId: string;
  lat: number;
  lng: number;
  updatedAt: string;
  status: VehicleMapStatus;
  trail?: { lat: number; lng: number }[]; // breadcrumb of where the vehicle has been
}

export type StockLevel = 'ok' | 'warn' | 'crit';

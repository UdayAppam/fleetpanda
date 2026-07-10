import { http } from './httpClient';
import type {
  Allocation,
  Driver,
  Hub,
  Order,
  Product,
  Shift,
  User,
  Vehicle,
  VehiclePosition,
} from '@/types';

export const api = {
  // auth
  login: (email: string, password: string) =>
    http.post<{ user: User; token: string }>('/login', { email, password }),

  // generic CRUD factory
  hubs: crud<Hub>('hubs'),
  products: crud<Product>('products'),
  drivers: crud<Driver>('drivers'),
  vehicles: crud<Vehicle>('vehicles'),
  orders: crud<Order>('orders'),

  // reads
  allocations: () => http.get<Allocation[]>('/allocations'),
  shifts: () => http.get<Shift[]>('/shifts'),
  positions: () => http.get<VehiclePosition[]>('/vehiclePositions'),
  patchPosition: (id: string, body: Partial<VehiclePosition>) =>
    http.patch<VehiclePosition>(`/vehiclePositions/${id}`, body),

  // transactional (server owns side-effects)
  createAllocation: (body: { vehicleId: string; driverId: string; date: string }) =>
    http.post<Allocation>('/allocations', body),
  assignOrder: (id: string, driverId: string) =>
    http.patch<Order>(`/orders/${id}`, { assignedDriverId: driverId, status: 'assigned' }),
  startShift: (driverId: string, date: string) =>
    http.post<Shift>('/shifts/start', { driverId, date }),
  endShift: (id: string) => http.post<Shift>(`/shifts/${id}/end`),
  completeOrder: (id: string) =>
    http.post<{ order: Order; inventory: { hubName: string; product: string; delta: number; total: number } }>(
      `/orders/${id}/complete`,
    ),
  failOrder: (id: string, reason: string) =>
    http.post<{ order: Order }>(`/orders/${id}/fail`, { reason }),
};

function crud<T extends { id: string }>(resource: string) {
  return {
    list: () => http.get<T[]>(`/${resource}`),
    get: (id: string) => http.get<T>(`/${resource}/${id}`),
    create: (body: Partial<T>) => http.post<T>(`/${resource}`, body),
    update: (id: string, body: Partial<T>) => http.patch<T>(`/${resource}/${id}`, body),
    remove: (id: string) => http.del<unknown>(`/${resource}/${id}`),
  };
}

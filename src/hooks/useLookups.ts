import { useMemo } from 'react';
import { useHubs, useProducts, useDrivers, useVehicles } from '@/hooks/queries';
import type { Driver, Hub, Product, Vehicle } from '@/types';

// Convenience id→entity maps used across features (order rows, allocation, map tooltips).
export function useLookups() {
  const hubs = useHubs();
  const products = useProducts();
  const drivers = useDrivers();
  const vehicles = useVehicles();

  const maps = useMemo(() => {
    const byId = <T extends { id: string }>(arr: T[] | undefined) =>
      new Map((arr ?? []).map((x) => [x.id, x]));
    const productByKey = new Map((products.data ?? []).map((p) => [p.key, p]));
    return {
      hub: byId<Hub>(hubs.data),
      product: byId<Product>(products.data),
      driver: byId<Driver>(drivers.data),
      vehicle: byId<Vehicle>(vehicles.data),
      productByKey,
    };
  }, [hubs.data, products.data, drivers.data, vehicles.data]);

  return {
    ...maps,
    hubs: hubs.data ?? [],
    products: products.data ?? [],
    drivers: drivers.data ?? [],
    vehicles: vehicles.data ?? [],
    loading: hubs.isLoading || products.isLoading || drivers.isLoading || vehicles.isLoading,
  };
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/api/httpClient';

type Resource = 'hubs' | 'products' | 'drivers' | 'vehicles';
interface Crud {
  create: (body: Record<string, unknown>) => Promise<{ id: string }>;
  update: (id: string, body: Record<string, unknown>) => Promise<{ id: string }>;
  remove: (id: string) => Promise<unknown>;
}
const KEY: Record<Resource, string[]> = {
  hubs: ['hubs'],
  products: ['products'],
  drivers: ['drivers'],
  vehicles: ['vehicles'],
};
const LABEL: Record<Resource, string> = {
  hubs: 'Location',
  products: 'Product',
  drivers: 'Driver',
  vehicles: 'Vehicle',
};

export function useEntityMutations(resource: Resource) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = KEY[resource];
  const label = LABEL[resource];
  const crud = api[resource] as unknown as Crud;
  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : `Could not save ${label.toLowerCase()}`);

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => crud.create(body),
    onSuccess: () => {
      invalidate();
      toast.success(`${label} created`);
    },
    onError,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      crud.update(id, body),
    onSuccess: () => {
      invalidate();
      toast.success(`${label} updated`);
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => crud.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(`${label} removed`);
    },
    onError,
  });

  return { create, update, remove };
}

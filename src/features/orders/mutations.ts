import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { qk } from '@/hooks/queries/keys';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/api/httpClient';
import type { OrderInput } from '@/lib/schemas';

export function useOrderMutations() {
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.orders });
  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'Order action failed');

  const create = useMutation({
    mutationFn: (input: OrderInput) =>
      api.orders.create({
        ...input,
        status: input.assignedDriverId ? 'assigned' : 'pending',
      }),
    onSuccess: () => {
      invalidate();
      toast.success('Order created');
    },
    onError,
  });

  const assign = useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string }) => api.assignOrder(id, driverId),
    onSuccess: () => {
      invalidate();
      toast.success('Driver assigned');
    },
    onError,
  });

  const update = useMutation({
    // status follows assignment (pending ↔ assigned); other statuses aren't editable in the UI.
    mutationFn: ({ id, input }: { id: string; input: OrderInput }) =>
      api.orders.update(id, { ...input, status: input.assignedDriverId ? 'assigned' : 'pending' }),
    onSuccess: () => {
      invalidate();
      toast.success('Order updated');
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.orders.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Order removed');
    },
    onError,
  });

  return { create, assign, update, remove };
}

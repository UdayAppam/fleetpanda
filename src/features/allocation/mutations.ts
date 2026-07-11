import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { qk } from '@/hooks/queries/keys';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/api/httpClient';
import type { AllocationInput } from '@/lib/schemas';

export function useAllocationMutations() {
  const qc = useQueryClient();
  const toast = useToast();

  const create = useMutation({
    mutationFn: (input: AllocationInput) => api.createAllocation(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.allocations });
      toast.success('Vehicle allocated');
    },
    onError: (e: unknown) => {
      // Surface the server's 409 double-booking message specifically.
      toast.error(e instanceof ApiError ? e.message : 'Allocation failed');
    },
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AllocationInput }) => api.updateAllocation(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.allocations });
      toast.success('Allocation updated');
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteAllocation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.allocations });
      toast.success('Allocation removed');
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Remove failed'),
  });

  return { create, update, remove };
}

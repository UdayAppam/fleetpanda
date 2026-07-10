import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { qk } from '@/hooks/queries/keys';
import { useToast } from '@/contexts/ToastContext';
import { ApiError } from '@/api/httpClient';
import { useAppDispatch } from '@/app/store';
import { setActiveShift } from '@/store/slices/shiftSlice';

export function useShiftMutations() {
  const qc = useQueryClient();
  const toast = useToast();
  const dispatch = useAppDispatch();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: qk.shifts });
    qc.invalidateQueries({ queryKey: qk.orders });
    qc.invalidateQueries({ queryKey: qk.hubs });
    qc.invalidateQueries({ queryKey: qk.drivers });
    qc.invalidateQueries({ queryKey: qk.vehicles });
  };
  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Shift action failed');

  const start = useMutation({
    mutationFn: ({ driverId, date }: { driverId: string; date: string }) => api.startShift(driverId, date),
    onSuccess: (shift) => {
      dispatch(setActiveShift(shift.id));
      invalidateAll();
      toast.success('Shift started — deliveries dispatched');
    },
    onError,
  });

  const end = useMutation({
    mutationFn: (shiftId: string) => api.endShift(shiftId),
    onSuccess: () => {
      dispatch(setActiveShift(null));
      invalidateAll();
      toast.success('Shift ended');
    },
    onError,
  });

  const complete = useMutation({
    mutationFn: (orderId: string) => api.completeOrder(orderId),
    onSuccess: (res) => {
      invalidateAll();
      // Truthful toast built from the server response (not optimistic).
      toast.success(
        `Delivered · ${res.inventory.hubName} +${res.inventory.delta.toLocaleString()} ${res.inventory.product}`,
      );
    },
    onError,
  });

  const fail = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => api.failOrder(orderId, reason),
    onSuccess: () => {
      invalidateAll();
      toast.info('Delivery marked failed');
    },
    onError,
  });

  return { start, end, complete, fail };
}

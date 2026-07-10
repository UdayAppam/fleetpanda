import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { qk } from '@/hooks/queries/keys';
import { useToast } from '@/contexts/ToastContext';
import { routePath, nextAlongRoute } from '@/services/route';
import type { LatLng } from '@/utils/geo';
import { now } from '@/utils/clock';
import type { VehiclePosition } from '@/types';

export function useGpsUpdate() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ position, source, dest }: { position: VehiclePosition; source: LatLng; dest: LatLng }) => {
      // Follow the curved route (not a straight line) and leave a breadcrumb trail.
      const path = routePath(source, dest);
      const here = { lat: position.lat, lng: position.lng };
      const next = nextAlongRoute(path, here);
      const trail = [...(position.trail ?? []), here].slice(-40);
      return api.patchPosition(position.id, {
        lat: next.lat,
        lng: next.lng,
        status: 'in_transit',
        updatedAt: now(),
        trail,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.positions });
      toast.info('GPS position sent');
    },
    onError: () => toast.error('Could not send GPS update'),
  });
}

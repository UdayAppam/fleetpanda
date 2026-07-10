import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Pans/zooms the map to a target when it changes (e.g. selecting a vehicle in the list).
export function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [target, map]);
  return null;
}

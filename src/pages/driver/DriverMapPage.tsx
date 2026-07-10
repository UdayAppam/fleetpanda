import { CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet';
import { Navigation, Send, MapPin, PackageOpen, Clock } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner, EmptyState } from '@/components/ui/misc';
import { MapView } from '@/components/map/MapView';
import { statusColor, productColor, PICKUP_COLOR } from '@/components/map/colors';
import { usePositions } from '@/hooks/queries';
import { useDriverDay } from '@/features/driver-shift/useDriverDay';
import { useGpsUpdate } from '@/features/driver-map/useGpsUpdate';
import { distanceKm } from '@/utils/geo';
import { routePath } from '@/services/route';
import { fmtDuration, AVG_SPEED_KMH } from '@/services/logistics';
import { toLatLngs } from '@/components/map/mapUtils';
import { fmtQty } from '@/utils/format';
import styles from './DriverMapPage.module.css';

export default function DriverMapPage() {
  const day = useDriverDay();
  const positions = usePositions();
  const gps = useGpsUpdate();

  if (day.isLoading || positions.isLoading) return <Spinner label="Loading map…" />;

  const myPos = (positions.data ?? []).find((p) => p.driverId === day.driverId);
  const inTransit = day.orders.find((o) => o.status === 'in_transit');
  const dest = inTransit ? day.hub.get(inTransit.destinationId) : undefined;

  if (!myPos) {
    return (
      <div>
        <PageHeader eyebrow="Navigation" title="Driver Map" />
        <EmptyState title="No vehicle position yet" hint="Start your shift to begin tracking." />
      </div>
    );
  }

  const me: [number, number] = [myPos.lat, myPos.lng];
  const here = { lat: myPos.lat, lng: myPos.lng };
  const destCoord = dest ? { lat: dest.coordinates.lat, lng: dest.coordinates.lng } : undefined;
  const srcHub = inTransit ? day.hub.get(inTransit.sourceId) : undefined;
  const sourceCoord = srcHub ? { lat: srcHub.coordinates.lat, lng: srcHub.coordinates.lng } : undefined;
  const path = sourceCoord && destCoord ? routePath(sourceCoord, destCoord) : [];
  const trail = [...(myPos.trail ?? []).map((p) => [p.lat, p.lng] as [number, number]), me];
  const remainKm = destCoord ? distanceKm(here, destCoord) : null;
  const etaMin = remainKm != null ? Math.round((remainKm / AVG_SPEED_KMH) * 60) : null;

  return (
    <div className={styles.wrap}>
      <PageHeader
        eyebrow="Navigation"
        title="Driver Map"
        actions={
          <Button
            icon={<Send size={16} />}
            disabled={!destCoord || !sourceCoord}
            loading={gps.isPending}
            onClick={() => destCoord && sourceCoord && gps.mutate({ position: myPos, source: sourceCoord, dest: destCoord })}
          >
            Send GPS Update
          </Button>
        }
      />
      {!dest && (
        <p className={styles.hint}>
          <Navigation size={14} /> Start your shift and have an in-transit delivery to simulate movement.
        </p>
      )}

      <div className={styles.mapArea}>
        <MapView center={me} zoom={12}>
          {/* route: casing → animated (going) → trail (been) */}
          {path.length > 0 && (
            <>
              <Polyline positions={toLatLngs(path)} pathOptions={{ color: '#0b3d4f', weight: 8, opacity: 0.5 }} />
              <Polyline positions={toLatLngs(path)} pathOptions={{ className: 'fp-route', color: '#ff8a1f', weight: 5 }} />
            </>
          )}
          {trail.length > 1 && (
            <Polyline positions={trail} pathOptions={{ color: '#9db0b6', weight: 4, opacity: 0.9, dashArray: '2 7', lineCap: 'round' }} />
          )}

          {/* PICKUP marker */}
          {srcHub && sourceCoord && (
            <CircleMarker center={[sourceCoord.lat, sourceCoord.lng]} radius={9} pathOptions={{ color: '#fff', weight: 2.5, fillColor: PICKUP_COLOR, fillOpacity: 1 }}>
              <Tooltip permanent direction="top" offset={[0, -8]}>
                📦 Pickup · {srcHub.name}
              </Tooltip>
            </CircleMarker>
          )}
          {/* DROPOFF markers with product + quantity */}
          {day.orders
            .filter((o) => o.status === 'in_transit')
            .map((o) => {
              const h = day.hub.get(o.destinationId);
              if (!h) return null;
              return (
                <CircleMarker
                  key={o.id}
                  center={[h.coordinates.lat, h.coordinates.lng]}
                  radius={9}
                  pathOptions={{ color: '#fff', weight: 2.5, fillColor: productColor(o.product), fillOpacity: 1 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]}>
                    ⛽ {h.name} · {fmtQty(o.quantity)} {o.product}
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {/* the driver's own vehicle — exactly on the line, painted last */}
          <CircleMarker center={me} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: statusColor(dest ? 'in_transit' : 'idle'), fillOpacity: 1 }}>
            <Tooltip permanent direction="right" offset={[10, 0]}>
              🚚 You
            </Tooltip>
            <Popup>Your current location</Popup>
          </CircleMarker>
        </MapView>

        {dest && inTransit && (
          <div className={styles.navCard}>
            <span className="eyebrow">Next stop</span>
            <div className={styles.navDest}>
              <MapPin size={16} /> {dest.name}
            </div>
            <div className={styles.navMeta}>
              <span>
                <PackageOpen size={14} /> {fmtQty(inTransit.quantity)} <span style={{ textTransform: 'capitalize' }}>{inTransit.product}</span>
              </span>
              {remainKm != null && (
                <span>
                  <Navigation size={14} /> {Math.round(remainKm)} km
                </span>
              )}
              {etaMin != null && (
                <span>
                  <Clock size={14} /> ~{fmtDuration(etaMin)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

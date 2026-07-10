import { useState, Fragment } from 'react';
import { CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet';
import { RefreshCw, Pause, Play } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Spinner, ErrorState } from '@/components/ui/misc';
import { MapView } from '@/components/map/MapView';
import { MapController } from '@/components/map/MapController';
import { statusColor, productColor, PICKUP_COLOR, HUB_COLOR } from '@/components/map/colors';
import { useFleetData } from '@/features/fleet-map/useFleetData';
import { VehicleListPanel } from '@/features/fleet-map/VehicleListPanel';
import { useLookups } from '@/hooks/useLookups';
import { useAppDispatch, useAppSelector } from '@/app/store';
import {
  selectMapFilters,
  setMapFilter,
  toggleAutoRefresh,
  resetMapFilters,
} from '@/store/slices/mapFiltersSlice';
import { distanceKm } from '@/utils/geo';
import { routePath } from '@/services/route';
import { fmtDuration, AVG_SPEED_KMH } from '@/services/logistics';
import { toLatLngs } from '@/components/map/mapUtils';
import { fmtTime, fmtQty } from '@/utils/format';
import type { VehicleMapStatus } from '@/types';
import styles from '@/features/fleet-map/FleetMap.module.css';

export default function FleetMapPage() {
  const { filtered, isLoading, error, refetch, isFetching, dataUpdatedAt } = useFleetData();
  const { drivers, vehicles, hubs } = useLookups();
  const filters = useAppSelector(selectMapFilters);
  const dispatch = useAppDispatch();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) return <Spinner label="Loading fleet…" />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  const selected = filtered.find((v) => v.position.vehicleId === selectedId) ?? null;
  const target: [number, number] | null = selected ? [selected.position.lat, selected.position.lng] : null;
  const center: [number, number] = filtered[0]
    ? [filtered[0].position.lat, filtered[0].position.lng]
    : [40.7128, -74.006];

  const inTransit = filtered.filter((v) => v.status === 'in_transit' && v.sourceCoord && v.destCoord);

  return (
    <div className={styles.wrap}>
      <PageHeader
        eyebrow="Core"
        title="Live Fleet Map"
        actions={
          <div className={styles.controls}>
            <span className={styles.updated}>Updated {fmtTime(new Date(dataUpdatedAt).toISOString())}</span>
            <Button
              variant="ghost"
              size="sm"
              icon={filters.autoRefresh ? <Pause size={14} /> : <Play size={14} />}
              onClick={() => dispatch(toggleAutoRefresh())}
            >
              {filters.autoRefresh ? 'Auto 30s' : 'Paused'}
            </Button>
            <Button size="sm" icon={<RefreshCw size={14} className={isFetching ? 'spin' : ''} />} onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className={styles.filters}>
        <Select
          value={filters.driverId ?? ''}
          onChange={(e) => dispatch(setMapFilter({ driverId: e.target.value || null }))}
          aria-label="Filter by driver"
        >
          <option value="">All drivers</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.vehicleId ?? ''}
          onChange={(e) => dispatch(setMapFilter({ vehicleId: e.target.value || null }))}
          aria-label="Filter by vehicle"
        >
          <option value="">All vehicles</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registration}
            </option>
          ))}
        </Select>
        <Select
          value={filters.status ?? ''}
          onChange={(e) => dispatch(setMapFilter({ status: (e.target.value || null) as VehicleMapStatus | null }))}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="in_transit">In transit</option>
          <option value="loading">Loading</option>
          <option value="idle">Idle</option>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => dispatch(resetMapFilters())}>
          Clear
        </Button>
      </div>

      <div className={styles.body}>
        <div className={styles.mapArea}>
          <MapView center={center}>
            <MapController target={target} />

            {/* hub / terminal context dots (anchor-free CircleMarkers → always exactly on the hub) */}
            {hubs.map((h) => (
              <CircleMarker
                key={h.id}
                center={[h.coordinates.lat, h.coordinates.lng]}
                radius={4}
                pathOptions={{ color: '#fff', weight: 1, fillColor: HUB_COLOR, fillOpacity: 0.9 }}
              >
                <Tooltip>{h.name}</Tooltip>
              </CircleMarker>
            ))}

            {/* routes: dark casing → bright animated (going) → grey trail (been) */}
            {inTransit.map((v) => {
              const dim = selectedId && v.position.vehicleId !== selectedId;
              const emph = v.position.vehicleId === selectedId;
              const full = toLatLngs(routePath(v.sourceCoord!, v.destCoord!));
              const trail = [...(v.position.trail ?? []).map((p) => [p.lat, p.lng] as [number, number]), [v.position.lat, v.position.lng] as [number, number]];
              return (
                <Fragment key={`r-${v.position.id}`}>
                  <Polyline positions={full} pathOptions={{ color: '#0b3d4f', weight: emph ? 9 : 8, opacity: dim ? 0.25 : 0.5 }} />
                  <Polyline positions={full} pathOptions={{ className: 'fp-route', color: '#ff8a1f', weight: emph ? 6 : 5, opacity: dim ? 0.4 : 1 }} />
                  {trail.length > 1 && (
                    <Polyline positions={trail} pathOptions={{ color: '#9db0b6', weight: emph ? 5 : 4, opacity: dim ? 0.3 : 0.9, dashArray: '2 7', lineCap: 'round' }} />
                  )}
                </Fragment>
              );
            })}

            {/* PICKUP + DROPOFF endpoint dots for active deliveries */}
            {inTransit.map((v) => (
              <Fragment key={`e-${v.position.id}`}>
                <CircleMarker
                  center={[v.sourceCoord!.lat, v.sourceCoord!.lng]}
                  radius={9}
                  pathOptions={{ color: '#fff', weight: 2.5, fillColor: PICKUP_COLOR, fillOpacity: 1 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]}>
                    📦 Pickup · {v.sourceName}
                  </Tooltip>
                </CircleMarker>
                <CircleMarker
                  center={[v.destCoord!.lat, v.destCoord!.lng]}
                  radius={9}
                  pathOptions={{ color: '#fff', weight: 2.5, fillColor: productColor(v.product), fillOpacity: 1 }}
                >
                  <Tooltip permanent direction="top" offset={[0, -8]}>
                    ⛽ {v.destName} · {v.quantity ? fmtQty(v.quantity) : ''} {v.product}
                  </Tooltip>
                </CircleMarker>
              </Fragment>
            ))}

            {/* trucks LAST so they paint on top of routes/endpoints — exactly on the line */}
            {filtered.map((v) => {
              const here = { lat: v.position.lat, lng: v.position.lng };
              const isSel = v.position.vehicleId === selectedId;
              const remainKm = v.destCoord ? distanceKm(here, v.destCoord) : null;
              const etaMin = remainKm != null ? Math.round((remainKm / AVG_SPEED_KMH) * 60) : null;
              const cargo = v.product && v.quantity ? `${fmtQty(v.quantity)} ${v.product}` : null;
              const moving = v.status === 'in_transit';
              return (
                <CircleMarker
                  key={`t-${v.position.id}`}
                  center={[v.position.lat, v.position.lng]}
                  radius={isSel ? 11 : 9}
                  pathOptions={{ color: '#fff', weight: 3, fillColor: statusColor(v.status), fillOpacity: 1 }}
                  eventHandlers={{ click: () => setSelectedId(v.position.vehicleId) }}
                >
                  {(moving || isSel) && (
                    <Tooltip permanent direction="right" offset={[10, 0]}>
                      🚚 {v.vehicleReg}
                    </Tooltip>
                  )}
                  {!moving && !isSel && <Tooltip direction="right" offset={[10, 0]}>🚚 {v.vehicleReg}</Tooltip>}
                  <Popup>
                    <strong>{v.vehicleReg}</strong> — {v.status.replace('_', ' ')}
                    <br />
                    Driver: {v.driverName}
                    {cargo && (
                      <>
                        <br />
                        Load: {cargo}
                      </>
                    )}
                    {v.destName && (
                      <>
                        <br />→ {v.destName}
                        {remainKm != null && ` (${Math.round(remainKm)} km · ~${fmtDuration(etaMin ?? 0)})`}
                      </>
                    )}
                    <br />
                    <span style={{ color: '#888' }}>Updated {fmtTime(v.position.updatedAt)}</span>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapView>
        </div>
        <VehicleListPanel vehicles={filtered} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}

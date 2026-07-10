import type { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import styles from './MapView.module.css';

export function MapView({
  center,
  zoom = 12,
  children,
}: {
  center: LatLngExpression;
  zoom?: number;
  children?: ReactNode;
}) {
  return (
    <MapContainer center={center} zoom={zoom} className={styles.map} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}

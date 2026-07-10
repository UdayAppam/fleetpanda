import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import { Search, Loader2, MapPin } from 'lucide-react';
import { reverseGeocode, searchAddress, type GeoResult } from '@/services/geocode';
import styles from './forms.module.css';

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6));
    },
  });
  return null;
}

function Recenter({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 14), { duration: 0.5 });
  }, [target, map]);
  return null;
}

// Search an address OR click the map → both fill coordinates + address (reverse geocoded).
// Geocoding is best-effort: if it fails/offline, coordinates still set and the address stays
// editable, so the form never breaks.
export function LocationPicker({
  lat,
  lng,
  onChange,
  onAddress,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  onAddress?: (address: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [target, setTarget] = useState<[number, number] | null>(null);
  const abort = useRef<AbortController | null>(null);

  // debounced forward search
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      setSearching(true);
      try {
        setResults(await searchAddress(query, abort.current.signal));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [query]);

  const pick = async (nlat: number, nlng: number, label?: string) => {
    onChange(nlat, nlng);
    setTarget([nlat, nlng]);
    if (label) {
      onAddress?.(label);
      return;
    }
    if (!onAddress) return;
    setResolving(true);
    try {
      const addr = await reverseGeocode(nlat, nlng);
      if (addr) onAddress(addr);
    } catch {
      /* offline / rate-limited → keep manual address */
    } finally {
      setResolving(false);
    }
  };

  const valid = Number.isFinite(lat) && Number.isFinite(lng);
  const center: [number, number] = valid ? [lat, lng] : [40.7128, -74.006];

  return (
    <div className={styles.pickerWrap}>
      <div className={styles.pickerSearch}>
        <Search size={15} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search an address…"
          aria-label="Search address"
        />
        {searching && <Loader2 size={14} className="spin" />}
      </div>
      {results.length > 0 && (
        <ul className={styles.pickerResults}>
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  pick(r.lat, r.lng, r.label);
                  setQuery('');
                  setResults([]);
                }}
              >
                <MapPin size={13} /> <span>{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <MapContainer center={center} zoom={12} className={styles.pickerMap} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <InvalidateOnMount />
        <Recenter target={target} />
        <ClickToPlace onPick={(la, ln) => pick(la, ln)} />
        {valid && (
          <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#0b7c86', fillOpacity: 1 }} />
        )}
      </MapContainer>
      <p className={styles.pickerHint}>
        {resolving ? 'Looking up address…' : 'Search or click the map — address & coordinates fill in automatically.'}
        {' · '}© OpenStreetMap
      </p>
    </div>
  );
}

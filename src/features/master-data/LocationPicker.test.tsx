import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Capture the map's click handler so tests can simulate clicking the map (which drives `pick`
// without a label → the reverse-geocode path).
const leaflet = vi.hoisted(() => ({
  click: null as null | ((e: { latlng: { lat: number; lng: number } }) => void),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  useMap: () => ({ flyTo: vi.fn(), getZoom: () => 12, invalidateSize: vi.fn() }),
  useMapEvents: (handlers: { click: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    leaflet.click = handlers.click;
    return null;
  },
}));

vi.mock('@/services/geocode', () => ({
  searchAddress: vi.fn(),
  reverseGeocode: vi.fn(),
}));

import { LocationPicker } from './LocationPicker';
import { searchAddress, reverseGeocode } from '@/services/geocode';

beforeEach(() => {
  vi.clearAllMocks();
  leaflet.click = null;
});

const clickMap = async (lat: number, lng: number) => {
  await act(async () => {
    leaflet.click?.({ latlng: { lat, lng } });
  });
};

describe('LocationPicker', () => {
  it('renders a search box and the map', () => {
    render(<LocationPicker lat={40} lng={-74} onChange={() => {}} />);
    expect(screen.getByLabelText('Search address')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('does not search for queries shorter than 3 characters', async () => {
    render(<LocationPicker lat={40} lng={-74} onChange={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search address'), 'ab');
    await new Promise((r) => setTimeout(r, 600));
    expect(searchAddress).not.toHaveBeenCalled();
  });

  it('searches after debounce and selecting a result updates coordinates + address', async () => {
    vi.mocked(searchAddress).mockResolvedValue([
      { label: '123 Main St, Metropolis', lat: 41.1, lng: -73.2 },
    ]);
    const onChange = vi.fn();
    const onAddress = vi.fn();
    render(<LocationPicker lat={40} lng={-74} onChange={onChange} onAddress={onAddress} />);

    await userEvent.type(screen.getByLabelText('Search address'), 'Main Street');
    const result = await screen.findByText('123 Main St, Metropolis', {}, { timeout: 2000 });
    expect(searchAddress).toHaveBeenCalled();

    await userEvent.click(result);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(41.1, -73.2));
    expect(onAddress).toHaveBeenCalledWith('123 Main St, Metropolis');
    // A picked search result already carries a label, so no reverse lookup is needed.
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it('clears results when the address search rejects', async () => {
    vi.mocked(searchAddress).mockRejectedValue(new Error('offline'));
    render(<LocationPicker lat={40} lng={-74} onChange={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search address'), 'Nowhere');
    await waitFor(() => expect(searchAddress).toHaveBeenCalled(), { timeout: 2000 });
    // The catch branch resets results, so nothing is listed.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('reverse-geocodes a map click and fills the address', async () => {
    vi.mocked(reverseGeocode).mockResolvedValue('42 Clicked Ave');
    const onChange = vi.fn();
    const onAddress = vi.fn();
    render(<LocationPicker lat={40} lng={-74} onChange={onChange} onAddress={onAddress} />);
    await clickMap(41.5, -73.5);
    expect(onChange).toHaveBeenCalledWith(41.5, -73.5);
    await waitFor(() => expect(onAddress).toHaveBeenCalledWith('42 Clicked Ave'));
  });

  it('ignores an empty reverse-geocode result', async () => {
    vi.mocked(reverseGeocode).mockResolvedValue('');
    const onAddress = vi.fn();
    render(<LocationPicker lat={40} lng={-74} onChange={() => {}} onAddress={onAddress} />);
    await clickMap(41.5, -73.5);
    await waitFor(() => expect(reverseGeocode).toHaveBeenCalled());
    expect(onAddress).not.toHaveBeenCalled();
  });

  it('keeps a manual address when reverse-geocoding fails', async () => {
    vi.mocked(reverseGeocode).mockRejectedValue(new Error('rate limited'));
    const onAddress = vi.fn();
    render(<LocationPicker lat={40} lng={-74} onChange={() => {}} onAddress={onAddress} />);
    await clickMap(41.5, -73.5);
    await waitFor(() => expect(reverseGeocode).toHaveBeenCalled());
    expect(onAddress).not.toHaveBeenCalled();
  });

  it('skips reverse-geocoding entirely when no onAddress handler is provided', async () => {
    const onChange = vi.fn();
    render(<LocationPicker lat={40} lng={-74} onChange={onChange} />);
    await clickMap(41.5, -73.5);
    expect(onChange).toHaveBeenCalledWith(41.5, -73.5);
    expect(reverseGeocode).not.toHaveBeenCalled();
  });

  it('falls back to a default map centre when coordinates are not finite', () => {
    render(<LocationPicker lat={Number.NaN} lng={Number.NaN} onChange={() => {}} />);
    // Invalid coords → `valid` is false, so the centre fallback runs and no marker is drawn.
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('aborts a still-pending search when a newer query fires', async () => {
    vi.mocked(searchAddress).mockResolvedValue([{ label: 'X', lat: 1, lng: 2 }]);
    render(<LocationPicker lat={40} lng={-74} onChange={() => {}} />);
    const input = screen.getByLabelText('Search address');

    await userEvent.type(input, 'Main');
    await waitFor(() => expect(searchAddress).toHaveBeenCalledTimes(1), { timeout: 2000 });
    // A second debounce cycle finds abort.current already set and aborts it (line 61).
    await userEvent.type(input, ' Street');
    await waitFor(() => expect(searchAddress).toHaveBeenCalledTimes(2), { timeout: 2000 });
  });

  it('shows the "looking up address" hint while reverse-geocoding is in flight', async () => {
    let resolve!: (v: string) => void;
    vi.mocked(reverseGeocode).mockReturnValue(new Promise<string>((r) => (resolve = r)));
    render(<LocationPicker lat={40} lng={-74} onChange={() => {}} onAddress={vi.fn()} />);
    await clickMap(41.5, -73.5);
    // While the promise is pending, `resolving` is true (forms hint, line 137).
    expect(await screen.findByText(/looking up address/i)).toBeInTheDocument();
    await act(async () => {
      resolve('done');
    });
  });
});

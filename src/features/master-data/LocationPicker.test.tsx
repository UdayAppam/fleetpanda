import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: () => null,
  useMap: () => ({ flyTo: vi.fn(), getZoom: () => 12, invalidateSize: vi.fn() }),
  useMapEvents: () => null,
}));

vi.mock('@/services/geocode', () => ({
  searchAddress: vi.fn(),
  reverseGeocode: vi.fn(),
}));

import { LocationPicker } from './LocationPicker';
import { searchAddress, reverseGeocode } from '@/services/geocode';

beforeEach(() => {
  vi.clearAllMocks();
});

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
});

import type { ReactNode } from 'react';

// Shared jsdom-safe stand-in for react-leaflet. Real Leaflet needs a DOM canvas/size that
// jsdom doesn't provide, so tests mock the module with these lightweight renderers.
//
// Usage in a test file:
//   vi.mock('react-leaflet', () => reactLeafletMock);
//
// CircleMarker forwards its click handler so tests can drive marker selection.

interface MarkerProps {
  children?: ReactNode;
  eventHandlers?: { click?: () => void };
}

export const reactLeafletMock = {
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  CircleMarker: ({ children, eventHandlers }: MarkerProps) => (
    <button type="button" data-testid="marker" onClick={() => eventHandlers?.click?.()}>
      {children}
    </button>
  ),
  Polyline: () => <div data-testid="polyline" />,
  Popup: ({ children }: { children?: ReactNode }) => <div data-testid="popup">{children}</div>,
  Tooltip: ({ children }: { children?: ReactNode }) => <div data-testid="tooltip">{children}</div>,
  useMap: () => ({ flyTo: () => {}, getZoom: () => 12, invalidateSize: () => {} }),
  useMapEvents: () => null,
};

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { reactLeafletMock } from '@/test/reactLeafletMock';

vi.mock('react-leaflet', () => reactLeafletMock);

import { MapView } from './MapView';
import { MapController } from './MapController';

describe('MapView', () => {
  it('renders a map container with its children', () => {
    render(
      <MapView center={[40, -74]}>
        <div>overlay</div>
      </MapView>,
    );
    expect(screen.getByTestId('map')).toBeInTheDocument();
    expect(screen.getByText('overlay')).toBeInTheDocument();
  });

  it('accepts a custom zoom', () => {
    render(<MapView center={[40, -74]} zoom={9} />);
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });
});

describe('MapController', () => {
  it('renders nothing and tolerates a null target', () => {
    const { container } = render(<MapController target={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('flies to a target when one is provided', () => {
    const { container } = render(<MapController target={[41, -73]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

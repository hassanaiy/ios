import React from 'react';
import { Map as GoogleMap } from './Map';
import { MapboxMap } from './MapboxMap';
import { MapProviderService } from '../services/MapProviderService';
import { Coordinates } from '../types';

interface DynamicMapProps {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  pickupAddress?: string;
  dropoffAddress?: string;
  drivers?: { id: string; lat: number; lng: number; heading?: number }[];
  onMapClick?: (coords: Coordinates, address?: string) => void;
  onMapDrag?: () => void;
  onMapMove?: () => void;
  onMapMoveEnd?: (center: Coordinates) => void;
  showRoute?: boolean;
  routeStart?: Coordinates | null;
  routeEnd?: Coordinates | null;
  mapHeight?: string | number;
  centerOn?: Coordinates | null;
  bottomPadding?: number;
  topPadding?: number;
  showLocationPopup?: boolean;
  currentAddress?: string;
  showUserOverlay?: boolean;
  userLocation?: Coordinates | null;
  heatPoints?: Coordinates[];
  isMapAutoFollowing?: boolean;
  isSearchingForDrivers?: boolean;
  navigationFollowMode?: boolean;
  driverHeading?: number;
}

const coordsEqual = (a?: Coordinates | null, b?: Coordinates | null): boolean => {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
};

const driversEqual = (
  a?: { id: string; lat: number; lng: number; heading?: number; isNearby?: boolean; isSelected?: boolean }[],
  b?: { id: string; lat: number; lng: number; heading?: number; isNearby?: boolean; isSelected?: boolean }[]
): boolean => {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const da = a[i];
    const db = b[i];
    if (
      da.id !== db.id ||
      Math.abs(da.lat - db.lat) > 1e-5 ||
      Math.abs(da.lng - db.lng) > 1e-5 ||
      Math.abs((da.heading || 0) - (db.heading || 0)) > 2 ||
      Boolean(da.isNearby) !== Boolean(db.isNearby) ||
      Boolean(da.isSelected) !== Boolean(db.isSelected)
    ) {
      return false;
    }
  }
  return true;
};

const DynamicMapComponent: React.FC<DynamicMapProps> = (props) => {
    const provider = MapProviderService.getProvider();
    const token = MapProviderService.getMapboxToken();

    if (provider === 'mapbox' && token) {
        return (
            <MapboxMap 
                {...props} 
                mapboxToken={token} 
                onError={() => {
                    MapProviderService.setFallbackToGoogle();
                    window.location.reload();
                }} 
            />
        );
    }

    // Default Fallback
    return <GoogleMap {...props} />;
};

export const DynamicMap = React.memo(DynamicMapComponent, (prev, next) => {
  return (
    coordsEqual(prev.pickup, next.pickup) &&
    coordsEqual(prev.dropoff, next.dropoff) &&
    prev.pickupAddress === next.pickupAddress &&
    prev.dropoffAddress === next.dropoffAddress &&
    prev.showRoute === next.showRoute &&
    coordsEqual(prev.routeStart, next.routeStart) &&
    coordsEqual(prev.routeEnd, next.routeEnd) &&
    coordsEqual(prev.centerOn, next.centerOn) &&
    Math.abs((prev.bottomPadding || 0) - (next.bottomPadding || 0)) < 6 &&
    Math.abs((prev.topPadding || 0) - (next.topPadding || 0)) < 6 &&
    prev.showUserOverlay === next.showUserOverlay &&
    coordsEqual(prev.userLocation, next.userLocation) &&
    prev.isMapAutoFollowing === next.isMapAutoFollowing &&
    prev.isSearchingForDrivers === next.isSearchingForDrivers &&
    prev.navigationFollowMode === next.navigationFollowMode &&
    Math.abs((prev.driverHeading || 0) - (next.driverHeading || 0)) < 2 &&
    driversEqual(prev.drivers, next.drivers) &&
    prev.heatPoints === next.heatPoints
  );
});

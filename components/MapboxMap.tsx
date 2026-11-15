import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Coordinates } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { reverseGeocodeDetailed } from '../services/placesService';

// Icons
const USER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="rgba(66, 133, 244, 0.2)"/><circle cx="12" cy="12" r="6" fill="#4285F4" stroke="#ffffff" stroke-width="2"/></svg>`;
const PICKUP_ICON = `<div style="position:relative; display:flex; flex-direction:column; align-items:center; pointer-events:none; filter:drop-shadow(0 8px 16px rgba(37,99,235,0.38));">
  <svg width="36" height="46" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 50 C18.8 47.8 4 30.5 4 18 C4 9.16 11.16 2 20 2 C28.84 2 36 9.16 36 18 C36 30.5 21.2 47.8 20 50 Z" fill="#2563EB"/>
    <circle cx="20" cy="18" r="12" fill="#FFFFFF"/>
    <circle cx="20" cy="18" r="6" fill="#2563EB"/>
    <circle cx="20" cy="18" r="2.2" fill="#FFFFFF"/>
  </svg>
  <div style="width:18px; height:5px; background:rgba(37,99,235,0.3); border-radius:50%; margin-top:-2px; filter:blur(1px);"></div>
</div>`;
const DROPOFF_ICON = `<div style="position:relative; display:flex; flex-direction:column; align-items:center; pointer-events:none; filter:drop-shadow(0 8px 16px rgba(37,99,235,0.38));">
  <svg width="36" height="46" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 50 C18.8 47.8 4 30.5 4 18 C4 9.16 11.16 2 20 2 C28.84 2 36 9.16 36 18 C36 30.5 21.2 47.8 20 50 Z" fill="#1D4ED8"/>
    <circle cx="20" cy="18" r="12" fill="#FFFFFF"/>
    <path d="M15 11v11M15 12h7l-1.5 2.5 1.5 2.5h-7" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#2563EB"/>
  </svg>
  <div style="width:18px; height:5px; background:rgba(37,99,235,0.3); border-radius:50%; margin-top:-2px; filter:blur(1px);"></div>
</div>`;
const CAR_ICON = `<svg width="42" height="42" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
  <polygon points="17.5,10.5 13.5,2 21.5,2 20.2,10.5" fill="rgba(59, 130, 246, 0.24)" />
  <polygon points="30.5,10.5 26.5,2 34.5,2 32.8,10.5" fill="rgba(59, 130, 246, 0.24)" />
  <rect x="16.5" y="10.5" width="17.5" height="31.5" rx="8.5" fill="rgba(15, 23, 42, 0.30)" />
  <rect x="14" y="13.5" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
  <rect x="31.4" y="13.5" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
  <rect x="14" y="29" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
  <rect x="31.4" y="29" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
  <path d="M15.4 18.2L13.1 19.1C12.7 19.3 12.7 19.9 13.1 20.1L15.4 20.5V18.2Z" fill="#1E293B" />
  <path d="M32.6 18.2L34.9 19.1C35.3 19.3 35.3 19.9 34.9 20.1L32.6 20.5V18.2Z" fill="#1E293B" />
  <rect x="15.2" y="8.5" width="17.6" height="31.5" rx="7.8" fill="#FFFFFF" stroke="#1E293B" stroke-width="1.35" />
  <path d="M18.2 11.2C20.5 10.2 27.5 10.2 29.8 11.2L28.6 16.2H19.4L18.2 11.2Z" fill="#F1F5F9" />
  <line x1="24" y1="9.8" x2="24" y2="15.4" stroke="#E2E8F0" stroke-width="0.9" stroke-linecap="round" />
  <path d="M17.5 16.4C17.8 14.9 20.2 14.3 24 14.3C27.8 14.3 30.2 14.9 30.5 16.4L31 21.8V29.8L30.2 34.6C29.7 36.1 27.4 36.7 24 36.7C20.6 36.7 18.3 36.1 17.8 34.6L17 29.8V21.8L17.5 16.4Z" fill="#0F172A" />
  <path d="M19.2 16.3C21.2 15.6 24.4 15.5 27.4 16L25.2 19.5H18.8L19.2 16.3Z" fill="rgba(56, 189, 248, 0.24)" />
  <rect x="18.6" y="20.4" width="10.8" height="10.2" rx="3.4" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="0.6" />
  <rect x="22.8" y="21.8" width="2.4" height="7.4" rx="1.2" fill="#2563EB" />
  <path d="M16.8 10.3C17.4 9.5 18.9 9.2 20.1 9.5L19.5 10.9L16.8 10.8V10.3Z" fill="#E0F2FE" stroke="#2563EB" stroke-width="0.5" />
  <path d="M31.2 10.3C30.6 9.5 29.1 9.2 27.9 9.5L28.5 10.9L31.2 10.8V10.3Z" fill="#E0F2FE" stroke="#2563EB" stroke-width="0.5" />
  <rect x="16.9" y="38.1" width="3.8" height="1.4" rx="0.7" fill="#EF4444" />
  <rect x="27.3" y="38.1" width="3.8" height="1.4" rx="0.7" fill="#EF4444" />
</svg>`;

const approxMetersMbox = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const latRad = ((a.lat + b.lat) * 0.5 * Math.PI) / 180;
  const dy = (b.lat - a.lat) * 111132;
  const dx = (b.lng - a.lng) * 111320 * Math.cos(latRad);
  return Math.hypot(dx, dy);
};

const projectPointToGeoJsonRoute = (
  point: { lat: number; lng: number },
  coords: [number, number][]
): { distMeters: number; trimmed: [number, number][] } => {
  if (!coords || coords.length < 2) {
    return { distMeters: Infinity, trimmed: coords || [] };
  }
  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  let bestDist = Infinity;
  let bestSegIdx = 0;
  let bestT = 0;
  let bestProj: [number, number] = coords[0];

  for (let i = 0; i < coords.length - 1; i++) {
    const aLng = coords[i][0];
    const aLat = coords[i][1];
    const bLng = coords[i + 1][0];
    const bLat = coords[i + 1][1];

    const ax = aLng * cosLat;
    const ay = aLat;
    const bx = bLng * cosLat;
    const by = bLat;
    const px = point.lng * cosLat;
    const py = point.lat;

    const abx = bx - ax;
    const aby = by - ay;
    const abLenSq = abx * abx + aby * aby;
    let t = abLenSq > 1e-12 ? ((px - ax) * abx + (py - ay) * aby) / abLenSq : 0;
    t = Math.max(0, Math.min(1, t));

    const projLat = aLat + (bLat - aLat) * t;
    const projLng = aLng + (bLng - aLng) * t;
    const d = approxMetersMbox(point, { lat: projLat, lng: projLng });
    if (d < bestDist) {
      bestDist = d;
      bestSegIdx = i;
      bestT = t;
      bestProj = [projLng, projLat];
    }
  }

  const trimmed: [number, number][] = bestT >= 0.999 && bestSegIdx + 1 < coords.length - 1
    ? coords.slice(bestSegIdx + 1)
    : [bestProj, ...coords.slice(bestSegIdx + 1)];

  return { distMeters: bestDist, trimmed };
};

const createMarkerElement = (svg: string, label?: string, color?: string, radarType: 'passenger' | 'driver' | 'nearby' | 'none' = 'none') => {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.width = '52px';
  container.style.height = '52px';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';

  if (label && label.trim() !== '') {
    const labelContainer = document.createElement('div');
    labelContainer.style.position = 'absolute';
    labelContainer.style.bottom = '52px'; // Distance above the pin
    labelContainer.style.left = '50%';
    labelContainer.style.transform = 'translateX(-50%)';
    labelContainer.style.display = 'flex';
    labelContainer.style.flexDirection = 'column';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.zIndex = '2';
    labelContainer.style.pointerEvents = 'none';

    const labelBubble = document.createElement('div');
    labelBubble.textContent = label;
    labelBubble.style.backgroundColor = color || '#1A73E8';
    labelBubble.style.color = 'white';
    labelBubble.style.padding = '8px 16px';
    labelBubble.style.borderRadius = '12px';
    labelBubble.style.fontSize = '13px';
    labelBubble.style.fontWeight = 'bold';
    labelBubble.style.whiteSpace = 'nowrap';
    labelBubble.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    labelBubble.dir = 'auto';

    const labelArrow = document.createElement('div');
    labelArrow.style.width = '0';
    labelArrow.style.height = '0';
    labelArrow.style.borderLeft = '7px solid transparent';
    labelArrow.style.borderRight = '7px solid transparent';
    labelArrow.style.borderTop = `7px solid ${color || '#1A73E8'}`;
    labelArrow.style.marginTop = '-1px';

    labelContainer.appendChild(labelBubble);
    labelContainer.appendChild(labelArrow);
    container.appendChild(labelContainer);
  }

  if (radarType === 'driver' || radarType === 'nearby') {
    const aura = document.createElement('div');
    aura.className = radarType === 'nearby' ? 'driver-marker-aura driver-marker-aura--active' : 'driver-marker-aura';
    container.appendChild(aura);

    const inner = document.createElement('div');
    inner.className = 'driver-marker-inner';
    inner.innerHTML = CAR_ICON;
    container.appendChild(inner);
    return container;
  }

  if (radarType !== 'none') {
    const radar = document.createElement('div');
    radar.className = `marker-radar radar-${radarType}`;
    
    for (let i = 1; i <= 3; i++) {
      const wave = document.createElement('div');
      wave.className = `marker-radar-wave wave-${i}`;
      radar.appendChild(wave);
    }
    container.appendChild(radar);
  }

  const icon = document.createElement('div');
  icon.innerHTML = svg;
  icon.style.zIndex = '1';
  container.appendChild(icon);
  return container;
};

interface MapboxMapProps {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  pickupAddress?: string;
  dropoffAddress?: string;
  drivers?: { id: string; lat: number; lng: number; heading?: number; isNearby?: boolean }[];
  onMapClick?: (coords: Coordinates, address?: string) => void;
  onMapDrag?: () => void;
  onMapMove?: () => void;
  onMapMoveEnd?: (center: Coordinates) => void;
  showRoute?: boolean;
  centerOn?: Coordinates | null;
  bottomPadding?: number;
  topPadding?: number;
  mapboxToken: string;
  onError?: () => void;
  showUserOverlay?: boolean;
  userLocation?: Coordinates | null;
  heatPoints?: Coordinates[];
  isMapAutoFollowing?: boolean;
  isSearchingForDrivers?: boolean;
  routeStart?: Coordinates | null;
  routeEnd?: Coordinates | null;
  navigationFollowMode?: boolean;
  driverHeading?: number;
}

export const MapboxMap: React.FC<MapboxMapProps> = ({
  pickup,
  dropoff,
  pickupAddress,
  dropoffAddress,
  drivers = [],
  onMapClick,
  onMapDrag,
  onMapMove,
  onMapMoveEnd,
  showRoute,
  routeStart,
  routeEnd,
  centerOn,
  bottomPadding = 0,
  topPadding = 0,
  mapboxToken,
  onError,
  showUserOverlay,
  userLocation,
  heatPoints,
  isMapAutoFollowing = true,
  isSearchingForDrivers = false,
  navigationFollowMode = false,
  driverHeading = 0
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  
  const { language } = useLanguage();

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!map.current) {
      try {
        mapboxgl.accessToken = mapboxToken;
        map.current = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: centerOn ? [centerOn.lng, centerOn.lat] : [32.7160, 26.1551],
          zoom: 14
        });
      } catch (err) {
        console.error('Mapbox initialization error', err);
        if (onError) onError();
        return;
      }
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainer.current) {
      ro = new ResizeObserver(() => {
        map.current?.resize();
      });
      ro.observe(mapContainer.current);
    }

    return () => {
      if (ro) ro.disconnect();
    };
  }, [mapboxToken]);

  const onMapClickRef = useRef(onMapClick);
  const onMapDragRef = useRef(onMapDrag);
  const onMapMoveRef = useRef(onMapMove);
  const onMapMoveEndRef = useRef(onMapMoveEnd);
  const languageRef = useRef(language);
  const driversRef = useRef(drivers);
  const hasZoomedOutMapboxRef = useRef(false);

  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onMapDragRef.current = onMapDrag;
    onMapMoveRef.current = onMapMove;
    onMapMoveEndRef.current = onMapMoveEnd;
    languageRef.current = language;
  }, [onMapClick, onMapDrag, onMapMove, onMapMoveEnd, language]);

  useEffect(() => {
    if (!map.current) return;
    
    let isDragging = false;
    
    const clickHandler = (e: mapboxgl.MapMouseEvent) => {
        if (isDragging) return;
        const lat = e.lngLat.lat;
        const lng = e.lngLat.lng;
        if (onMapClickRef.current) {
            const fetchAddress = async () => {
              try {
                const detailed = await reverseGeocodeDetailed(
                  { lat, lng },
                  languageRef.current === 'ar' ? 'ar' : 'en'
                );
                if (onMapClickRef.current) {
                  onMapClickRef.current({ lat, lng }, detailed.address || undefined);
                }
              } catch {
                if (onMapClickRef.current) onMapClickRef.current({ lat, lng });
              }
            };
            fetchAddress();
        }
    };
    
    const dragHandler = () => {
        isDragging = true;
        if (onMapDragRef.current) onMapDragRef.current();
    };

    const moveHandler = () => {
        if (onMapMoveRef.current) onMapMoveRef.current();
    };

    const moveEndHandler = () => {
        if (onMapMoveEndRef.current && map.current) {
            const center = map.current.getCenter();
            onMapMoveEndRef.current({ lat: center.lat, lng: center.lng });
            setTimeout(() => { isDragging = false; }, 200);
        }
    };

    map.current.on('click', clickHandler);
    map.current.on('dragstart', dragHandler);
    map.current.on('move', moveHandler);
    map.current.on('moveend', moveEndHandler);

    return () => {
        if (map.current) {
            map.current.off('click', clickHandler);
            map.current.off('dragstart', dragHandler);
            map.current.off('move', moveHandler);
            map.current.off('moveend', moveEndHandler);
        }
    };
  }, []);

  const centerOnStr = centerOn ? `${centerOn.lat.toFixed(6)},${centerOn.lng.toFixed(6)}` : '';
  const lastCamCoordRef = useRef<Coordinates | null>(null);
  const lastCamBearingRef = useRef<number>(0);
  const lastCamPaddingRef = useRef<{ top: number; bottom: number } | null>(null);
  const lastCamNavRef = useRef<boolean>(false);
  const lastCamAutoFollowRef = useRef<boolean>(false);

  // Handle centerOn, navigationFollowMode camera pitch/zoom, and dynamic bottom sheet padding
  useEffect(() => {
    if (!map.current || !centerOn || !isMapAutoFollowing || isSearchingForDrivers) {
      lastCamAutoFollowRef.current = isMapAutoFollowing;
      return;
    }

    const safeTop = Math.round(topPadding || 20);
    const safeBottom = Math.round(bottomPadding || 20);
    const targetBearing =
      navigationFollowMode && typeof driverHeading === 'number' && !isNaN(driverHeading)
        ? driverHeading
        : 0;

    const justReEnabledFollow = !lastCamAutoFollowRef.current;
    const navChanged = lastCamNavRef.current !== navigationFollowMode;
    const movedMeters = lastCamCoordRef.current
      ? approxMetersMbox(lastCamCoordRef.current, centerOn)
      : Infinity;
    const bearingDelta = Math.abs((((targetBearing - lastCamBearingRef.current) % 360) + 540) % 360 - 180);
    const paddingDelta = lastCamPaddingRef.current
      ? Math.max(
          Math.abs(lastCamPaddingRef.current.top - safeTop),
          Math.abs(lastCamPaddingRef.current.bottom - safeBottom)
        )
      : Infinity;

    const moveThreshold = navigationFollowMode ? 8 : 14;
    if (
      !justReEnabledFollow &&
      !navChanged &&
      movedMeters < moveThreshold &&
      (!navigationFollowMode || bearingDelta < 6) &&
      paddingDelta < 18
    ) {
      return;
    }

    lastCamAutoFollowRef.current = true;
    lastCamNavRef.current = navigationFollowMode;
    lastCamCoordRef.current = { lat: centerOn.lat, lng: centerOn.lng };
    lastCamBearingRef.current = targetBearing;
    lastCamPaddingRef.current = { top: safeTop, bottom: safeBottom };

    if (navigationFollowMode) {
      const currentZoom = map.current.getZoom();
      map.current.easeTo({
        center: [centerOn.lng, centerOn.lat],
        zoom: navChanged || currentZoom < 15.2 ? 16.8 : currentZoom,
        pitch: 42,
        bearing: targetBearing,
        padding: {
          top: safeTop + 24,
          bottom: safeBottom + 40,
          left: 24,
          right: 24
        },
        duration: 450,
        essential: true
      });
    } else {
      map.current.easeTo({
        center: [centerOn.lng, centerOn.lat],
        pitch: 0,
        bearing: 0,
        padding: {
          top: safeTop + 16,
          bottom: safeBottom + 28,
          left: 24,
          right: 24
        },
        duration: 350,
        essential: true
      });
    }
  }, [centerOnStr, bottomPadding, topPadding, isMapAutoFollowing, isSearchingForDrivers, navigationFollowMode, driverHeading]);

  // Silky smooth continuous zoom-out animation when searching for drivers (one time only)
  // Starts at passenger marker's current location, then eases out in slow motion to cover direction + nearby drivers
  useEffect(() => {
    if (!isSearchingForDrivers) {
      hasZoomedOutMapboxRef.current = false;
      return;
    }
    if (!map.current || hasZoomedOutMapboxRef.current) return;

    hasZoomedOutMapboxRef.current = true;
    const m = map.current;
    m.stop();

    const isValidCoord = (c?: Coordinates | null): c is Coordinates =>
      !!c && typeof c.lat === 'number' && !isNaN(c.lat) && typeof c.lng === 'number' && !isNaN(c.lng) && (c.lat !== 0 || c.lng !== 0);

    const passengerAnchor: Coordinates = isValidCoord(pickup)
      ? pickup
      : isValidCoord(userLocation)
        ? userLocation
        : isValidCoord(centerOn)
          ? centerOn
          : { lat: 26.1551, lng: 32.7160 };

    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const safeBottom = Math.min(Math.max((bottomPadding || 0) + 32, Math.round(vh * 0.40)), Math.round(vh * 0.56));
    const safeTop = Math.min(Math.max((topPadding || 0) + 20, 88), Math.round(vh * 0.24));

    const startZoom = 15.8;
    m.jumpTo({
      center: [passengerAnchor.lng, passengerAnchor.lat],
      zoom: startZoom,
      padding: { top: safeTop, bottom: safeBottom, left: 48, right: 48 },
    });

    const delayTimer = window.setTimeout(() => {
      if (!map.current) return;

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([passengerAnchor.lng, passengerAnchor.lat]);

      if (isValidCoord(pickup)) {
        bounds.extend([pickup.lng, pickup.lat]);
      }
      if (isValidCoord(dropoff)) {
        bounds.extend([dropoff.lng, dropoff.lat]);
      }

      const tripDistKm =
        isValidCoord(pickup) && isValidCoord(dropoff)
          ? Math.hypot((dropoff.lat - pickup.lat) * 111, (dropoff.lng - pickup.lng) * 100)
          : 3.5;
      const nearbyRadiusKm = Math.max(12, Math.min(35, tripDistKm * 1.4));

      const validDrivers = (driversRef.current || [])
        .filter((d) => isValidCoord(d))
        .map((d) => ({
          ...d,
          _km: Math.hypot((d.lat - passengerAnchor.lat) * 111, (d.lng - passengerAnchor.lng) * 100),
        }))
        .sort((a, b) => a._km - b._km);

      const nearbyDrivers = validDrivers.filter((d) => d._km <= nearbyRadiusKm);
      const driversToFrame = nearbyDrivers.length > 0 ? nearbyDrivers : validDrivers.filter((d) => d._km <= 25).slice(0, 8);

      for (const d of driversToFrame) {
        bounds.extend([d.lng, d.lat]);
      }

      const cam = m.cameraForBounds(bounds, {
        padding: { top: safeTop, bottom: safeBottom, left: 48, right: 48 },
        maxZoom: 15.2,
      });

      if (!cam) return;

      const targetZoom = Math.max(10, Math.min(15.2, cam.zoom ?? 13.5));
      m.easeTo({
        center: cam.center || [passengerAnchor.lng, passengerAnchor.lat],
        zoom: targetZoom,
        padding: { top: safeTop, bottom: safeBottom, left: 48, right: 48 },
        duration: 3000,
        easing: (t) => 1 - Math.pow(1 - t, 2.4),
      });
    }, 220);

    return () => {
      window.clearTimeout(delayTimer);
      m.stop();
    };
  }, [isSearchingForDrivers]);

  const startPoint = routeStart || pickup;
  const endPoint = routeEnd || dropoff;
  const routeStartStr = startPoint ? `${startPoint.lat.toFixed(6)},${startPoint.lng.toFixed(6)}` : '';
  const routeEndStr = endPoint ? `${endPoint.lat.toFixed(6)},${endPoint.lng.toFixed(6)}` : '';
  const lastMboxEndStrRef = useRef<string>('');
  const lastMboxNavRef = useRef<boolean>(navigationFollowMode);
  const lastMboxFitKeyRef = useRef<string>('');
  const mboxRouteCoordsRef = useRef<[number, number][]>([]);
  const mboxRouteDestRef = useRef<string>('');
  const mboxRouteAbortRef = useRef<AbortController | null>(null);
  const mboxRouteSeqRef = useRef<number>(0);
  const lastMboxRerouteAtRef = useRef<number>(0);

  const upsertRouteSource = (m: mapboxgl.Map, coordinates: [number, number][]) => {
    const routeId = 'route-line';
    const casingId = 'route-casing';
    const featureCollection = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates
      }
    };
    const existing = m.getSource(routeId) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(featureCollection);
      return;
    }
    m.addSource(routeId, { type: 'geojson', data: featureCollection });
    m.addLayer({
      id: casingId,
      type: 'line',
      source: routeId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#0F172A', 'line-width': 9, 'line-opacity': 0.95 }
    });
    m.addLayer({
      id: routeId,
      type: 'line',
      source: routeId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#2563EB', 'line-width': 5.5, 'line-opacity': 1.0 }
    });
  };

  const fitMapboxRouteBounds = (
    m: mapboxgl.Map,
    coordinates: [number, number][],
    endKey: string
  ) => {
    if (!isMapAutoFollowing || isSearchingForDrivers || navigationFollowMode || coordinates.length < 2) {
      return;
    }
    const fitKey = `${endKey}|${Math.round(topPadding / 24)}|${Math.round(bottomPadding / 24)}`;
    if (lastMboxFitKeyRef.current === fitKey) return;
    lastMboxFitKeyRef.current = fitKey;

    const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
    for (const coord of coordinates) {
      bounds.extend([coord[0], coord[1]]);
    }
    const vh = mapContainer.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
    const minUsable = Math.max(170, Math.round(vh * 0.34));
    let safeBottom = Math.min(Math.max((bottomPadding || 0) + 24, 90), Math.round(vh * 0.50));
    let safeTop = Math.min(Math.max((topPadding || 0) + 18, 72), Math.round(vh * 0.24));
    if (safeTop + safeBottom > vh - minUsable) {
      const excess = (safeTop + safeBottom) - (vh - minUsable);
      const share = safeBottom / (safeTop + safeBottom);
      safeBottom = Math.max(24, Math.round(safeBottom - excess * share));
      safeTop = Math.max(24, Math.round(safeTop - excess * (1 - share)));
    }
    m.fitBounds(bounds, {
      pitch: 0,
      bearing: 0,
      maxZoom: 16.5,
      padding: { top: safeTop, bottom: safeBottom, left: 48, right: 48 }
    });
  };

  // Build / Trim Route (decoupled from padding changes so padding never refetches OSRM)
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    if (!startPoint || !endPoint || !showRoute) {
      if (mboxRouteAbortRef.current) {
        mboxRouteAbortRef.current.abort();
        mboxRouteAbortRef.current = null;
      }
      lastMboxEndStrRef.current = '';
      lastMboxFitKeyRef.current = '';
      mboxRouteCoordsRef.current = [];
      mboxRouteDestRef.current = '';
      const routeId = 'route-line';
      if (m.getSource(routeId)) {
        (m.getSource(routeId) as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }
      return;
    }

    const sameDest = mboxRouteDestRef.current === routeEndStr;
    if (sameDest && mboxRouteCoordsRef.current.length >= 2) {
      const proj = projectPointToGeoJsonRoute(startPoint, mboxRouteCoordsRef.current);
      if (proj.distMeters <= 65 && proj.trimmed.length >= 2) {
        mboxRouteCoordsRef.current = proj.trimmed;
        upsertRouteSource(m, proj.trimmed);
        return;
      }
      if (Date.now() - lastMboxRerouteAtRef.current < 8000) {
        return;
      }
    }

    if (mboxRouteAbortRef.current) {
      mboxRouteAbortRef.current.abort();
    }
    const controller = new AbortController();
    mboxRouteAbortRef.current = controller;
    const seq = ++mboxRouteSeqRef.current;

    const fetchRoute = async () => {
      try {
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (controller.signal.aborted || seq !== mboxRouteSeqRef.current || !map.current) return;

        if (data && data.routes && data.routes.length > 0 && Array.isArray(data.routes[0].geometry?.coordinates)) {
          const coordinates: [number, number][] = data.routes[0].geometry.coordinates;
          mboxRouteCoordsRef.current = coordinates;
          mboxRouteDestRef.current = routeEndStr;
          lastMboxRerouteAtRef.current = Date.now();
          upsertRouteSource(map.current, coordinates);

          const isEndChanged = routeEndStr !== lastMboxEndStrRef.current;
          if (isEndChanged) {
            lastMboxEndStrRef.current = routeEndStr;
            fitMapboxRouteBounds(map.current, coordinates, routeEndStr);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('OSRM Mapbox Route error', err);
      }
    };
    fetchRoute();

    return () => {
      controller.abort();
    };
  }, [routeStartStr, routeEndStr, showRoute]);

  // Refit route overview bounds only when switching out of nav or on meaningful padding changes
  useEffect(() => {
    if (!map.current || !showRoute || mboxRouteCoordsRef.current.length < 2) {
      lastMboxNavRef.current = navigationFollowMode;
      return;
    }
    const switchedToOverview = !navigationFollowMode && lastMboxNavRef.current;
    lastMboxNavRef.current = navigationFollowMode;
    if (switchedToOverview) {
      lastMboxFitKeyRef.current = '';
    }
    fitMapboxRouteBounds(map.current, mboxRouteCoordsRef.current, routeEndStr);
  }, [routeEndStr, showRoute, bottomPadding, topPadding, isSearchingForDrivers, navigationFollowMode, isMapAutoFollowing]);

  const userLocationStr = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';

  const userMarkerMboxRef = useRef<any>(null);

  useEffect(() => {
    if (!map.current) return;
    if (showUserOverlay && userLocation) {
        if (userMarkerMboxRef.current) {
            userMarkerMboxRef.current.setLngLat([userLocation.lng, userLocation.lat]);
        } else {
            const el = document.createElement('div');
            el.innerHTML = USER_ICON;
            userMarkerMboxRef.current = new mapboxgl.Marker(el).setLngLat([userLocation.lng, userLocation.lat]).addTo(map.current);
        }
    } else if (userMarkerMboxRef.current) {
        userMarkerMboxRef.current.remove();
        userMarkerMboxRef.current = null;
    }
  }, [showUserOverlay, userLocationStr]);

  const pickupStr = pickup ? `${pickup.lat},${pickup.lng}` : '';
  const dropoffStr = dropoff ? `${dropoff.lat},${dropoff.lng}` : '';
  const markerSigRef = useRef<Record<string, string>>({});
  const lastStaticBoundsKeyRef = useRef<string>('');

  // Handle Markers via in-place diffing (never destroy & recreate markers on every location tick)
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    const desiredKeys = new Set<string>();
    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;
    const isDirectionSelected = !!dropoff || !!showRoute;

    const upsertMarker = (
      key: string,
      sig: string,
      lngLat: [number, number],
      create: () => mapboxgl.Marker,
      rotation?: number
    ) => {
      desiredKeys.add(key);
      const existing = markersRef.current[key];
      if (existing && markerSigRef.current[key] === sig) {
        existing.setLngLat(lngLat);
        if (typeof rotation === 'number' && !isNaN(rotation)) {
          existing.setRotation(rotation);
        }
        return;
      }
      if (existing) {
        existing.remove();
      }
      const created = create();
      markersRef.current[key] = created;
      markerSigRef.current[key] = sig;
    };

    if (pickup && typeof pickup.lat === 'number' && !isNaN(pickup.lat) && isDirectionSelected) {
      upsertMarker(
        'pickup',
        `${pickupAddress || ''}|passenger`,
        [pickup.lng, pickup.lat],
        () => {
          const el = createMarkerElement(PICKUP_ICON, pickupAddress, '#2563EB', 'passenger');
          return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([pickup.lng, pickup.lat]).addTo(m);
        }
      );
      bounds.extend([pickup.lng, pickup.lat]);
      hasPoints = true;
    }

    if (dropoff && typeof dropoff.lat === 'number' && !isNaN(dropoff.lat)) {
      upsertMarker(
        'dropoff',
        `${dropoffAddress || ''}|dropoff`,
        [dropoff.lng, dropoff.lat],
        () => {
          const el = createMarkerElement(DROPOFF_ICON, dropoffAddress, '#1D4ED8', 'none');
          return new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([dropoff.lng, dropoff.lat]).addTo(m);
        }
      );
      bounds.extend([dropoff.lng, dropoff.lat]);
      hasPoints = true;
    }

    drivers.forEach((d) => {
      if (
        typeof d.lat !== 'number' ||
        typeof d.lng !== 'number' ||
        isNaN(d.lat) ||
        isNaN(d.lng) ||
        (d.lat === 0 && d.lng === 0)
      ) {
        return;
      }
      const heading = typeof d.heading === 'number' && !isNaN(d.heading) ? d.heading : 0;
      const radarType = d.isNearby ? 'nearby' : 'driver';
      upsertMarker(
        `driver-${d.id}`,
        radarType,
        [d.lng, d.lat],
        () => {
          const el = createMarkerElement(CAR_ICON, undefined, '#FFC90E', radarType);
          return new mapboxgl.Marker(el, { rotation: heading }).setLngLat([d.lng, d.lat]).addTo(m);
        },
        heading
      );
    });

    Object.keys(markersRef.current).forEach((key) => {
      if (!desiredKeys.has(key)) {
        markersRef.current[key].remove();
        delete markersRef.current[key];
        delete markerSigRef.current[key];
      }
    });

    if (!showRoute && hasPoints && !centerOn && isMapAutoFollowing && !isSearchingForDrivers) {
      const staticKey = `${pickupStr}|${dropoffStr}|${Math.round(topPadding / 24)}|${Math.round(bottomPadding / 24)}`;
      if (lastStaticBoundsKeyRef.current !== staticKey) {
        lastStaticBoundsKeyRef.current = staticKey;
        m.fitBounds(bounds, {
          padding: { top: topPadding || 80, bottom: bottomPadding ? bottomPadding + 100 : 100, left: 40, right: 40 },
          maxZoom: 16.5
        });
      }
    } else {
      lastStaticBoundsKeyRef.current = '';
    }
  }, [pickupStr, dropoffStr, pickupAddress, dropoffAddress, drivers, showRoute, topPadding, bottomPadding, centerOnStr, isMapAutoFollowing, isSearchingForDrivers]);

  return <div ref={mapContainer} className="w-full h-full" />;
};

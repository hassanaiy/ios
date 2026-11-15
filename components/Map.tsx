import React, { useEffect, useRef, useState } from 'react';
import { Coordinates } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
    googleMapsErrorCallback?: (errorType: string) => void;
  }
}

interface MapProps {
  pickup: Coordinates | null;
  dropoff: Coordinates | null;
  pickupAddress?: string;
  dropoffAddress?: string;
  drivers?: { id: string; lat: number; lng: number; heading?: number; isNearby?: boolean; isSelected?: boolean }[];
  onMapClick?: (coords: Coordinates, address?: string) => void;
  onMapDrag?: () => void;
  onMapMove?: () => void;
  onMapMoveEnd?: (center: Coordinates) => void;
  showRoute?: boolean;
  routeStart?: Coordinates | null;
  routeEnd?: Coordinates | null;
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

const DEFAULT_CENTER = { lat: 26.1551, lng: 32.7160 };

const MODERN_BLUE_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#f3f5f8" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#0f172a" }] },
  { featureType: "administrative.locality", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 4 }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#fef3c7" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#fcd34d" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bae6fd" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#0284c7" }] },
];

const CAR_MARKER_HTML = (isOnline: boolean, isSelected: boolean = false) => `
<div style="position: absolute; transform: translate(-50%, -50%); display:flex; align-items:center; justify-content:center; pointer-events: none; width: 54px; height: 54px; z-index: 60;">
  <div class="driver-marker-aura ${isSelected || isOnline ? 'driver-marker-aura--active' : ''}"></div>
  <div class="driver-marker-inner" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; will-change: transform;">
    <svg width="${isSelected ? '44' : '40'}" height="${isSelected ? '44' : '40'}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow: visible;">
      <!-- Forward LED Headlight Glow Cones -->
      <polygon points="17.5,10.5 13.5,2 21.5,2 20.2,10.5" fill="rgba(59, 130, 246, ${isSelected ? '0.32' : '0.20'})" />
      <polygon points="30.5,10.5 26.5,2 34.5,2 32.8,10.5" fill="rgba(59, 130, 246, ${isSelected ? '0.32' : '0.20'})" />
      <!-- Realistic Ground Shadow -->
      <rect x="16.5" y="10.5" width="17.5" height="31.5" rx="8.5" fill="rgba(15, 23, 42, 0.30)" />
      <!-- Wheels -->
      <rect x="14" y="13.5" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
      <rect x="31.4" y="13.5" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
      <rect x="14" y="29" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
      <rect x="31.4" y="29" width="2.6" height="5.5" rx="1.2" fill="#0F172A" />
      <!-- Side Mirrors -->
      <path d="M15.4 18.2L13.1 19.1C12.7 19.3 12.7 19.9 13.1 20.1L15.4 20.5V18.2Z" fill="#1E293B" />
      <path d="M32.6 18.2L34.9 19.1C35.3 19.3 35.3 19.9 34.9 20.1L32.6 20.5V18.2Z" fill="#1E293B" />
      <!-- Main Sculpted Chassis -->
      <rect x="15.2" y="8.5" width="17.6" height="31.5" rx="7.8" fill="#FFFFFF" stroke="${isSelected ? '#1D4ED8' : '#1E293B'}" stroke-width="1.35" />
      <!-- Hood & Body Creases -->
      <path d="M18.2 11.2C20.5 10.2 27.5 10.2 29.8 11.2L28.6 16.2H19.4L18.2 11.2Z" fill="#F1F5F9" />
      <line x1="24" y1="9.8" x2="24" y2="15.4" stroke="#E2E8F0" stroke-width="0.9" stroke-linecap="round" />
      <!-- Panoramic Tinted Cabin Glass -->
      <path d="M17.5 16.4C17.8 14.9 20.2 14.3 24 14.3C27.8 14.3 30.2 14.9 30.5 16.4L31 21.8V29.8L30.2 34.6C29.7 36.1 27.4 36.7 24 36.7C20.6 36.7 18.3 36.1 17.8 34.6L17 29.8V21.8L17.5 16.4Z" fill="#0F172A" />
      <!-- Windshield Specular Reflection -->
      <path d="M19.2 16.3C21.2 15.6 24.4 15.5 27.4 16L25.2 19.5H18.8L19.2 16.3Z" fill="rgba(56, 189, 248, 0.24)" />
      <!-- Sleek Roof Cap with Mowasla Cobalt Trim -->
      <rect x="18.6" y="20.4" width="10.8" height="10.2" rx="3.4" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="0.6" />
      <rect x="22.8" y="21.8" width="2.4" height="7.4" rx="1.2" fill="#2563EB" />
      <!-- Crisp LED Headlights -->
      <path d="M16.8 10.3C17.4 9.5 18.9 9.2 20.1 9.5L19.5 10.9L16.8 10.8V10.3Z" fill="#E0F2FE" stroke="#2563EB" stroke-width="0.5" />
      <path d="M31.2 10.3C30.6 9.5 29.1 9.2 27.9 9.5L28.5 10.9L31.2 10.8V10.3Z" fill="#E0F2FE" stroke="#2563EB" stroke-width="0.5" />
      <!-- Ruby LED Taillights -->
      <rect x="16.9" y="38.1" width="3.8" height="1.4" rx="0.7" fill="#EF4444" />
      <rect x="27.3" y="38.1" width="3.8" height="1.4" rx="0.7" fill="#EF4444" />
    </svg>
  </div>
</div>
`;

const approxMeters = (a: Coordinates, b: Coordinates): number => {
  const cosLat = Math.cos(((a.lat + b.lat) * 0.5 * Math.PI) / 180);
  return Math.hypot((b.lat - a.lat) * 111320, (b.lng - a.lng) * 111320 * cosLat);
};

const projectPointToRoute = (
  point: Coordinates,
  path: Coordinates[],
): { distMeters: number; segmentIndex: number } => {
  if (!path || path.length < 2) {
    return { distMeters: Infinity, segmentIndex: 0 };
  }
  const cosLat = Math.cos((point.lat * Math.PI) / 180);
  const px = point.lng * 111320 * cosLat;
  const py = point.lat * 111320;
  let bestDist = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const ax = a.lng * 111320 * cosLat;
    const ay = a.lat * 111320;
    const bx = b.lng * 111320 * cosLat;
    const by = b.lat * 111320;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0.0001) {
      t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    }
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return { distMeters: bestDist, segmentIndex: bestIdx };
};

const CURRENT_USER_HTML = `
<div style="position: absolute; transform: translate(-50%, -50%); display:flex; align-items:center; justify-content:center;">
    <div style="position: absolute; width: 60px; height: 60px; background: rgba(59, 130, 246, 0.2); border-radius: 50%;" class="animate-ping"></div>
    <div style="width: 16px; height: 16px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(59,130,246,0.6); z-index: 2;"></div>
</div>
`;

const PICKUP_MARKER_HTML = (label?: string) => `
<div class="modern-pickup-pin" style="position: absolute; left: 0; top: 0; transform: translate3d(-50%, -100%, 0); display:flex; flex-direction:column; align-items:center; pointer-events: none; z-index: 100; direction: ltr; animation: modernMarkerEntrance 0.24s cubic-bezier(0.22, 1, 0.36, 1); backface-visibility: hidden;">
    ${label ? `
    <div style="
        margin-bottom: 5px;
        background: #FFFFFF;
        color: #1E293B;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        font-weight: 700;
        padding: 5px 11px;
        border-radius: 9999px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(37, 99, 235, 0.18);
        white-space: nowrap;
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
        gap: 6px;
    ">
        <span style="width: 6px; height: 6px; background: #2563EB; border-radius: 50%; display: inline-block;"></span>
        ${label}
    </div>
    ` : ''}
    <div style="position: relative; display: flex; align-items: center; justify-content: center; line-height: 0;">
        <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
            <defs>
                <linearGradient id="pickupPinGrad" x1="19" y1="2" x2="19" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#3B82F6"/>
                    <stop offset="100%" stop-color="#1D4ED8"/>
                </linearGradient>
            </defs>
            <path d="M19 48 C18 46 4 29.5 4 17 C4 8.7 10.7 2 19 2 C27.3 2 34 8.7 34 17 C34 29.5 20 46 19 48 Z" fill="url(#pickupPinGrad)"/>
            <circle cx="19" cy="17" r="11" fill="#FFFFFF"/>
            <circle cx="19" cy="17" r="5.5" fill="#2563EB"/>
            <circle cx="19" cy="17" r="2" fill="#FFFFFF"/>
        </svg>
    </div>
    <div style="position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 50%); width: 20px; height: 6px; pointer-events: none; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 18px; height: 5px; background: rgba(37, 99, 235, 0.25); border-radius: 50%;"></div>
        <div style="width: 4px; height: 2px; background: #1D4ED8; border-radius: 50%;"></div>
    </div>
</div>
`;

const DROPOFF_MARKER_HTML = (label?: string) => `
<div class="modern-dropoff-pin" style="position: absolute; left: 0; top: 0; transform: translate3d(-50%, -100%, 0); display:flex; flex-direction:column; align-items:center; pointer-events: none; z-index: 100; direction: ltr; animation: modernMarkerEntrance 0.24s cubic-bezier(0.22, 1, 0.36, 1); backface-visibility: hidden;">
    ${label ? `
    <div style="
        margin-bottom: 5px;
        background: #FFFFFF;
        color: #1E293B;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        font-weight: 700;
        padding: 5px 11px;
        border-radius: 9999px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(37, 99, 235, 0.18);
        white-space: nowrap;
        letter-spacing: -0.01em;
        display: flex;
        align-items: center;
        gap: 6px;
    ">
        <span style="width: 6px; height: 6px; background: #1E40AF; border-radius: 50%; display: inline-block;"></span>
        ${label}
    </div>
    ` : ''}
    <div style="position: relative; display: flex; align-items: center; justify-content: center; line-height: 0;">
        <svg width="38" height="48" viewBox="0 0 38 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
            <defs>
                <linearGradient id="dropoffPinGrad" x1="19" y1="2" x2="19" y2="48" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#2563EB"/>
                    <stop offset="100%" stop-color="#1E40AF"/>
                </linearGradient>
            </defs>
            <path d="M19 48 C18 46 4 29.5 4 17 C4 8.7 10.7 2 19 2 C27.3 2 34 8.7 34 17 C34 29.5 20 46 19 48 Z" fill="url(#dropoffPinGrad)"/>
            <circle cx="19" cy="17" r="11" fill="#FFFFFF"/>
            <path d="M15 11v11M15 12h7l-1.5 2.5 1.5 2.5h-7" stroke="#1E40AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#2563EB"/>
        </svg>
    </div>
    <div style="position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 50%); width: 20px; height: 6px; pointer-events: none; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 18px; height: 5px; background: rgba(37, 99, 235, 0.25); border-radius: 50%;"></div>
        <div style="width: 4px; height: 2px; background: #1E40AF; border-radius: 50%;"></div>
    </div>
</div>
`;

const waitForGoogleMaps = async (timeoutMs = 9000): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.google?.maps?.OverlayView && window.google?.maps?.Map) {
      return true;
    }
    if (typeof window.google?.maps?.importLibrary === 'function') {
      try {
        await Promise.all([
          window.google.maps.importLibrary("maps"),
          window.google.maps.importLibrary("marker"),
          window.google.maps.importLibrary("geometry")
        ]);
        if (window.google?.maps?.OverlayView && window.google?.maps?.Map) {
          return true;
        }
      } catch (e) {
        // Continue waiting if still loading
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return !!(window.google?.maps?.OverlayView && window.google?.maps?.Map);
};

export const Map: React.FC<MapProps> = ({
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
  showLocationPopup,
  currentAddress,
  showUserOverlay,
  userLocation,
  heatPoints,
  isMapAutoFollowing = true,
  isSearchingForDrivers = false,
  navigationFollowMode = false,
  driverHeading = 0
}) => {
  const { language } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const CustomOverlayRef = useRef<any>(null);
  const userOverlayRef = useRef<any>(null);
  const pointOverlaysRef = useRef<{pickup?: any, dropoff?: any}>({});
  const polylineCasingRef = useRef<any>(null);
  const polylineCoreRef = useRef<any>(null);
  const routePathRef = useRef<Coordinates[]>([]);
  const directionsRendererRef = useRef<any>(null);

  // Animation & Interpolation State
  const driverStateRef = useRef<{ 
      [id: string]: { 
          targetLat: number; targetLng: number; 
          currentLat: number; currentLng: number; 
          targetHeading: number; currentHeading: number;
          overlay: any;
          isCluster?: boolean;
      } 
  }>({});
  const animationFrameRef = useRef<number | null>(null);
  const searchAnimFrameRef = useRef<any>(null);
  const searchTimersRef = useRef<number[]>([]);

  const clearSearchTimers = () => {
    if (searchTimersRef.current.length > 0) {
      searchTimersRef.current.forEach((id) => window.clearTimeout(id));
      searchTimersRef.current = [];
    }
    if (searchAnimFrameRef.current !== null) {
      cancelAnimationFrame(searchAnimFrameRef.current);
      clearInterval(searchAnimFrameRef.current);
      searchAnimFrameRef.current = null;
    }
  };

  const onMapClickRef = useRef(onMapClick);
  const onMapDragRef = useRef(onMapDrag);
  const onMapMoveEndRef = useRef(onMapMoveEnd);
  const driversRef = useRef(drivers);
  const hasZoomedOutSearchRef = useRef(false);
  const isSearchingForDriversRef = useRef(isSearchingForDrivers);
  const navigationFollowModeRef = useRef(navigationFollowMode);
  const isMapAutoFollowingRef = useRef(isMapAutoFollowing);
  const topPaddingRef = useRef(topPadding);
  const bottomPaddingRef = useRef(bottomPadding);
  const isFallbackRouteRef = useRef(false);
  const lastFitPaddingRef = useRef('');

  isSearchingForDriversRef.current = isSearchingForDrivers;
  navigationFollowModeRef.current = navigationFollowMode;
  isMapAutoFollowingRef.current = isMapAutoFollowing;
  topPaddingRef.current = topPadding;
  bottomPaddingRef.current = bottomPadding;

  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  useEffect(() => {
    isSearchingForDriversRef.current = isSearchingForDrivers;
  }, [isSearchingForDrivers]);

  useEffect(() => {
    navigationFollowModeRef.current = navigationFollowMode;
  }, [navigationFollowMode]);

  useEffect(() => {
    isMapAutoFollowingRef.current = isMapAutoFollowing;
  }, [isMapAutoFollowing]);

  useEffect(() => {
    topPaddingRef.current = topPadding;
    bottomPaddingRef.current = bottomPadding;
  }, [topPadding, bottomPadding]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onMapDragRef.current = onMapDrag;
    onMapMoveEndRef.current = onMapMoveEnd;
  }, [onMapClick, onMapDrag, onMapMoveEnd]);

  useEffect(() => {
    let isMounted = true;
    window.googleMapsErrorCallback = (err) => {
      if (isMounted) {
        console.warn('[Map Component] Google Maps callback error:', err);
        setMapError(err);
      }
    };

    waitForGoogleMaps().then((loaded) => {
      if (!isMounted || !mapRef.current || mapInstanceRef.current) return;
      if (!loaded || !window.google?.maps?.OverlayView || !window.google?.maps?.Map) {
        setMapError('ScriptLoadError');
        return;
      }
      
      // Define Custom Overlay
      class CustomOverlay extends window.google.maps.OverlayView {
        position: any;
        contentDiv: HTMLDivElement;
        container: HTMLDivElement | null = null;
        zIndex: number;
        contentKey: string = '';
        lastLat: number;
        lastLng: number;
        lastX: number | null = null;
        lastY: number | null = null;
        lastAngle: number | null = null;

        constructor(position: any, contentHtml: string, zIndex: number = 10, contentKey: string = '') {
          super();
          const latVal = typeof position.lat === 'function' ? position.lat() : position.lat;
          const lngVal = typeof position.lng === 'function' ? position.lng() : position.lng;
          this.lastLat = latVal;
          this.lastLng = lngVal;
          this.position = typeof position.lat === 'function' ? position : new window.google.maps.LatLng(latVal, lngVal);
          this.contentDiv = document.createElement('div');
          this.contentDiv.style.position = 'absolute';
          this.contentDiv.style.left = '0px';
          this.contentDiv.style.top = '0px';
          this.contentDiv.style.width = '0px';
          this.contentDiv.style.height = '0px';
          this.contentDiv.style.margin = '0px';
          this.contentDiv.style.padding = '0px';
          this.contentDiv.innerHTML = contentHtml;
          this.contentKey = contentKey;
          this.zIndex = zIndex;
        }

        onAdd() {
          this.container = document.createElement('div');
          this.container.style.position = 'absolute';
          this.container.style.left = '0px';
          this.container.style.top = '0px';
          this.container.style.width = '0px';
          this.container.style.height = '0px';
          this.container.style.margin = '0px';
          this.container.style.padding = '0px';
          this.container.style.zIndex = this.zIndex.toString();
          this.container.style.pointerEvents = 'none';
          this.container.style.willChange = 'transform';
          this.container.style.backfaceVisibility = 'hidden';
          this.container.appendChild(this.contentDiv);
          const panes = this.getPanes();
          const targetPane = panes ? (panes.markerLayer || panes.overlayMouseTarget || panes.floatPane || panes.overlayLayer) : null;
          if (targetPane && this.container) {
            targetPane.appendChild(this.container);
          }
        }

        draw() {
          const projection = this.getProjection();
          if (!projection || !this.container) return;
          const point = projection.fromLatLngToDivPixel(this.position);
          if (point) {
            const x = Math.round(point.x);
            const y = Math.round(point.y);
            if (this.lastX !== x || this.lastY !== y) {
              this.lastX = x;
              this.lastY = y;
              this.container.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
          }
        }

        onRemove() {
          if (this.container?.parentNode) this.container.parentNode.removeChild(this.container);
          this.container = null;
          this.lastX = null;
          this.lastY = null;
        }

        setPosition(lat: number, lng: number) {
          if (Math.abs(lat - this.lastLat) < 1e-5 && Math.abs(lng - this.lastLng) < 1e-5) {
            return;
          }
          this.lastLat = lat;
          this.lastLng = lng;
          this.position = new window.google.maps.LatLng(lat, lng);
          this.draw();
        }

        updateContent(contentHtml: string, contentKey?: string) {
            if (!this.contentDiv) return;
            if (contentKey !== undefined) {
                if (this.contentKey === contentKey) return;
                this.contentKey = contentKey;
                this.contentDiv.innerHTML = contentHtml;
                if (this.lastAngle !== null) {
                    const angle = this.lastAngle;
                    this.lastAngle = null;
                    this.setRotation(angle);
                }
                return;
            }
            if (this.contentDiv.innerHTML !== contentHtml) {
                this.contentDiv.innerHTML = contentHtml;
            }
        }

        setRotation(degrees: number) {
            const rounded = Math.round(degrees * 2) / 2;
            if (this.lastAngle !== null && Math.abs(this.lastAngle - rounded) < 0.5) {
                return;
            }
            this.lastAngle = rounded;
            if (this.container) {
                const body = (this.container.querySelector('.driver-marker-inner') ||
                              this.container.querySelector('.driver-marker-body') ||
                              this.container.firstElementChild) as HTMLElement;
                if (body) {
                    body.style.transform = `rotate(${rounded}deg)`;
                }
            }
        }
      }
      CustomOverlayRef.current = CustomOverlay;

      try {
        const { Map } = window.google.maps;
        const rawInitialCenter =
          (centerOn && typeof centerOn.lat === 'number' && !isNaN(centerOn.lat) ? centerOn : null) ||
          (userLocation && typeof userLocation.lat === 'number' && !isNaN(userLocation.lat) ? userLocation : null) ||
          (pickup && typeof pickup.lat === 'number' && !isNaN(pickup.lat) ? pickup : null) ||
          DEFAULT_CENTER;
        const initSafeBottom = bottomPadding > 0 ? bottomPadding + 24 : 0;
        const initOffsetY = (initSafeBottom - (topPadding || 0)) / 2;
        const initWorldPixels = 256 * Math.pow(2, 16);
        const initLatPerPixel = (360 / initWorldPixels) * Math.cos((rawInitialCenter.lat * Math.PI) / 180);
        const initialCenter = {
          lat: rawInitialCenter.lat - initOffsetY * initLatPerPixel,
          lng: rawInitialCenter.lng,
        };
        mapInstanceRef.current = new Map(mapRef.current, {
          center: initialCenter,
          zoom: 16,
          disableDefaultUI: true,
          gestureHandling: 'greedy',
          styles: MODERN_BLUE_MAP_STYLES,
          internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio']
        });

        let isDragging = false;
        mapInstanceRef.current.addListener('click', (e: any) => {
             if (isSearchingForDriversRef.current) return;
             if (!isDragging && onMapClickRef.current) {
                 onMapClickRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
             }
        });
        
        mapInstanceRef.current.addListener('dragstart', () => {
             isDragging = true;
             clearSearchTimers();
             if (onMapDragRef.current) onMapDragRef.current();
        });
        
        mapInstanceRef.current.addListener('idle', () => {
             const c = mapInstanceRef.current.getCenter();
             if (c && !isSearchingForDriversRef.current && onMapMoveEndRef.current) {
               onMapMoveEndRef.current({ lat: c.lat(), lng: c.lng() });
             }
             setTimeout(() => { isDragging = false; }, 200);
        });

        // Map and CustomOverlay are ready
        setMapReady(true);

      } catch (e) {
          setMapError('InitFailed');
      }
    });

    return () => { isMounted = false; };
  }, []);

  // Update Points (Pickup / Dropoff)
  const initialBoundsSetRef = useRef(false);
  useEffect(() => {
      if (!mapReady || !mapInstanceRef.current || !CustomOverlayRef.current) return;
      const CustomOverlay = CustomOverlayRef.current;
      const bounds = new window.google.maps.LatLngBounds();
      let hasPoints = false;

      const pickupLabel = language === 'ar' ? 'موقع الاستلام' : 'Pickup Location';
      const dropoffLabel = language === 'ar' ? 'الوجهة' : 'Dropoff Location';

      // Only display the pickup marker once the passenger has selected their direction (destination/dropoff set, route active, or trip in progress)
      const isDirectionSelected = !!dropoff || !!showRoute || !!routeStart || !!routeEnd;

      // Pickup
      const isPickupValid = pickup && typeof pickup.lat === 'number' && !isNaN(pickup.lat) && typeof pickup.lng === 'number' && !isNaN(pickup.lng);
      if (isPickupValid && isDirectionSelected) {
          const content = PICKUP_MARKER_HTML(pickupLabel);
          const pickupKey = `pickup_${pickupLabel}`;
          if (!pointOverlaysRef.current.pickup) {
              const marker = new CustomOverlay(pickup, content, 100, pickupKey);
              marker.setMap(mapInstanceRef.current);
              pointOverlaysRef.current.pickup = marker;
          } else {
              pointOverlaysRef.current.pickup.setPosition(pickup.lat, pickup.lng);
              pointOverlaysRef.current.pickup.updateContent(content, pickupKey);
          }
          bounds.extend(new window.google.maps.LatLng(pickup.lat, pickup.lng));
          hasPoints = true;
      } else if (pointOverlaysRef.current.pickup) {
          pointOverlaysRef.current.pickup.setMap(null);
          pointOverlaysRef.current.pickup = null;
      }

      // Dropoff
      const isDropoffValid = dropoff && typeof dropoff.lat === 'number' && !isNaN(dropoff.lat) && typeof dropoff.lng === 'number' && !isNaN(dropoff.lng);
      if (isDropoffValid) {
          const content = DROPOFF_MARKER_HTML(dropoffLabel);
          const dropoffKey = `dropoff_${dropoffLabel}`;
          if (!pointOverlaysRef.current.dropoff) {
              const marker = new CustomOverlay(dropoff, content, 100, dropoffKey);
              marker.setMap(mapInstanceRef.current);
              pointOverlaysRef.current.dropoff = marker;
          } else {
              pointOverlaysRef.current.dropoff.setPosition(dropoff.lat, dropoff.lng);
              pointOverlaysRef.current.dropoff.updateContent(content, dropoffKey);
          }
          bounds.extend(new window.google.maps.LatLng(dropoff.lat, dropoff.lng));
          hasPoints = true;
      } else if (pointOverlaysRef.current.dropoff) {
          pointOverlaysRef.current.dropoff.setMap(null);
          pointOverlaysRef.current.dropoff = null;
      }

      if (!dropoff && !showRoute) {
          initialBoundsSetRef.current = false;
      }

      if (isMapAutoFollowing && hasPoints && !showRoute && !isSearchingForDrivers) {
          // If only tracking 1 point, use padded panTo so the pin sits above the bottom sheet
          if (pickup && !dropoff && (!centerOn || centerOn.lat === pickup.lat)) {
              if (isDirectionSelected) {
                  const z = mapInstanceRef.current.getZoom() || 16;
                  mapInstanceRef.current.panTo(getPaddedCenterLatLng(pickup, z, topPadding, bottomPadding));
                  if (z < 14) mapInstanceRef.current.setZoom(16);
              }
          } else if (pickup && dropoff) {
              if (!initialBoundsSetRef.current) {
                  mapInstanceRef.current.fitBounds(bounds, { bottom: Math.min(bottomPadding + 60, 260), top: Math.min(topPadding + 60, 180), left: 40, right: 40 });
                  initialBoundsSetRef.current = true;
              }
          }
      }

  }, [mapReady, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, bottomPadding, topPadding, isMapAutoFollowing, showRoute, isSearchingForDrivers, language, routeStart?.lat, routeStart?.lng, routeEnd?.lat, routeEnd?.lng]);

  // Helper to convert a target coordinate into a camera center coordinate shifted vertically
  // so that the target marker sits squarely in the center of the visible map area above the bottom sheet.
  const getPaddedCenterLatLng = (
      target: { lat: number; lng: number },
      zoom: number = 16,
      topPad: number = 0,
      bottomPad: number = 0
  ) => {
      const safeBottom = bottomPad > 0 ? bottomPad + 24 : 0;
      const offsetY = (safeBottom - topPad) / 2;
      if (Math.abs(offsetY) < 4) {
          return new window.google.maps.LatLng(target.lat, target.lng);
      }
      const worldPixels = 256 * Math.pow(2, zoom || 16);
      const cosLat = Math.cos((target.lat * Math.PI) / 180);
      const latPerPixel = (360 / worldPixels) * cosLat;
      const paddedLat = target.lat - offsetY * latPerPixel;
      return new window.google.maps.LatLng(paddedLat, target.lng);
  };

  // Compute exact padded camera center & zoom covering a list of coordinates (direction + nearby drivers)
  const computeTargetCameraForBounds = (
      coordsList: { lat: number; lng: number }[],
      topPad: number,
      bottomPad: number,
      sidePad: number = 44,
      minZoom: number = 10.5,
      maxZoom: number = 15.2
  ): { center: Coordinates; zoom: number } | null => {
      if (!coordsList || coordsList.length === 0) return null;

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;

      for (const pt of coordsList) {
          if (typeof pt.lat !== 'number' || typeof pt.lng !== 'number' || isNaN(pt.lat) || isNaN(pt.lng)) continue;
          if (pt.lat < minLat) minLat = pt.lat;
          if (pt.lat > maxLat) maxLat = pt.lat;
          if (pt.lng < minLng) minLng = pt.lng;
          if (pt.lng > maxLng) maxLng = pt.lng;
      }

      if (!isFinite(minLat) || !isFinite(maxLat) || !isFinite(minLng) || !isFinite(maxLng)) return null;

      // Ensure a comfortable minimum span (~0.014 deg ≈ 1.5km) so nearby context is always visible
      const minSpan = 0.014;
      if (maxLat - minLat < minSpan) {
          const pad = (minSpan - (maxLat - minLat)) / 2;
          minLat -= pad;
          maxLat += pad;
      }
      if (maxLng - minLng < minSpan) {
          const pad = (minSpan - (maxLng - minLng)) / 2;
          minLng -= pad;
          maxLng += pad;
      }

      const vh = mapRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
      const vw = mapRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 400);

      const safeBottom = Math.min(Math.max((bottomPad || 0) + 32, Math.round(vh * 0.40)), Math.round(vh * 0.56));
      const safeTop = Math.min(Math.max((topPad || 0) + 20, 88), Math.round(vh * 0.24));
      const usableW = Math.max(120, vw - sidePad * 2);
      const usableH = Math.max(140, vh - safeTop - safeBottom);

      const latRad = (lat: number) => {
          const sin = Math.sin((lat * Math.PI) / 180);
          const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
          return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
      };

      const latFraction = Math.max(1e-6, (latRad(maxLat) - latRad(minLat)) / Math.PI);
      const lngDiff = maxLng - minLng;
      const lngFraction = Math.max(1e-6, (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360);

      const zoomLat = Math.log2(usableH / (256 * latFraction));
      const zoomLng = Math.log2(usableW / (256 * lngFraction));
      const rawZoom = Math.min(zoomLat, zoomLng);
      const targetZoom = Number(Math.max(minZoom, Math.min(maxZoom, rawZoom)).toFixed(2));

      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const offsetY = (safeBottom - safeTop) / 2;
      const worldPixels = 256 * Math.pow(2, targetZoom);
      const latPerPixel = (360 / worldPixels) * Math.cos((midLat * Math.PI) / 180);

      return {
          center: {
              lat: midLat - offsetY * latPerPixel,
              lng: midLng,
          },
          zoom: targetZoom,
      };
  };

  // Helper to fit map bounds smartly to the actual complete route geometry (never overrides active searching camera)
  const lastRouteFitKeyRef = useRef<string>('');
  const lastRouteFitAtRef = useRef<number>(0);
  const fitRouteBounds = (coordsList: { lat: number; lng: number }[], force: boolean = false) => {
      if (!mapInstanceRef.current || !coordsList || coordsList.length === 0) return;
      if (isSearchingForDriversRef.current) return;

      const curTop = topPaddingRef.current || 0;
      const curBottom = bottomPaddingRef.current || 0;
      const startPt = coordsList[0];
      const endPt = coordsList[coordsList.length - 1];
      const fitKey = `${endPt.lat.toFixed(4)}_${endPt.lng.toFixed(4)}_${curTop}_${curBottom}`;
      const now = Date.now();
      if (!force && lastRouteFitKeyRef.current === fitKey && now - lastRouteFitAtRef.current < 1500) {
          return;
      }
      lastRouteFitKeyRef.current = fitKey;
      lastRouteFitAtRef.current = now;

      const bounds = new window.google.maps.LatLngBounds();
      const step = Math.max(1, Math.floor(coordsList.length / 50));
      for (let i = 0; i < coordsList.length; i += step) {
          bounds.extend(new window.google.maps.LatLng(coordsList[i].lat, coordsList[i].lng));
      }
      bounds.extend(new window.google.maps.LatLng(startPt.lat, startPt.lng));
      bounds.extend(new window.google.maps.LatLng(endPt.lat, endPt.lng));

      const vh = mapRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
      const vw = mapRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 400);

      const minUsableHeight = Math.max(170, Math.round(vh * 0.34));
      let safeBottom = Math.min(Math.max(curBottom + 24, Math.round(vh * 0.28)), Math.round(vh * 0.50));
      let safeTop = Math.min(Math.max(curTop + 18, 72), Math.round(vh * 0.24));
      if (safeTop + safeBottom > vh - minUsableHeight) {
          const excess = (safeTop + safeBottom) - (vh - minUsableHeight);
          const bottomShare = safeBottom / (safeTop + safeBottom);
          safeBottom = Math.max(24, Math.round(safeBottom - excess * bottomShare));
          safeTop = Math.max(24, Math.round(safeTop - excess * (1 - bottomShare)));
      }
      const safeSide = Math.max(Math.min(Math.round(vw * 0.12), 64), 40);

      lastFitPaddingRef.current = `${curTop}_${curBottom}`;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      if (Math.abs(ne.lat() - sw.lat()) < 0.002 && Math.abs(ne.lng() - sw.lng()) < 0.002) {
          const centerPt = bounds.getCenter();
          const targetZ = 16;
          mapInstanceRef.current.panTo(getPaddedCenterLatLng({ lat: centerPt.lat(), lng: centerPt.lng() }, targetZ, curTop, curBottom));
          const curZ = mapInstanceRef.current.getZoom() || 0;
          if (Math.abs(curZ - targetZ) >= 0.8) {
              mapInstanceRef.current.setZoom(targetZ);
          }
          return;
      }

      mapInstanceRef.current.fitBounds(bounds, {
          top: safeTop,
          bottom: safeBottom,
          left: safeSide,
          right: safeSide
      });

      window.google.maps.event.addListenerOnce(mapInstanceRef.current, 'idle', () => {
          if (isSearchingForDriversRef.current || !mapInstanceRef.current || navigationFollowModeRef.current) return;
          const z = mapInstanceRef.current.getZoom();
          if (typeof z === 'number' && z > 17) {
              mapInstanceRef.current.setZoom(16);
          }
      });
  };

  // Handle Route (Fetch and render dual blue/dark-casing polyline + smooth on-route trimming + smart focus)
  const routeTimerRef = useRef<any>(null);
  const routeAbortControllerRef = useRef<AbortController | null>(null);
  const routeRequestSeqRef = useRef<number>(0);
  const lastRouteFetchAtRef = useRef<number>(0);
  const lastFetchedRouteRef = useRef<{ startLat: number; startLng: number; endLat: number; endLng: number } | null>(null);

  useEffect(() => {
      const startPoint = routeStart || pickup;
      const endPoint = routeEnd || dropoff;
      if (!mapReady || !mapInstanceRef.current || !startPoint || !endPoint || !showRoute) {
          if (routeAbortControllerRef.current) {
              routeAbortControllerRef.current.abort();
              routeAbortControllerRef.current = null;
          }
          if (polylineCasingRef.current) {
              polylineCasingRef.current.setMap(null);
              polylineCasingRef.current = null;
          }
          if (polylineCoreRef.current) {
              polylineCoreRef.current.setMap(null);
              polylineCoreRef.current = null;
          }
          routePathRef.current = [];
          isFallbackRouteRef.current = false;
          lastFetchedRouteRef.current = null;
          return;
      }

      const applyRoutePolylines = (path: Coordinates[], isFallback: boolean, allowCameraFit: boolean) => {
          routePathRef.current = path;
          isFallbackRouteRef.current = isFallback;

          if (!polylineCasingRef.current) {
              polylineCasingRef.current = new window.google.maps.Polyline({
                  path,
                  geodesic: true,
                  strokeColor: '#0F172A',
                  strokeOpacity: 0.95,
                  strokeWeight: 8,
                  zIndex: 20,
                  map: mapInstanceRef.current
              });
          } else {
              polylineCasingRef.current.setPath(path);
              if (!polylineCasingRef.current.getMap()) {
                  polylineCasingRef.current.setMap(mapInstanceRef.current);
              }
          }

          if (!polylineCoreRef.current) {
              polylineCoreRef.current = new window.google.maps.Polyline({
                  path,
                  geodesic: true,
                  strokeColor: '#2563EB',
                  strokeOpacity: 1.0,
                  strokeWeight: 5,
                  zIndex: 21,
                  map: mapInstanceRef.current
              });
          } else {
              polylineCoreRef.current.setPath(path);
              if (!polylineCoreRef.current.getMap()) {
                  polylineCoreRef.current.setMap(mapInstanceRef.current);
              }
          }

          if (allowCameraFit && isMapAutoFollowingRef.current && !isSearchingForDriversRef.current && !navigationFollowModeRef.current) {
              fitRouteBounds(path);
          }
      };

      const prevFetch = lastFetchedRouteRef.current;
      const isEndChanged = !prevFetch ||
        Math.abs(prevFetch.endLat - endPoint.lat) > 0.00015 ||
        Math.abs(prevFetch.endLng - endPoint.lng) > 0.00015;
      const hadNoRealRouteBefore = routePathRef.current.length <= 1 || isFallbackRouteRef.current;

      // If we already have a real road route to this exact destination, check if startPoint is still on-route.
      // When on-route (<= 65m), trim passed vertices smoothly without hitting OSRM or flickering the route!
      if (!isEndChanged && !hadNoRealRouteBefore && routePathRef.current.length >= 2) {
          const proj = projectPointToRoute(startPoint, routePathRef.current);
          if (proj.distMeters <= 65) {
              const remaining = [startPoint, ...routePathRef.current.slice(proj.segmentIndex + 1)];
              if (remaining.length < 2) remaining.push(endPoint);
              lastFetchedRouteRef.current = {
                  startLat: startPoint.lat,
                  startLng: startPoint.lng,
                  endLat: endPoint.lat,
                  endLng: endPoint.lng,
              };
              applyRoutePolylines(remaining, false, false);
              return;
          }
          // Driver deviated off-route: rate-limit OSRM re-fetch to every 8 seconds
          if (Date.now() - lastRouteFetchAtRef.current < 8000) {
              return;
          }
      }

      const fetchRoute = async () => {
          if (routeAbortControllerRef.current) {
              routeAbortControllerRef.current.abort();
          }
          const controller = new AbortController();
          routeAbortControllerRef.current = controller;
          const seq = ++routeRequestSeqRef.current;
          lastRouteFetchAtRef.current = Date.now();
          lastFetchedRouteRef.current = {
              startLat: startPoint.lat,
              startLng: startPoint.lng,
              endLat: endPoint.lat,
              endLng: endPoint.lng,
          };

          try {
              const res = await fetch(
                  `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson`,
                  { signal: controller.signal }
              );
              if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
              const data = await res.json();
              if (controller.signal.aborted || seq !== routeRequestSeqRef.current) return;
              if (data?.routes?.length > 0 && data.routes[0]?.geometry?.coordinates?.length > 1) {
                  const path: Coordinates[] = data.routes[0].geometry.coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
                  applyRoutePolylines(path, false, isEndChanged || hadNoRealRouteBefore);
                  return;
              }
          } catch (e: any) {
              if (e?.name === 'AbortError' || controller.signal.aborted || seq !== routeRequestSeqRef.current) {
                  return;
              }
          }

          // Only use straight-line fallback when we don't already have a valid road route for this destination
          if (isEndChanged || hadNoRealRouteBefore || routePathRef.current.length <= 1) {
              applyRoutePolylines([startPoint, endPoint], true, true);
          }
      };

      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      routeTimerRef.current = setTimeout(() => {
          fetchRoute();
      }, isEndChanged || hadNoRealRouteBefore ? 50 : 250);

      return () => {
          if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      };
  }, [mapReady, routeStart?.lat, routeStart?.lng, pickup?.lat, pickup?.lng, routeEnd?.lat, routeEnd?.lng, dropoff?.lat, dropoff?.lng, showRoute]);

  // When auto-follow is re-enabled, driver toggles Overview mode, or bottom sheet finishes settling after route selection
  const lastAutoFollowForRouteRef = useRef(isMapAutoFollowing);
  const lastNavFollowForRouteRef = useRef(navigationFollowMode);
  const paddingRefitTimerRef = useRef<any>(null);
  useEffect(() => {
      const turnedAutoFollowOn = isMapAutoFollowing && !lastAutoFollowForRouteRef.current;
      const switchedToOverview = !navigationFollowMode && lastNavFollowForRouteRef.current;
      lastAutoFollowForRouteRef.current = isMapAutoFollowing;
      lastNavFollowForRouteRef.current = navigationFollowMode;

      if (!mapReady || !showRoute || !isMapAutoFollowing || navigationFollowMode || isSearchingForDrivers) {
          return;
      }

      if (turnedAutoFollowOn || switchedToOverview) {
          if (routePathRef.current.length > 0) {
              fitRouteBounds(routePathRef.current, true);
          }
          return;
      }

      const [prevTopStr, prevBotStr] = (lastFitPaddingRef.current || '').split('_');
      const prevTop = Number(prevTopStr);
      const prevBot = Number(prevBotStr);
      const paddingDiff =
          !lastFitPaddingRef.current ||
          Math.abs((topPadding || 0) - prevTop) > 24 ||
          Math.abs((bottomPadding || 0) - prevBot) > 24;

      if (paddingDiff && routePathRef.current.length > 0) {
          if (paddingRefitTimerRef.current) clearTimeout(paddingRefitTimerRef.current);
          paddingRefitTimerRef.current = setTimeout(() => {
              if (mapInstanceRef.current && isMapAutoFollowingRef.current && !navigationFollowModeRef.current && !isSearchingForDriversRef.current && routePathRef.current.length > 0) {
                  fitRouteBounds(routePathRef.current);
              }
          }, 160);
          return () => {
              if (paddingRefitTimerRef.current) clearTimeout(paddingRefitTimerRef.current);
          };
      }
  }, [mapReady, isMapAutoFollowing, navigationFollowMode, showRoute, bottomPadding, topPadding, isSearchingForDrivers]);

  // Handle User Overlay
  const userStateRef = useRef<{currentLat: number, currentLng: number} | null>(null);
  const targetUserLocationRef = useRef<Coordinates | null>(null);
  const startAnimationLoopRef = useRef<() => void>(() => {});

  useEffect(() => {
      targetUserLocationRef.current = userLocation || null;
      if (!mapInstanceRef.current || !CustomOverlayRef.current) return;
      if (showUserOverlay && userLocation) {
          if (!userOverlayRef.current) {
              const CustomOverlay = CustomOverlayRef.current;
              userOverlayRef.current = new CustomOverlay(userLocation, CURRENT_USER_HTML, 50, 'current_user');
              userOverlayRef.current.setMap(mapInstanceRef.current);
              userStateRef.current = { currentLat: userLocation.lat, currentLng: userLocation.lng };
          } else {
              startAnimationLoopRef.current();
          }
      } else if (userOverlayRef.current) {
          userOverlayRef.current.setMap(null);
          userOverlayRef.current = null;
          userStateRef.current = null;
      }
  }, [mapReady, showUserOverlay, userLocation?.lat, userLocation?.lng]);

  // Smart Follow Center On (with bottom sheet & top header padding offset, plus live navigation route follow)
  const lastAutoFollowRef = useRef(isMapAutoFollowing);
  const lastNavFollowRef = useRef(navigationFollowMode);
  const lastPaddingNumsRef = useRef<{ top: number; bottom: number }>({ top: topPadding, bottom: bottomPadding });
  const lastCenteredCoordRef = useRef<Coordinates | null>(null);
  useEffect(() => {
      if (!mapReady || !mapInstanceRef.current || !centerOn) {
          lastAutoFollowRef.current = isMapAutoFollowing;
          lastNavFollowRef.current = navigationFollowMode;
          return;
      }

      const map = mapInstanceRef.current;
      const desiredZoom = navigationFollowMode ? 17 : 16;
      const currentZoom = map.getZoom() || desiredZoom;
      const effectiveZoom = navigationFollowMode ? Math.max(currentZoom, 16.5) : currentZoom;
      const paddedTargetLatLng = getPaddedCenterLatLng(centerOn, effectiveZoom, topPadding, bottomPadding);

      const moveMeters = lastCenteredCoordRef.current ? approxMeters(lastCenteredCoordRef.current, centerOn) : Infinity;
      const paddingChanged =
          Math.abs(topPadding - lastPaddingNumsRef.current.top) > 20 ||
          Math.abs(bottomPadding - lastPaddingNumsRef.current.bottom) > 20;
      const moveThreshold = navigationFollowMode ? 8 : 14;
      const enteredNavMode = navigationFollowMode && !lastNavFollowRef.current;
      const turnedFollowOn = isMapAutoFollowing && !lastAutoFollowRef.current;

      if (isMapAutoFollowing && !isSearchingForDrivers && (!showRoute || navigationFollowMode)) {
          if (turnedFollowOn || enteredNavMode) {
              if (currentZoom < (navigationFollowMode ? 16 : 14.5)) {
                  map.setZoom(desiredZoom);
              }
              map.panTo(getPaddedCenterLatLng(centerOn, Math.max(currentZoom, desiredZoom), topPadding, bottomPadding));
              initialBoundsSetRef.current = false;
              lastCenteredCoordRef.current = centerOn;
              lastPaddingNumsRef.current = { top: topPadding, bottom: bottomPadding };
          } else if (paddingChanged || moveMeters >= moveThreshold) {
              if (currentZoom < (navigationFollowMode ? 15.5 : 14)) {
                  map.setZoom(desiredZoom);
              }
              map.panTo(paddedTargetLatLng);
              lastCenteredCoordRef.current = centerOn;
              lastPaddingNumsRef.current = { top: topPadding, bottom: bottomPadding };
          } else {
              const currentCenter = map.getCenter();
              if (currentCenter && window.google.maps.geometry?.spherical) {
                  const dist = window.google.maps.geometry.spherical.computeDistanceBetween(currentCenter, paddedTargetLatLng);
                  if (dist > 5000) {
                      map.panTo(paddedTargetLatLng);
                      if (currentZoom < desiredZoom) map.setZoom(desiredZoom);
                      lastCenteredCoordRef.current = centerOn;
                  }
              }
          }
      }

      lastAutoFollowRef.current = isMapAutoFollowing;
      lastNavFollowRef.current = navigationFollowMode;
  }, [mapReady, centerOn?.lat, centerOn?.lng, bottomPadding, topPadding, isMapAutoFollowing, showRoute, isSearchingForDrivers, navigationFollowMode]);

  // Stable camera view on Searching for Driver:
  // 1) Anchors cleanly on the passenger's current/pickup marker at close-up zoom (16)
  // 2) Performs a single monotonic slow-motion zoom-out until covering full direction + all nearby drivers
  // 3) Locks steady with zero further zoom bouncing
  useEffect(() => {
    if (!isSearchingForDrivers) {
      hasZoomedOutSearchRef.current = false;
      clearSearchTimers();
      return;
    }

    if (!mapReady || !mapInstanceRef.current || hasZoomedOutSearchRef.current) {
      return;
    }

    hasZoomedOutSearchRef.current = true;
    clearSearchTimers();
    const map = mapInstanceRef.current;

    const isValidCoord = (c?: Coordinates | null): c is Coordinates =>
      !!c && typeof c.lat === 'number' && !isNaN(c.lat) && typeof c.lng === 'number' && !isNaN(c.lng) && (c.lat !== 0 || c.lng !== 0);

    const passengerAnchor: Coordinates = isValidCoord(pickup)
      ? pickup
      : isValidCoord(userLocation)
        ? userLocation
        : isValidCoord(centerOn)
          ? centerOn
          : DEFAULT_CENTER;

    const startZoom = 16;
    const startPadded = getPaddedCenterLatLng(passengerAnchor, startZoom, topPadding, bottomPadding);
    const startLat = startPadded.lat();
    const startLng = startPadded.lng();

    // Immediately anchor on passenger marker (cancels any in-flight fitBounds/panTo)
    if (typeof map.moveCamera === 'function') {
      map.moveCamera({
        center: { lat: startLat, lng: startLng },
        zoom: startZoom,
      });
    } else {
      map.setCenter(startPadded);
      map.setZoom(startZoom);
    }

    // Pause briefly on the passenger marker so user sees zoom-out start from their location
    // and any in-flight route geometry / driver markers settle before single smooth zoom-out
    const startDelayId = window.setTimeout(() => {
      if (!mapInstanceRef.current || !isSearchingForDriversRef.current) return;

      const targetCoords: Coordinates[] = [passengerAnchor];
      if (isValidCoord(pickup)) targetCoords.push(pickup);
      if (isValidCoord(dropoff)) targetCoords.push(dropoff);

      if (routePathRef.current && routePathRef.current.length > 0) {
        const step = Math.max(1, Math.floor(routePathRef.current.length / 25));
        for (let i = 0; i < routePathRef.current.length; i += step) {
          if (isValidCoord(routePathRef.current[i])) {
            targetCoords.push(routePathRef.current[i]);
          }
        }
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
      const driversToFrame =
        nearbyDrivers.length > 0 ? nearbyDrivers : validDrivers.filter((d) => d._km <= 25).slice(0, 8);

      for (const drv of driversToFrame) {
        targetCoords.push({ lat: drv.lat, lng: drv.lng });
      }

      const computed = computeTargetCameraForBounds(
        targetCoords,
        topPadding,
        bottomPadding,
        48,
        10,
        15
      );
      if (!computed) return;

      // Strictly integer target zoom (< startZoom) so Google Maps raster tiles never snap/jitter
      const targetIntZoom = Math.max(10, Math.min(15, Math.floor(computed.zoom)));

      // Re-compute exact padded center for targetIntZoom so framing sits squarely above bottom sheet
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const pt of targetCoords) {
        if (pt.lat < minLat) minLat = pt.lat;
        if (pt.lat > maxLat) maxLat = pt.lat;
        if (pt.lng < minLng) minLng = pt.lng;
        if (pt.lng > maxLng) maxLng = pt.lng;
      }
      const midLat = (minLat + maxLat) / 2;
      const midLng = (minLng + maxLng) / 2;
      const finalPadded = getPaddedCenterLatLng(
        { lat: midLat, lng: midLng },
        targetIntZoom,
        topPadding,
        bottomPadding
      );
      const finalLat = finalPadded.lat();
      const finalLng = finalPadded.lng();

      const zoomSteps: number[] = [];
      for (let z = startZoom - 1; z >= targetIntZoom; z--) {
        zoomSteps.push(z);
      }

      if (zoomSteps.length === 0) {
        map.panTo({ lat: finalLat, lng: finalLng });
        return;
      }

      // Smooth cinematic slow-motion cadence (~520-680ms per zoom step) allowing Google Maps' native
      // tile zoom transition to complete each step cleanly without colliding or bouncing
      const stepIntervalMs = Math.max(480, Math.min(680, Math.round(2900 / zoomSteps.length)));

      zoomSteps.forEach((stepZoom, idx) => {
        const tid = window.setTimeout(() => {
          if (!mapInstanceRef.current || !isSearchingForDriversRef.current) return;
          const progress = (idx + 1) / zoomSteps.length;
          const eased = 1 - Math.pow(1 - progress, 2);
          const nextLat = startLat + (finalLat - startLat) * eased;
          const nextLng = startLng + (finalLng - startLng) * eased;

          mapInstanceRef.current.panTo({ lat: nextLat, lng: nextLng });
          mapInstanceRef.current.setZoom(stepZoom);
        }, idx * stepIntervalMs);
        searchTimersRef.current.push(tid);
      });

      // Final gentle settle to exact padded center after last zoom step completes
      const settleId = window.setTimeout(() => {
        if (!mapInstanceRef.current || !isSearchingForDriversRef.current) return;
        mapInstanceRef.current.panTo({ lat: finalLat, lng: finalLng });
      }, zoomSteps.length * stepIntervalMs + 380);
      searchTimersRef.current.push(settleId);
    }, 240);

    searchTimersRef.current.push(startDelayId);

    return () => {
      clearSearchTimers();
    };
  }, [mapReady, isSearchingForDrivers]);

  // Drivers Data Feed & Animation Loop
  const zoomRef = useRef<number>(15);
  
  useEffect(() => {
        if (!mapReady || !mapInstanceRef.current) return;
        const listener = mapInstanceRef.current.addListener('zoom_changed', () => {
            zoomRef.current = mapInstanceRef.current.getZoom();
        });
        return () => window.google.maps.event.removeListener(listener);
  }, [mapReady]);

  useEffect(() => {
      if (!mapReady || !mapInstanceRef.current || !CustomOverlayRef.current) return;
      const CustomOverlay = CustomOverlayRef.current;
      
      const states = driverStateRef.current;

      // Keep car markers visible individually across all city and neighborhood zooms
      const gridSize = zoomRef.current < 8 ? 0.1 : 0;
      const clusters: { [key: string]: typeof drivers } = {};
      const clusteredDrivers = [];

      drivers.forEach(driver => {
          if (gridSize > 0) {
              const gridX = Math.floor(driver.lng / gridSize);
              const gridY = Math.floor(driver.lat / gridSize);
              const key = `${gridX},${gridY}`;
              if (!clusters[key]) clusters[key] = [];
              clusters[key].push(driver);
          } else {
              // No clustering
              clusters[driver.id] = [driver];
          }
      });

      const activeIds = new Set<string>();

      Object.keys(clusters).forEach(key => {
          const cluster = clusters[key];
          if (cluster.length === 1) {
              clusteredDrivers.push(cluster[0]);
              activeIds.add(cluster[0].id);
          } else {
              // Create a cluster marker using the first driver's id with a 'cluster-' prefix
              const clusterId = `cluster-${key}`;
              const centerLat = cluster.reduce((sum, d) => sum + d.lat, 0) / cluster.length;
              const centerLng = cluster.reduce((sum, d) => sum + d.lng, 0) / cluster.length;
              clusteredDrivers.push({ id: clusterId, lat: centerLat, lng: centerLng, heading: 0, isCluster: true, count: cluster.length });
              activeIds.add(clusterId);
          }
      });

      // Add new / Update Target
      clusteredDrivers.forEach((driver: any) => {
          const contentKey = driver.isCluster
              ? `cluster_${driver.count}`
              : `driver_${!!driver.isNearby}_${!!driver.isSelected}`;
          if (!states[driver.id]) {
              let html = '';
              if (driver.isCluster) {
                  html = `<div style="position: absolute; transform: translate(-50%, -50%); display:flex; align-items:center; justify-content:center; width: 40px; height: 40px; background: #2563EB; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(37,99,235,0.4); z-index: 20; color: white; font-weight: bold; font-size: 16px;">${driver.count}</div>`;
              } else {
                  html = CAR_MARKER_HTML(!!driver.isNearby, !!driver.isSelected);
              }

              const overlay = new CustomOverlay(driver, html, 60, contentKey);
              overlay.setMap(mapInstanceRef.current);
              states[driver.id] = {
                  currentLat: driver.lat, currentLng: driver.lng,
                  targetLat: driver.lat, targetLng: driver.lng,
                  currentHeading: driver.heading || 0, targetHeading: driver.heading || 0,
                  overlay,
                  isCluster: driver.isCluster
              };
              if (!driver.isCluster) overlay.setRotation(driver.heading || 0);
          } else {
              const s = states[driver.id];
              s.targetLat = driver.lat;
              s.targetLng = driver.lng;
              if (driver.heading !== undefined) {
                  let diff = driver.heading - s.currentHeading;
                  while (diff > 180) diff -= 360;
                  while (diff <= -180) diff += 360;
                  s.targetHeading = s.currentHeading + diff;
              }
              const newHtml = driver.isCluster
                ? `<div style="position: absolute; transform: translate(-50%, -50%); display:flex; align-items:center; justify-content:center; width: 40px; height: 40px; background: #2563EB; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 10px rgba(37,99,235,0.4); z-index: 20; color: white; font-weight: bold; font-size: 16px;">${driver.count}</div>`
                : CAR_MARKER_HTML(!!driver.isNearby, !!driver.isSelected);
              s.overlay.updateContent(newHtml, contentKey);
          }
      });

      // Remove stale drivers/clusters
      Object.keys(states).forEach(id => {
          if (!activeIds.has(id)) {
              states[id].overlay.setMap(null);
              delete states[id];
          }
      });

      const startAnimationLoop = () => {
          if (animationFrameRef.current !== null) return;
          let lastTime = performance.now();
          const animate = (time: number) => {
              const elapsedMs = time - lastTime;
              // Throttle overlay projection math to ~30fps on mobile WebView so panning stays 60fps
              if (elapsedMs < 30) {
                  animationFrameRef.current = requestAnimationFrame(animate);
                  return;
              }
              const dt = Math.min(Math.max(elapsedMs / 1000, 0.016), 0.12);
              lastTime = time;
              const alpha = 1 - Math.exp(-9 * dt);
              let stillAnimating = false;

              const currentStates = driverStateRef.current;
              for (const id in currentStates) {
                  const s = currentStates[id];
                  const latDiff = s.targetLat - s.currentLat;
                  const lngDiff = s.targetLng - s.currentLng;
                  const headDiff = s.targetHeading - s.currentHeading;
                  const posPending = Math.abs(latDiff) > 0.000015 || Math.abs(lngDiff) > 0.000015;
                  const headPending = Math.abs(headDiff) > 1.0;

                  if (posPending || headPending) {
                      if (posPending) {
                          s.currentLat += latDiff * alpha;
                          s.currentLng += lngDiff * alpha;
                          if (Math.abs(s.targetLat - s.currentLat) <= 0.000015 && Math.abs(s.targetLng - s.currentLng) <= 0.000015) {
                              s.currentLat = s.targetLat;
                              s.currentLng = s.targetLng;
                          } else {
                              stillAnimating = true;
                          }
                          s.overlay.setPosition(s.currentLat, s.currentLng);
                      }
                      if (headPending && !s.isCluster) {
                          s.currentHeading += headDiff * alpha;
                          if (Math.abs(s.targetHeading - s.currentHeading) <= 1.0) {
                              s.currentHeading = s.targetHeading;
                          } else {
                              stillAnimating = true;
                          }
                          s.overlay.setRotation(s.currentHeading);
                      }
                  }
              }

              if (userStateRef.current && userOverlayRef.current && targetUserLocationRef.current) {
                  const s = userStateRef.current;
                  const targetUser = targetUserLocationRef.current;
                  const latDiff = targetUser.lat - s.currentLat;
                  const lngDiff = targetUser.lng - s.currentLng;
                  if (Math.abs(latDiff) > 0.000015 || Math.abs(lngDiff) > 0.000015) {
                      s.currentLat += latDiff * alpha;
                      s.currentLng += lngDiff * alpha;
                      if (Math.abs(targetUser.lat - s.currentLat) <= 0.000015 && Math.abs(targetUser.lng - s.currentLng) <= 0.000015) {
                          s.currentLat = targetUser.lat;
                          s.currentLng = targetUser.lng;
                      } else {
                          stillAnimating = true;
                      }
                      userOverlayRef.current.setPosition(s.currentLat, s.currentLng);
                  }
              }

              if (stillAnimating) {
                  animationFrameRef.current = requestAnimationFrame(animate);
              } else {
                  animationFrameRef.current = null;
              }
          };
          animationFrameRef.current = requestAnimationFrame(animate);
      };

      startAnimationLoopRef.current = startAnimationLoop;
      startAnimationLoop();
  }, [mapReady, drivers]);

  // Cleanup Animation
  useEffect(() => {
      return () => {
          if (animationFrameRef.current !== null) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
          }
          if (routeAbortControllerRef.current) {
              routeAbortControllerRef.current.abort();
              routeAbortControllerRef.current = null;
          }
          clearSearchTimers();
      };
  }, []);

  if (mapError) {
    return (
      <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
          <i className="fa-solid fa-map-location-dot text-xl"></i>
        </div>
        <p className="text-slate-800 font-bold mb-1">
          {language === 'ar' ? 'تعذر تحميل الخريطة' : 'Map Loading Notice'}
        </p>
        <p className="text-slate-500 text-xs max-w-xs mb-4">
          {mapError === 'InvalidKeyMapError'
            ? (language === 'ar' ? 'مفتاح الخريطة بحاجة لتفعيل خدمة Maps JavaScript API أو ضبط قيود النطاق' : 'Google Maps key requires Maps JavaScript API enabled or HTTP referrer permissions.')
            : (language === 'ar' ? 'جاري محاولة الاتصال بخدمة الخرائط...' : 'Connecting to map service...')}
        </p>
        <button
          onClick={() => { setMapError(null); window.location.reload(); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
        >
          {language === 'ar' ? 'إعادة المحاولة' : 'Reload Map'}
        </button>
      </div>
    );
  }

  return (
      <div className="w-full h-full relative" style={{ zIndex: 0 }}>
          <div ref={mapRef} className="w-full h-full outline-none" />
      </div>
  );
};

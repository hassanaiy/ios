import { getAppSettings } from './firebaseBridge';

export type MapProviderType = 'google' | 'mapbox';

class MapProviderServiceClass {
    private currentProvider: MapProviderType | null = null;
    private mapboxToken: string | null = null;
    private initPromise: Promise<void> | null = null;
    
    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;
        
        this.initPromise = (async () => {
            try {
                // By default we use google
                this.currentProvider = 'google';
                
                // Fetch settings
                const settings = await getAppSettings();
                if (settings?.mapProvider === 'mapbox' && settings.mapboxPublicToken) {
                    this.currentProvider = 'mapbox';
                    this.mapboxToken = settings.mapboxPublicToken;
                }
            } catch (_e) {
                this.currentProvider = 'google';
            }
        })();
        
        return this.initPromise;
    }

    getProvider(): MapProviderType {
        return this.currentProvider || 'google';
    }

    getMapboxToken(): string | null {
        return this.mapboxToken;
    }

    setFallbackToGoogle() {
        console.warn("Provider failed. Falling back to Google Maps");
        this.currentProvider = 'google';
    }
}

export const MapProviderService = new MapProviderServiceClass();

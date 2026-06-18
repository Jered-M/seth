import api from './api';
import { authService } from './authService';

export interface GeoPosition {
    lat: number;
    lng: number;
    accuracy?: number;
}

export interface TrackedEquipment {
    id: string;
    name: string;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    status: string;
    department: string;
    assignedTo?: string | null;
    locationSource: string;
}

const GEO_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
};

/** Distance approximative en mètres entre deux points GPS. */
export const distanceMeters = (a: GeoPosition, b: GeoPosition): number => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

export const hasMovedSignificantly = (
    next: GeoPosition,
    prev: GeoPosition | null,
    minM = 10
): boolean => {
    if (!prev) return true;
    return distanceMeters(next, prev) >= minM;
};

/** Arrondi ~11 m — évite les re-renders carte sur micro-variations GPS. */
export const roundCoordForStability = (value: number | null): string => {
    if (!Number.isFinite(value)) return 'null';
    return (Math.round(Number(value) * 1e4) / 1e4).toFixed(4);
};

export const isDesktopDevice = (): boolean =>
    !/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry/i.test(navigator.userAgent);

export const getLocationProfile = () => {
    if (isDesktopDevice()) {
        return {
            maxWaitMs: 12000,
            targetAccuracyM: 100,
            watchMinAccuracyM: 100,
            syncMinMoveM: 15,
            manualPickRecommended: true,
        };
    }
    return {
        maxWaitMs: 20000,
        targetAccuracyM: 25,
        watchMinAccuracyM: 50,
        syncMinMoveM: 8,
        manualPickRecommended: false,
    };
};

export const createManualPosition = (lat: number, lng: number): GeoPosition => ({
    lat,
    lng,
    accuracy: 5,
});

const normalizeRole = (role?: string | null): string => {
    if (!role) return 'USER';
    if (role === 'ADMIN_GENERAL') return 'SUPER_ADMIN';
    if (role === 'ADMIN_DEPT') return 'DEPT_ADMIN';
    if (role === 'SECURITY_AGENT') return 'GARDIEN';
    return role;
};

const toGeoPosition = (position: GeolocationPosition): GeoPosition => ({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
});

const isBetterReading = (next: GeoPosition, current: GeoPosition | null): boolean => {
    if (!current) return true;
    const nextAccuracy = next.accuracy ?? Number.POSITIVE_INFINITY;
    const currentAccuracy = current.accuracy ?? Number.POSITIVE_INFINITY;
    return nextAccuracy < currentAccuracy;
};

/** Lecture unique rapide (fallback). */
export const getBrowserLocation = (): Promise<GeoPosition | null> => {
    if (!navigator.geolocation) return Promise.resolve(null);

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(toGeoPosition(position)),
            () => resolve(null),
            GEO_OPTIONS
        );
    });
};

/**
 * Attend la meilleure position possible via watchPosition.
 * S'arrête dès que la précision cible est atteinte ou après maxWaitMs.
 */
export const getBestBrowserLocation = (options?: {
    maxWaitMs?: number;
    targetAccuracyM?: number;
}): Promise<GeoPosition | null> => {
    const profile = getLocationProfile();
    const maxWaitMs = options?.maxWaitMs ?? profile.maxWaitMs;
    const targetAccuracyM = options?.targetAccuracyM ?? profile.targetAccuracyM;

    if (!navigator.geolocation) return Promise.resolve(null);

    return new Promise((resolve) => {
        let best: GeoPosition | null = null;
        let watchId: number | null = null;
        let settled = false;

        const finish = (result: GeoPosition | null) => {
            if (settled) return;
            settled = true;
            if (watchId !== null) {
                navigator.geolocation.clearWatch(watchId);
            }
            clearTimeout(timeoutId);
            resolve(result);
        };

        const onPosition = (position: GeolocationPosition) => {
            const reading = toGeoPosition(position);
            if (isBetterReading(reading, best)) {
                best = reading;
            }
            if ((reading.accuracy ?? Number.POSITIVE_INFINITY) <= targetAccuracyM) {
                finish(reading);
            }
        };

        const onError = () => finish(best);

        const timeoutId = setTimeout(() => finish(best), maxWaitMs);

        watchId = navigator.geolocation.watchPosition(onPosition, onError, GEO_OPTIONS);

        navigator.geolocation.getCurrentPosition(onPosition, () => undefined, {
            ...GEO_OPTIONS,
            timeout: 8000,
        });
    });
};

/** Suivi continu — haute précision, ignore le cache, notifie si meilleure lecture ou déplacement. */
export const startLocationWatch = (
    onUpdate: (position: GeoPosition) => void,
    options?: { minAccuracyM?: number; minMoveM?: number }
): (() => void) => {
    if (!navigator.geolocation) return () => undefined;

    const profile = getLocationProfile();
    const minAccuracyM = options?.minAccuracyM ?? profile.watchMinAccuracyM;
    const minMoveM = options?.minMoveM ?? profile.syncMinMoveM;
    let lastSent: GeoPosition | null = null;

    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            const reading = toGeoPosition(position);
            const readingAccuracy = reading.accuracy ?? Number.POSITIVE_INFINITY;
            const lastAccuracy = lastSent?.accuracy ?? Number.POSITIVE_INFINITY;

            const significantlyBetter = readingAccuracy + 5 < lastAccuracy;
            const firstReading = !lastSent;
            const goodEnough = readingAccuracy <= minAccuracyM;
            const movedEnough = hasMovedSignificantly(reading, lastSent, minMoveM);

            if (firstReading || significantlyBetter || (goodEnough && movedEnough)) {
                lastSent = reading;
                onUpdate(reading);
            }
        },
        () => undefined,
        GEO_OPTIONS
    );

    return () => navigator.geolocation.clearWatch(watchId);
};

const mapDeviceItem = (item: Record<string, unknown>): TrackedEquipment => ({
    id: String(item.id),
    name: String(
        item.name ||
        item.assigned_to ||
        item.assignedTo ||
        item.serial_number ||
        item.serialNumber ||
        item.id
    ),
    lat: (item.last_known_lat ?? item.latitude ?? item.lat) as number | null,
    lng: (item.last_known_lng ?? item.longitude ?? item.lng) as number | null,
    accuracy: (item.last_known_accuracy ?? item.accuracy ?? null) as number | null,
    status: String(item.status || 'UNKNOWN'),
    department: String(item.department || 'N/A'),
    assignedTo: (item.assigned_to ?? item.assignedTo ?? null) as string | null,
    locationSource: 'device',
});

export const syncMyDevicePositions = async (position?: GeoPosition | null): Promise<void> => {
    const coords = position ?? (await getBestBrowserLocation());
    if (!coords) return;

    try {
        const response = await api.get('/user/devices/with-location');
        const devices = Array.isArray(response.data) ? response.data : [];

        await Promise.all(
            devices.map((device: { id: string }) =>
                api.post('/user/devices/position', {
                    device_id: device.id,
                    lat: coords.lat,
                    lng: coords.lng,
                    accuracy: coords.accuracy,
                }).catch(() => undefined)
            )
        );
    } catch {
        // L'utilisateur peut ne posséder aucun équipement assigné.
    }
};

export const fetchTrackedEquipments = async (): Promise<TrackedEquipment[]> => {
    const user = authService.getCurrentUser();
    const role = normalizeRole(user?.role);

    if (role === 'DEPT_ADMIN') {
        const response = await api.get('/user/department/devices-map');
        return (Array.isArray(response.data) ? response.data : []).map(mapDeviceItem);
    }

    if (role === 'SUPER_ADMIN') {
        const response = await api.get('/equipments/');
        return (Array.isArray(response.data) ? response.data : []).map(mapDeviceItem);
    }

    if (role === 'SUPERVISOR' || role === 'GARDIEN') {
        const response = await api.get('/user/connected-users/with-location');
        return (Array.isArray(response.data) ? response.data : []).map((item: Record<string, unknown>) => ({
            id: String(item.id),
            name: String(item.name || item.email || item.id),
            lat: (item.lat ?? null) as number | null,
            lng: (item.lng ?? null) as number | null,
            accuracy: (item.accuracy ?? null) as number | null,
            status: String(item.status || 'ONLINE'),
            department: String(item.department || 'N/A'),
            locationSource: String(item.location_source || 'login'),
        }));
    }

    const response = await api.get('/user/devices/with-location');
    return (Array.isArray(response.data) ? response.data : []).map(mapDeviceItem);
};

export const refreshTrackedLocations = async (): Promise<TrackedEquipment[]> => {
    await syncMyDevicePositions();
    return fetchTrackedEquipments();
};

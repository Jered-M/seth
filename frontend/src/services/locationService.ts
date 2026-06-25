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
    kind?: string;
    hasLocation?: boolean;
    lastLogin?: string | null;
    mapStatus?: string;
    zoneStatus?: string;
    zoneName?: string | null;
    deviceStatus?: string | null;
    serialNumber?: string | null;
    exitRequestStatus?: string | null;
    email?: string | null;
}

export interface LiveTrackingResult {
    items: TrackedEquipment[];
    onlineCount: number;
    locatedCount: number;
    superAdminPerimeter?: SuperAdminPerimeter | null;
}

export interface SuperAdminPerimeter {
    configured: boolean;
    radius_m: number;
    center_lat?: number | null;
    center_lng?: number | null;
    name?: string;
}

const GEO_HIGH_ACCURACY: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
};

/** Mobile navigateur (Chrome/Safari sur téléphone) — GPS matériel possible. */
export const isMobileWeb = (): boolean =>
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export const isDesktopDevice = (): boolean => !isMobileWeb();

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

export const getLocationProfile = () => {
    if (isMobileWeb()) {
        return {
            maxWaitMs: 25000,
            targetAccuracyM: 20,
            earlyAcceptAccuracyM: 45,
            watchMinAccuracyM: 35,
            syncMinMoveM: 5,
            watchIntervalMs: 8000,
            manualPickRecommended: false,
            freshMaximumAgeMs: 3000,
            loginMaxWaitMs: 12000,
            loginTargetAccuracyM: 30,
        };
    }
    return {
        maxWaitMs: 12000,
        targetAccuracyM: 100,
        earlyAcceptAccuracyM: 150,
        watchMinAccuracyM: 150,
        syncMinMoveM: 20,
        watchIntervalMs: 15000,
        manualPickRecommended: true,
        freshMaximumAgeMs: 5000,
        loginMaxWaitMs: 4000,
        loginTargetAccuracyM: 200,
    };
};

/** Qualité affichable pour l'utilisateur. */
export const describeAccuracy = (accuracyM?: number | null): string => {
    if (!Number.isFinite(accuracyM)) return 'Inconnue';
    const m = Math.round(accuracyM as number);
    if (m <= 15) return `Haute (±${m} m)`;
    if (m <= 50) return `Bonne (±${m} m)`;
    if (m <= 150) return `Moyenne (±${m} m)`;
    return `Faible (±${m} m) — WiFi/IP`;
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

/** Lecture unique — position fraîche (bouton « Ma position GPS »). */
export const getFreshBrowserLocation = (): Promise<GeoPosition | null> => {
    if (!navigator.geolocation) return Promise.resolve(null);
    const profile = getLocationProfile();

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(toGeoPosition(position)),
            () => resolve(null),
            {
                enableHighAccuracy: true,
                maximumAge: profile.freshMaximumAgeMs,
                timeout: 15000,
            }
        );
    });
};

/** Lecture unique rapide (fallback). */
export const getBrowserLocation = (): Promise<GeoPosition | null> => {
    if (!navigator.geolocation) return Promise.resolve(null);

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(toGeoPosition(position)),
            () => resolve(null),
            GEO_HIGH_ACCURACY
        );
    });
};

/**
 * Attend la meilleure position via watchPosition (comme Usafi High accuracy).
 * Sur mobile web : jusqu'à 25 s pour viser ±20 m.
 */
export const getBestBrowserLocation = (options?: {
    maxWaitMs?: number;
    targetAccuracyM?: number;
    earlyAcceptAccuracyM?: number;
}): Promise<GeoPosition | null> => {
    const profile = getLocationProfile();
    const maxWaitMs = options?.maxWaitMs ?? profile.maxWaitMs;
    const targetAccuracyM = options?.targetAccuracyM ?? profile.targetAccuracyM;
    const earlyAcceptAccuracyM = options?.earlyAcceptAccuracyM ?? profile.earlyAcceptAccuracyM;

    if (!navigator.geolocation) return Promise.resolve(null);

    return new Promise((resolve) => {
        let best: GeoPosition | null = null;
        let watchId: number | null = null;
        let settled = false;
        const startedAt = Date.now();

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
            const acc = reading.accuracy ?? Number.POSITIVE_INFINITY;
            if (acc <= targetAccuracyM) {
                finish(reading);
                return;
            }
            // Après 6 s sur mobile, accepter une lecture déjà correcte
            const elapsed = Date.now() - startedAt;
            if (elapsed >= 6000 && acc <= earlyAcceptAccuracyM) {
                finish(best);
            }
        };

        const onError = () => finish(best);

        const timeoutId = setTimeout(() => finish(best), maxWaitMs);

        watchId = navigator.geolocation.watchPosition(onPosition, onError, GEO_HIGH_ACCURACY);

        navigator.geolocation.getCurrentPosition(onPosition, () => undefined, {
            ...GEO_HIGH_ACCURACY,
            timeout: 12000,
        });
    });
};

/** Position optimisée pour la connexion (ne bloque pas trop longtemps). */
export const getLoginBrowserLocation = (): Promise<GeoPosition | null> => {
    const profile = getLocationProfile();
    return Promise.race([
        getBestBrowserLocation({
            maxWaitMs: profile.loginMaxWaitMs,
            targetAccuracyM: profile.loginTargetAccuracyM,
            earlyAcceptAccuracyM: profile.loginTargetAccuracyM * 2,
        }),
        new Promise<GeoPosition | null>((resolve) =>
            setTimeout(() => resolve(null), profile.loginMaxWaitMs)
        ),
    ]);
};

/** Suivi continu — haute précision, throttle temps + distance (style Usafi watchPositionAsync). */
export const startLocationWatch = (
    onUpdate: (position: GeoPosition) => void,
    options?: { minAccuracyM?: number; minMoveM?: number; intervalMs?: number }
): (() => void) => {
    if (!navigator.geolocation) return () => undefined;

    const profile = getLocationProfile();
    const minAccuracyM = options?.minAccuracyM ?? profile.watchMinAccuracyM;
    const minMoveM = options?.minMoveM ?? profile.syncMinMoveM;
    const intervalMs = options?.intervalMs ?? profile.watchIntervalMs;
    let lastSent: GeoPosition | null = null;
    let lastEmitAt = 0;

    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            const reading = toGeoPosition(position);
            const readingAccuracy = reading.accuracy ?? Number.POSITIVE_INFINITY;
            const lastAccuracy = lastSent?.accuracy ?? Number.POSITIVE_INFINITY;
            const now = Date.now();

            const significantlyBetter = readingAccuracy + 5 < lastAccuracy;
            const firstReading = !lastSent;
            const goodEnough = readingAccuracy <= minAccuracyM;
            const movedEnough = hasMovedSignificantly(reading, lastSent, minMoveM);
            const intervalElapsed = now - lastEmitAt >= intervalMs;

            const shouldEmit =
                firstReading ||
                significantlyBetter ||
                (goodEnough && movedEnough) ||
                (goodEnough && intervalElapsed);

            if (shouldEmit) {
                lastSent = reading;
                lastEmitAt = now;
                onUpdate(reading);
            }
        },
        () => undefined,
        GEO_HIGH_ACCURACY
    );

    return () => navigator.geolocation.clearWatch(watchId);
};

const mapLiveItem = (item: Record<string, unknown>): TrackedEquipment => ({
    id: String(item.id),
    name: String(item.name || item.assignedTo || item.email || item.id),
    lat: (item.lat ?? null) as number | null,
    lng: (item.lng ?? null) as number | null,
    accuracy: (item.accuracy ?? null) as number | null,
    status: String(item.status || 'ONLINE'),
    department: String(item.department || 'N/A'),
    assignedTo: (item.assignedTo ?? item.name ?? null) as string | null,
    locationSource: String(item.location_source || 'unavailable'),
    kind: item.kind ? String(item.kind) : undefined,
    hasLocation: Boolean(item.has_location),
    lastLogin: (item.last_login as string) ?? null,
    mapStatus: item.map_status ? String(item.map_status) : undefined,
    zoneStatus: item.zone_status ? String(item.zone_status) : undefined,
    zoneName: (item.zone_name as string) ?? null,
    deviceStatus: item.device_status ? String(item.device_status) : null,
    serialNumber: item.serial_number ? String(item.serial_number) : null,
    exitRequestStatus: item.exit_request_status ? String(item.exit_request_status) : null,
    email: item.email ? String(item.email) : null,
});

const mapDeviceItem = (item: Record<string, unknown>): TrackedEquipment => {
    const lat = (item.last_known_lat ?? item.latitude ?? item.lat) as number | null;
    const lng = (item.last_known_lng ?? item.longitude ?? item.lng) as number | null;
    return {
        id: String(item.id),
        name: String(
            item.name ||
            item.assigned_to ||
            item.assignedTo ||
            item.serial_number ||
            item.serialNumber ||
            item.id
        ),
        lat,
        lng,
        accuracy: (item.last_known_accuracy ?? item.accuracy ?? null) as number | null,
        status: String(item.status || 'UNKNOWN'),
        department: String(item.department || 'N/A'),
        assignedTo: (item.assigned_to ?? item.assignedTo ?? null) as string | null,
        locationSource: 'device',
        hasLocation: Number.isFinite(lat) && Number.isFinite(lng),
    };
};

export const fetchLiveTracking = async (): Promise<LiveTrackingResult> => {
    const response = await api.get('/user/tracking/live-positions');
    const data = response.data ?? {};
    const raw = Array.isArray(data.items) ? data.items : [];
    const perimeter = data.super_admin_perimeter as SuperAdminPerimeter | undefined;
    return {
        items: raw.map((item: Record<string, unknown>) => mapLiveItem(item)),
        onlineCount: Number(data.online_count ?? 0),
        locatedCount: Number(data.located_count ?? 0),
        superAdminPerimeter: perimeter ?? null,
    };
};

export const syncUserPerimeterLocation = async (position: GeoPosition): Promise<void> => {
    try {
        await api.post('/user/location/sync', {
            lat: position.lat,
            lng: position.lng,
            accuracy: position.accuracy,
        });
    } catch {
        // Périmètre ou GPS indisponible
    }
};

export const syncMyDevicePositions = async (position?: GeoPosition | null): Promise<void> => {
    const coords = position ?? (await getBestBrowserLocation());
    if (!coords) return;

    await syncUserPerimeterLocation(coords);

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

    if (role === 'SUPER_ADMIN' || role === 'DEPT_ADMIN' || role === 'SUPERVISOR' || role === 'GARDIEN') {
        const live = await fetchLiveTracking();
        return live.items;
    }

    const response = await api.get('/user/devices/with-location');
    return (Array.isArray(response.data) ? response.data : []).map(mapDeviceItem);
};

export const refreshTrackedLocations = async (): Promise<TrackedEquipment[]> => {
    await syncMyDevicePositions();
    return fetchTrackedEquipments();
};

import { distanceMeters, GeoPosition } from './locationService';

export interface RouteResult {
    coordinates: [number, number][];
    distanceM: number;
    durationS: number;
    source: 'osrm' | 'direct';
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

export const formatRouteDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
};

export const formatRouteDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)} s`;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
};

export const googleMapsDirectionsUrl = (from: GeoPosition, to: GeoPosition): string => {
    const params = new URLSearchParams({
        api: '1',
        origin: `${from.lat},${from.lng}`,
        destination: `${to.lat},${to.lng}`,
        travelmode: 'walking',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export async function fetchShortestRoute(
    from: GeoPosition,
    to: GeoPosition,
    profile: 'foot' | 'driving' = 'foot'
): Promise<RouteResult> {
    const url = `${OSRM_BASE}/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('OSRM indisponible');

        const data = await response.json();
        const route = data?.routes?.[0];
        if (data?.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
            throw new Error('Aucun itinéraire');
        }

        const coordinates: [number, number][] = route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
        );

        return {
            coordinates,
            distanceM: route.distance,
            durationS: route.duration,
            source: 'osrm',
        };
    } catch {
        const distanceM = distanceMeters(from, to);
        return {
            coordinates: [
                [from.lat, from.lng],
                [to.lat, to.lng],
            ],
            distanceM,
            durationS: distanceM / 1.35,
            source: 'direct',
        };
    }
}

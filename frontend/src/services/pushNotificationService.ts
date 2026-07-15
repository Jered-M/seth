import api from './api';

const SW_URL = '/sw.js';
const SW_SCOPE = '/';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

export const isPushSupported = (): boolean =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

export async function getPushPermission(): Promise<NotificationPermission> {
    if (!isPushSupported()) return 'denied';
    return Notification.permission;
}

export async function registerPushNotifications(): Promise<boolean> {
    if (!isPushSupported()) return false;

    const { data } = await api.get<{ public_key?: string; configured?: boolean }>(
        '/user/push/vapid-public-key'
    );
    if (!data.configured || !data.public_key) {
        return false;
    }

    let permission = Notification.permission;
    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
        return false;
    }

    const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.public_key) as BufferSource,
        });
    }

    const subJson = subscription.toJSON();
    await api.post('/user/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
    });

    localStorage.setItem('push_enabled', 'true');
    return true;
}

export async function unregisterPushNotifications(): Promise<void> {
    if (!isPushSupported()) return;

    const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const subscription = registration ? await registration.pushManager.getSubscription() : null;

    if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => undefined);
        await api.post('/user/push/unsubscribe', { endpoint }).catch(() => undefined);
    }

    localStorage.removeItem('push_enabled');
}

export async function syncPushSubscriptionIfEnabled(): Promise<void> {
    if (!isPushSupported()) return;
    if (localStorage.getItem('push_enabled') !== 'true' && Notification.permission !== 'granted') {
        return;
    }
    try {
        await registerPushNotifications();
    } catch {
        // Navigateur ou clés VAPID indisponibles
    }
}

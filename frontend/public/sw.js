/* Service worker SENTINEL — notifications push hors plateforme */
self.addEventListener('push', (event) => {
    let payload = {
        title: 'SENTINEL',
        body: 'Nouvelle notification',
        tag: 'seth-notif',
    };

    try {
        if (event.data) {
            const parsed = event.data.json();
            payload = { ...payload, ...parsed };
        }
    } catch {
        if (event.data) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body || '',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.tag || payload.notification_id || 'seth-notif',
        renotify: true,
        data: payload,
    };

    event.waitUntil(self.registration.showNotification(payload.title || 'SENTINEL', options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
            return undefined;
        })
    );
});

// Psicoluz Service Worker
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });
self.addEventListener('fetch', e => { /* passthrough: siempre red (datos viven en Supabase) */ });

// Notificación push real (recordatorio-sesiones en el servidor) - esto es
// lo que permite que suene aunque la pantalla esté apagada o la app
// cerrada: el sistema operativo despierta este Service Worker al recibir
// el push, sin que la app tenga que estar abierta en memoria.
self.addEventListener('push', e => {
  let data = { title: '🔔 Psicoluz', body: 'Tienes una sesión próxima' };
  try { if (e.data) data = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'psicoluz-recordatorio',
    requireInteraction: true
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./index.html');
  }));
});

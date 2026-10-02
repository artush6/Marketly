/* Marketly Web Push service worker. Push is always shown immediately for Safari. */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || "Open Marketly to review your alert." }; }
  const title = payload.title || "Marketly alert";
  const options = {
    body: payload.body || "Open Marketly to review the latest market alert.",
    icon: "/apple-touch-icon.png",
    badge: "/marketly-icon.svg",
    tag: payload.tag || payload.id || "marketly-alert",
    renotify: false,
    data: { url: payload.url || "/alerts" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const candidate = new URL(data.url || "/alerts", self.location.origin);
  const targetUrl = candidate.origin === self.location.origin
    ? candidate
    : new URL("/alerts", self.location.origin);
  // The alert ID selects the saved brief on the Alerts page. Keeping this in
  // the URL also makes the destination survive a cold launch on iPhone.
  if (data.id) targetUrl.searchParams.set("notification", String(data.id));
  const target = targetUrl.href;
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

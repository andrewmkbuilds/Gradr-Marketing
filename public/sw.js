/* Gradr service worker — offline support.
 *
 * Strategy
 * - Navigations: network-first, fall back to the cached app shell, then /offline.html.
 * - Hashed build assets (/assets/*): cache-first (immutable, content-hashed).
 * - Static brand/icon files: stale-while-revalidate.
 * - Everything else (API, auth, functions, analytics): never cached, never intercepted.
 */

const VERSION = "gradr-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const STATIC_CACHE = `${VERSION}-static`;

const SHELL_URL = "/index.html";
const OFFLINE_URL = "/offline.html";

/** Cap on how long a navigation may wait before the cached shell wins. */
const NAV_TIMEOUT_MS = 3500;

const PRECACHE = [
  OFFLINE_URL,
  "/favicon.png",
  "/gradr-logo.png",
  "/gradr-logo.svg",
  "/site.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE).catch(() => {});
      const shell = await caches.open(SHELL_CACHE);
      await shell.add(SHELL_URL).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStatic(pathname) {
  return /\.(png|jpg|jpeg|svg|webp|ico|woff2?|webmanifest|txt|xml)$/i.test(pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Only handle same-origin traffic; APIs/CDNs stay untouched.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/functions/") || url.pathname.startsWith("/rest/")) return;

  // App shell navigations.
  //
  // Network-first, but never open-ended: a "degraded" connection (captive
  // portal, one bar of signal) can leave a navigation hanging for 30s+, which
  // reads as a broken site. The fetch races a short timer, and when the
  // browser already reports offline we skip the network entirely and serve the
  // cached shell instantly so the app's own offline-aware 404 renders. Only if
  // no shell was ever cached do we fall back to the static offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cachedShell = async () =>
          (await caches.match(SHELL_URL)) ||
          (await caches.match(OFFLINE_URL)) ||
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });

        if (self.navigator && self.navigator.onLine === false) {
          const offlineShell = await cachedShell();
          // Keep revalidating in the background in case connectivity returns.
          event.waitUntil(
            fetch(req)
              .then(async (fresh) => {
                const cache = await caches.open(SHELL_CACHE);
                await cache.put(SHELL_URL, fresh.clone());
              })
              .catch(() => {}),
          );
          return offlineShell;
        }

        try {
          const fresh = await Promise.race([
            fetch(req),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("navigation-timeout")), NAV_TIMEOUT_MS),
            ),
          ]);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(SHELL_URL, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          return cachedShell();
        }
      })(),
    );
    return;
  }

  // Immutable hashed build output
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(ASSET_CACHE);
          cache.put(req, res.clone()).catch(() => {});
        }
        return res;
      })(),
    );
    return;
  }

  // Static brand assets: serve cached instantly, refresh in background
  if (isStatic(url.pathname)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, res.clone()).catch(() => {}));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
});

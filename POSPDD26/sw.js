/* ==========================================================
   🧠 PROVSOFT POS — SERVICE WORKER
   Versión: provsoft-pos-v10
   Modo: Offline First + Runtime Cache
   ========================================================== */

const CACHE_NAME = "provsoft-pos-v10";

/* 🔹 Archivos estáticos críticos */
const STATIC_ASSETS = [
  "./",
  "./POSVTA4.html",            // ⚠️ ajusta si el nombre es otro
  "./offline.html",
  "./manifest.json",
  "./logo_proveedora.webp",

  // 🔹 JS locales (si existen)
  "./app.js",
  "./geoHelper.js",
  "./html5-qrcode.min.js",

  // 🔹 Iconos PWA (ajústalos según tu carpeta)
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/* ==========================================================
   🔧 INSTALL — Precarga archivos críticos
   ========================================================== */
self.addEventListener("install", event => {
  console.log("🟢 SW instalado:", CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );

  self.skipWaiting();
});

/* ==========================================================
   🔄 ACTIVATE — Limpieza de versiones antiguas
   ========================================================== */
self.addEventListener("activate", event => {
  console.log("🔄 SW activado:", CACHE_NAME);

  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log("🧹 Eliminando cache viejo:", k);
            return caches.delete(k);
          })
      )
    )
  );

  self.clients.claim();
});

/* ==========================================================
   🌐 FETCH — Estrategia híbrida inteligente
   ========================================================== */
self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // 🚫 No interceptar Firebase ni Google
  if (
    url.origin.includes("firebase") ||
    url.origin.includes("googleapis") ||
    url.origin.includes("gstatic")
  ) {
    return;
  }

  // 📦 Catálogo dinámico → cache-first
  if (url.pathname === "/catalogo") {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(req);
        if (cached) {
          console.log("⚡ Catálogo servido desde cache SW");
          return cached;
        }
        try {
          const net = await fetch(req);
          cache.put(req, net.clone());
          return net;
        } catch (e) {
          return cached || new Response("[]", { headers: { "Content-Type": "application/json" } });
        }
      })
    );
    return;
  }

  // 🧱 Archivos estáticos → cache first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req)
        .then(res => {
          // Guardar solo GET válidos
          if (req.method === "GET" && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => {
          // 📴 Fallback offline para HTML
          if (req.headers.get("accept")?.includes("text/html")) {
            return caches.match("./offline.html");
          }
        });
    })
  );
});

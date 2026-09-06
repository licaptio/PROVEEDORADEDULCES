export async function cachearDatos(ruta, data) {
  const cache = await caches.open("provsoft-pos-v10");

  await cache.put(
    location.origin + ruta,
    new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json"
      }
    })
  );
}

export async function leerCache(ruta) {
  const cache = await caches.open("provsoft-pos-v10");

  const res = await cache.match(location.origin + ruta);

  if (!res) return null;

  return await res.json();
}

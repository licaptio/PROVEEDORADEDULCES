const DB_NAME = "POSPDD26_DB";
const DB_VERSION = 3;

const STORE_PRODUCTOS = "productos";
const STORE_META = "meta";
const STORE_FOTOS = "productos_fotos_meta";
const STORE_VENTAS_PENDIENTES = "ventas_pendientes";
const STORE_LOCAL = "datos_locales";

export function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(STORE_PRODUCTOS)) {
        db.createObjectStore(STORE_PRODUCTOS, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_FOTOS)) {
        db.createObjectStore(STORE_FOTOS, { keyPath: "codigo" });
      }

      if (!db.objectStoreNames.contains(STORE_VENTAS_PENDIENTES)) {
        db.createObjectStore(STORE_VENTAS_PENDIENTES, { keyPath: "id_local" });
      }

      if (!db.objectStoreNames.contains(STORE_LOCAL)) {
        db.createObjectStore(STORE_LOCAL, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarProductos(productos = []) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTOS, "readwrite");
    const store = tx.objectStore(STORE_PRODUCTOS);

    productos.forEach(p => store.put(p));

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function obtenerProductos() {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTOS, "readonly");
    const store = tx.objectStore(STORE_PRODUCTOS);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarMeta(id, data) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).put({ id, ...data });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function obtenerMeta(id) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readonly");
    const req = tx.objectStore(STORE_META).get(id);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarFotos(fotos = []) {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOTOS, "readwrite");
    const store = tx.objectStore(STORE_FOTOS);

    fotos.forEach(f => store.put(f));

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function obtenerFotos() {
  const db = await abrirDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FOTOS, "readonly");
    const store = tx.objectStore(STORE_FOTOS);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarDatoLocal(id, valor) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOCAL, "readwrite");
    tx.objectStore(STORE_LOCAL).put({ id, valor, actualizado_en: new Date().toISOString() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function obtenerDatoLocal(id, valorDefault = null) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_LOCAL, "readonly").objectStore(STORE_LOCAL).get(id);
    req.onsuccess = () => resolve(req.result?.valor ?? valorDefault);
    req.onerror = () => reject(req.error);
  });
}

export async function eliminarDatoLocal(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LOCAL, "readwrite");
    tx.objectStore(STORE_LOCAL).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function guardarVentaPendienteLocal(item) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS_PENDIENTES, "readwrite");
    tx.objectStore(STORE_VENTAS_PENDIENTES).put(item);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function obtenerVentasPendientesLocal() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_VENTAS_PENDIENTES, "readonly")
      .objectStore(STORE_VENTAS_PENDIENTES).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function eliminarVentaPendienteLocal(idLocal) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS_PENDIENTES, "readwrite");
    tx.objectStore(STORE_VENTAS_PENDIENTES).delete(idLocal);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function migrarLocalStorageAIndexedDB() {
  const claves = [
    "usuario_ruta", "POS_CONFIG_IMPRESION", "POS_VENTA_ACTUAL_LOCAL",
    "POS_VENTA_ACTUAL_LOCAL_HASH", "ventaEnEsperaRecuperadaPOS",
    "ultimaVentaEnEsperaPOS", "ultimaVentaPOS"
  ];

  for (const clave of claves) {
    const raw = localStorage.getItem(clave);
    if (raw == null) continue;
    let valor = raw;
    try { valor = JSON.parse(raw); } catch (_) { /* texto simple */ }
    await guardarDatoLocal(clave, valor);
    localStorage.removeItem(clave);
  }

  const colaRaw = localStorage.getItem("ventas_pendientes_pospdd26");
  if (colaRaw) {
    try {
      const cola = JSON.parse(colaRaw);
      for (const item of Array.isArray(cola) ? cola : []) {
        if (item?.id_local) await guardarVentaPendienteLocal(item);
      }
      localStorage.removeItem("ventas_pendientes_pospdd26");
    } catch (err) {
      console.warn("No se pudo migrar la cola anterior:", err);
    }
  }
}

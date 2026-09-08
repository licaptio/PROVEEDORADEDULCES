const DB_NAME = "provsoftDB";
const DB_VERSION = 3;
const STORE_PRODUCTOS = "productos";
const INDEX_FIRESTORE_ID = "por_firestore_id";
const INDEX_EQUIVALENTE = "por_codigo_equivalente";

function normalizarProductoLocal(producto = {}) {
  const codigoBarra = String(producto.codigoBarra || "").trim();
  const codigosEquivalentes = Array.isArray(producto.codigosEquivalentes)
    ? producto.codigosEquivalentes.map(v => String(v).trim()).filter(Boolean)
    : [];
  return { ...producto, codigoBarra, codigosEquivalentes };
}

function esperarTransaccion(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Transacción IndexedDB abortada"));
  });
}

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      let store;

      if (!db.objectStoreNames.contains(STORE_PRODUCTOS)) {
        store = db.createObjectStore(STORE_PRODUCTOS, { keyPath: "codigoBarra" });
      } else {
        store = request.transaction.objectStore(STORE_PRODUCTOS);
      }

      // No se marca unique para poder limpiar instalaciones antiguas donde
      // un producto pudo quedar guardado con el código anterior y el nuevo.
      if (!store.indexNames.contains(INDEX_FIRESTORE_ID)) {
        store.createIndex(INDEX_FIRESTORE_ID, "id", { unique: false });
      }
      if (!store.indexNames.contains(INDEX_EQUIVALENTE)) {
        store.createIndex(INDEX_EQUIVALENTE, "codigosEquivalentes", { unique: false, multiEntry: true });
      }
    };

    request.onsuccess = e => resolve(e.target.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProductos(lista, { reemplazar = false } = {}) {
  const db = await openDB();
  const tx = db.transaction(STORE_PRODUCTOS, "readwrite");
  const store = tx.objectStore(STORE_PRODUCTOS);

  if (reemplazar) store.clear();

  for (const original of lista || []) {
    const producto = normalizarProductoLocal(original);
    if (!producto.codigoBarra || producto.activo === false) continue;
    store.put(producto);
  }

  await esperarTransaccion(tx);
}

export async function saveProductoIndividual(productoOriginal) {
  const producto = normalizarProductoLocal(productoOriginal);

  if (!producto?.id) {
    if (!producto?.codigoBarra || producto?.activo === false) return;
    const db = await openDB();
    const tx = db.transaction(STORE_PRODUCTOS, "readwrite");
    tx.objectStore(STORE_PRODUCTOS).put(producto);
    await esperarTransaccion(tx);
    return;
  }

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTOS, "readwrite");
    const store = tx.objectStore(STORE_PRODUCTOS);
    const index = store.index(INDEX_FIRESTORE_ID);
    const req = index.getAll(producto.id);

    req.onsuccess = () => {
      const anteriores = req.result || [];

      // Si cambió codigoBarra, elimina cualquier clave anterior del mismo
      // documento Firestore antes de guardar la nueva.
      for (const anterior of anteriores) {
        const codigoAnterior = String(anterior?.codigoBarra || "").trim();
        const codigoNuevo = String(producto?.codigoBarra || "").trim();
        if (codigoAnterior && (codigoAnterior !== codigoNuevo || producto.activo === false)) {
          store.delete(codigoAnterior);
        }
      }

      if (producto.activo !== false && producto.codigoBarra) {
        store.put(producto);
      }
    };

    req.onerror = () => {
      try { tx.abort(); } catch {}
      reject(req.error);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("No se pudo actualizar el producto local"));
  });
}

export async function deleteProductoPorFirestoreId(firestoreId) {
  if (!firestoreId) return;
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTOS, "readwrite");
    const store = tx.objectStore(STORE_PRODUCTOS);
    const index = store.index(INDEX_FIRESTORE_ID);
    const req = index.getAll(firestoreId);

    req.onsuccess = () => {
      for (const producto of req.result || []) {
        if (producto?.codigoBarra) store.delete(producto.codigoBarra);
      }
    };

    req.onerror = () => {
      try { tx.abort(); } catch {}
      reject(req.error);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("No se pudo eliminar el producto local"));
  });
}

export async function getAllProductos() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTOS, "readonly");
    const req = tx.objectStore(STORE_PRODUCTOS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}


export async function getProductoPorCodigo(codigo) {
  const codigoTxt = String(codigo || "").trim();
  if (!codigoTxt) return null;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PRODUCTOS, "readonly");
    const store = tx.objectStore(STORE_PRODUCTOS);
    const principal = store.get(codigoTxt);

    principal.onsuccess = () => {
      if (principal.result) {
        resolve(principal.result);
        return;
      }

      const equivalentes = store.index(INDEX_EQUIVALENTE).get(codigoTxt);
      equivalentes.onsuccess = () => resolve(equivalentes.result || null);
      equivalentes.onerror = () => reject(equivalentes.error);
    };
    principal.onerror = () => reject(principal.error);
  });
}

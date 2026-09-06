import { db } from "../firebase/config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const DB_NAME = "POSPDD26_FOTOS";
const STORE_NAME = "productos_fotos_meta";

let cacheFotosMemoria = new Map();

export async function descargarCatalogoFotos() {
  const snap = await getDocs(collection(db, "productos_fotos_meta"));

  const dbLocal = await abrirDBFotos();
  const tx = dbLocal.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  cacheFotosMemoria.clear();

  snap.forEach((docSnap) => {
    const data = {
      codigo: docSnap.id,
      ...docSnap.data()
    };

    store.put(data);
    cacheFotosMemoria.set(docSnap.id, data);
  });

  await tx.done;

  console.log("Catálogo de fotos descargado:", cacheFotosMemoria.size);
}

export async function cargarCatalogoFotosLocal() {
  const dbLocal = await abrirDBFotos();
  const tx = dbLocal.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      cacheFotosMemoria.clear();

      for (const item of request.result || []) {
        cacheFotosMemoria.set(String(item.codigo), item);
      }

      console.log("Catálogo de fotos local cargado:", cacheFotosMemoria.size);
      resolve(cacheFotosMemoria);
    };

    request.onerror = () => reject(request.error);
  });
}

export function obtenerFotosLocal(codigo) {
  const key = String(codigo || "").trim();

  if (!key) return [];

  const meta = cacheFotosMemoria.get(key);

  if (!meta) return [];

  return Array.isArray(meta.urlsFotos)
    ? meta.urlsFotos.filter(Boolean)
    : [];
}

function abrirDBFotos() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "codigo"
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

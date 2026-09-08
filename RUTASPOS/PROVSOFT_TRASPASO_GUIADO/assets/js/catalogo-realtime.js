import { db, collection, query, where, onSnapshot } from "./firebase.js";
import {
  getAllProductos,
  saveProductoIndividual,
  deleteProductoPorFirestoreId
} from "./db-local.js";

function comparable(producto = {}) {
  return JSON.stringify({
    id: producto.id || "",
    codigoBarra: String(producto.codigoBarra || ""),
    concepto: String(producto.concepto || ""),
    precioPublico: Number(producto.precioPublico || 0),
    codigosEquivalentes: Array.isArray(producto.codigosEquivalentes)
      ? [...producto.codigosEquivalentes].map(String).sort()
      : [],
    activo: producto.activo !== false
  });
}

function crearMapaLocal(productos = []) {
  const mapa = new Map();
  const duplicados = new Set();

  for (const producto of productos) {
    if (!producto?.id) continue;
    if (mapa.has(producto.id)) duplicados.add(producto.id);
    mapa.set(producto.id, producto);
  }

  return { mapa, duplicados };
}

/**
 * Mantiene IndexedDB sincronizado con /productos activos.
 *
 * En vivo:
 * - added: agrega producto nuevo/reactivado.
 * - modified: actualiza únicamente ese producto.
 * - removed: elimina producto borrado/desactivado.
 *
 * Un cambio de codigoBarra elimina primero la clave anterior del mismo id.
 */
export async function iniciarCatalogoEnVivo({ onCambios, onEstado, onError } = {}) {
  const localesIniciales = await getAllProductos();
  const { mapa: mapaLocal, duplicados } = crearMapaLocal(localesIniciales);
  let baseServidorConfirmada = false;

  const q = query(collection(db, "productos"), where("activo", "==", true));

  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    async snapshot => {
      let cambiosAplicados = 0;

      try {
        const vieneDeCache = snapshot.metadata.fromCache;

        // Solo se eliminan locales ausentes cuando Firestore confirma una
        // instantánea de servidor. Así una apertura SIN internet jamás vacía
        // el catálogo de IndexedDB.
        if (!vieneDeCache && !baseServidorConfirmada) {
          const idsActivos = new Set(snapshot.docs.map(d => d.id));
          for (const firestoreId of [...mapaLocal.keys()]) {
            if (!idsActivos.has(firestoreId)) {
              await deleteProductoPorFirestoreId(firestoreId);
              mapaLocal.delete(firestoreId);
              cambiosAplicados++;
            }
          }
          baseServidorConfirmada = true;
        }

        for (const cambio of snapshot.docChanges({ includeMetadataChanges: true })) {
          const firestoreId = cambio.doc.id;

          if (cambio.type === "removed") {
            // Una remoción de una instantánea de caché no debe destruir la
            // copia local sin confirmación del servidor.
            if (!vieneDeCache || baseServidorConfirmada) {
              await deleteProductoPorFirestoreId(firestoreId);
              mapaLocal.delete(firestoreId);
              cambiosAplicados++;
            }
            continue;
          }

          const producto = { id: firestoreId, ...cambio.doc.data() };
          const anterior = mapaLocal.get(firestoreId);
          const necesitaLimpieza = duplicados.has(firestoreId);

          if (necesitaLimpieza || !anterior || comparable(anterior) !== comparable(producto)) {
            await saveProductoIndividual(producto);
            mapaLocal.set(firestoreId, producto);
            duplicados.delete(firestoreId);
            cambiosAplicados++;
          }
        }

        onEstado?.({ conectado: !vieneDeCache, cambios: cambiosAplicados });
        if (cambiosAplicados > 0) await onCambios?.(cambiosAplicados);
      } catch (err) {
        console.error("Error aplicando cambios del catálogo en vivo:", err);
        onError?.(err);
      }
    },
    err => {
      console.error("Listener de productos desconectado:", err);
      onEstado?.({ conectado: false, cambios: 0 });
      onError?.(err);
    }
  );
}

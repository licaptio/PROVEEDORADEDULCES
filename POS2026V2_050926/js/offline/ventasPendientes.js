import { db } from "../firebase/config.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  guardarVentaPendienteLocal,
  obtenerVentasPendientesLocal,
  eliminarVentaPendienteLocal
} from "../catalogo/indexeddb.js";
import { obtenerSegmentosVentas } from "../config/usuariosVentas.js";

let reenvioActivo = false;

export async function obtenerVentasPendientes() {
  return obtenerVentasPendientesLocal();
}

export async function contarVentasPendientes() {
  return (await obtenerVentasPendientesLocal()).length;
}

export async function guardarVentaPendiente({ venta, rutaVenta, error }) {
  const folioUid = venta?.folio_local_uid || venta?.folio;
  if (!folioUid) throw new Error("Venta sin folio; no puede guardarse localmente.");
  await guardarVentaPendienteLocal({
    id_local: folioUid,
    venta: {
      ...venta,
      sincronizado: false,
      fecha_sincronizacion: null,
      error_sincronizacion: String(error?.message || error || "Pendiente"),
      fecha_error: new Date().toISOString()
    },
    rutaVenta,
    intentos: 0,
    ultimo_error: String(error?.message || error || "Pendiente"),
    fecha_pendiente: new Date().toISOString()
  });
  return true;
}

export async function eliminarVentaPendiente(idLocal) {
  await eliminarVentaPendienteLocal(idLocal);
  return (await obtenerVentasPendientesLocal()).length;
}

async function guardarPendienteEnFirestore(item) {
  const rutaVenta = item.rutaVenta || {};
  const venta = item.venta || {};
  const documentoId = venta.documento_id || venta.folio_local_uid || venta.folio;
  if (!rutaVenta.tienda || !rutaVenta.coleccion || !documentoId) {
    throw new Error("Venta pendiente incompleta: falta ruta o folio/documento.");
  }
  const ref = doc(db, ...obtenerSegmentosVentas(rutaVenta), documentoId);
  await setDoc(ref, {
    ...venta,
    fecha: serverTimestamp(),
    sincronizado: true,
    pendiente_sincronizar: false,
    fecha_sincronizacion: serverTimestamp(),
    error_sincronizacion: null,
    fecha_error: null
  }, { merge: true });
}

export async function reenviarVentasPendientes() {
  const cola = await obtenerVentasPendientesLocal();
  if (!cola.length || !navigator.onLine) {
    return { reenviadas: 0, pendientes: cola.length };
  }
  let reenviadas = 0;
  for (const item of cola) {
    try {
      await guardarPendienteEnFirestore(item);
      await eliminarVentaPendienteLocal(item.id_local);
      reenviadas++;
    } catch (err) {
      await guardarVentaPendienteLocal({
        ...item,
        intentos: Number(item.intentos || 0) + 1,
        ultimo_error: String(err?.message || err),
        fecha_error: new Date().toISOString()
      });
    }
  }
  return { reenviadas, pendientes: (await obtenerVentasPendientesLocal()).length };
}

export function activarReenvioVentasPendientes() {
  if (reenvioActivo) return;
  reenvioActivo = true;
  window.addEventListener("online", () => reenviarVentasPendientes());
  setTimeout(() => reenviarVentasPendientes(), 2500);
}

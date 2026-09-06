import { db } from "../firebase/config.js";
import {
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  carrito,
  calcularTotales
} from "../carrito/carrito.js";

import { getUsuarioLogueado } from "../auth/login.js";
import { obtenerRutaVentaPorUsuario, obtenerSegmentosVentas } from "../config/usuariosVentas.js";
import { guardarVentaEnEsperaFirestore } from "./guardarVenta.js";
import { toast } from "../ui/toast.js";
import { guardarDatoLocal, obtenerDatoLocal, eliminarDatoLocal } from "../catalogo/indexeddb.js";

const KEY_DRAFT = "POS_VENTA_ACTUAL_LOCAL";
const KEY_ULTIMO_HASH = "POS_VENTA_ACTUAL_LOCAL_HASH";
const INTERVALO_MS = 2000;

let intervaloActivo = null;
let procesandoInicio = false;

async function obtenerVentaRecuperadaActual() {
  return obtenerDatoLocal("ventaEnEsperaRecuperadaPOS", null);
}

async function crearSnapshotLocal() {
  if (!Array.isArray(carrito) || carrito.length === 0) return null;

  const usuario = getUsuarioLogueado();
  const tot = calcularTotales();
  const ventaRecuperada = await obtenerVentaRecuperadaActual();

  return {
    tipo_respaldo: "VENTA_ACTIVA_LOCAL",
    origen: "AUTO_GUARDADO_LOCAL",
    fecha_local_iso: new Date().toISOString(),
    usuario: {
      id: usuario?.id || null,
      nombre: usuario?.nombre || usuario?.usuario || null,
      usuario: usuario?.usuario || null
    },
    venta_recuperada: ventaRecuperada?.documento_id ? ventaRecuperada : null,
    cliente: "PÚBLICO EN GENERAL",
    cliente_info: {
      id: null,
      nombre: "PÚBLICO EN GENERAL",
      rfc: "XAXX010101000"
    },
    totales: {
      subtotal: tot.subtotal || 0,
      iva: tot.iva || 0,
      ieps: tot.ieps || 0,
      impuestos: tot.impuestos || 0,
      total: tot.total || 0,
      cantidad_articulos: tot.piezas || 0,
      cantidad_renglones: carrito.length
    },
    detalle: carrito.map(x => ({ ...x }))
  };
}

async function guardarSnapshotLocal() {
  const snapshot = await crearSnapshotLocal();

  if (!snapshot) {
    await limpiarVentaLocalInterrumpida();
    return;
  }

  const payload = JSON.stringify(snapshot);
  const hashAnterior = await obtenerDatoLocal(KEY_ULTIMO_HASH, null);

  if (hashAnterior === payload) return;

  await guardarDatoLocal(KEY_DRAFT, snapshot);
  await guardarDatoLocal(KEY_ULTIMO_HASH, payload);
}

export function iniciarRespaldoLocalVentaActual() {
  if (intervaloActivo) return;

  guardarSnapshotLocal();
  intervaloActivo = setInterval(guardarSnapshotLocal, INTERVALO_MS);

  window.addEventListener("beforeunload", () => {
    try {
      guardarSnapshotLocal();
    } catch (err) {
      console.warn("No se pudo guardar respaldo local al cerrar", err);
    }
  });
}

export async function limpiarVentaLocalInterrumpida() {
  await Promise.all([eliminarDatoLocal(KEY_DRAFT), eliminarDatoLocal(KEY_ULTIMO_HASH)]);
}

function construirVentaBaseAutomatica(snapshot) {
  const tot = snapshot?.totales || {};

  return {
    cliente: snapshot?.cliente || "PÚBLICO EN GENERAL",
    cliente_info: snapshot?.cliente_info || {
      id: null,
      nombre: "PÚBLICO EN GENERAL",
      rfc: "XAXX010101000"
    },

    subtotal: Number(tot.subtotal || 0),
    iva: Number(tot.iva || 0),
    ieps: Number(tot.ieps || 0),
    impuestos: Number(tot.impuestos || 0),
    total: Number(tot.total || 0),

    descuento_porcentaje: 0,
    descuento_monto: 0,
    costo_total: 0,
    utilidad_total: 0,
    margen_porcentaje: 0,
    comision_total: 0,

    cantidad_articulos: Number(tot.cantidad_articulos || 0),
    cantidad_renglones: Number(tot.cantidad_renglones || snapshot.detalle?.length || 0),

    recibido: 0,
    cambio: 0,
    detalle: Array.isArray(snapshot.detalle) ? snapshot.detalle.map(x => ({ ...x })) : [],

    requiere_autorizacion: false,
    motivo_espera: "Venta interrumpida por cierre, apagón o reinicio",
    motivo_espera_codigo: "INTERRUPCION_LOCAL",
    autorizado_por: "SISTEMA",
    autorizacion_espera: {
      autorizado: true,
      tipo_autorizacion: "AUTOMATICA_SISTEMA",
      autorizado_por_id: "SISTEMA",
      autorizado_por_nombre: "SISTEMA",
      autorizado_por_usuario: "SISTEMA",
      autorizado_por_rol: "SISTEMA",
      fecha_autorizacion_local_iso: new Date().toISOString(),
      motivo: "Venta interrumpida por cierre, apagón o reinicio",
      motivo_codigo: "INTERRUPCION_LOCAL",
      solicitado_por_id: snapshot?.usuario?.id || null,
      solicitado_por_nombre: snapshot?.usuario?.nombre || null,
      solicitado_por_usuario: snapshot?.usuario?.usuario || null
    },
    respaldo_local: {
      origen: snapshot?.origen || "AUTO_GUARDADO_LOCAL",
      fecha_respaldo_local_iso: snapshot?.fecha_local_iso || null,
      procesado_local_iso: new Date().toISOString()
    }
  };
}

async function regresarVentaRecuperadaOriginalAEspera(snapshot) {
  const ventaRecuperada = snapshot?.venta_recuperada;
  const documentoId = ventaRecuperada?.documento_id;

  if (!documentoId) return false;

  const usuario = getUsuarioLogueado();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);
  const ventaBase = construirVentaBaseAutomatica(snapshot);

  const ref = doc(
    db,
    ...obtenerSegmentosVentas(rutaVenta),
    documentoId
  );

  await updateDoc(ref, {
    estado_venta: "EN_ESPERA",
    status: "EN_ESPERA",
    tipo_movimiento: "VENTA_RECUPERADA_INTERRUPCION_LOCAL",
    cobrada: false,
    eliminada: false,
    cancelada: false,
    bloqueada_por_admin: false,
    requiere_revision_admin: false,
    requiere_autorizacion: false,

    motivo_espera: ventaBase.motivo_espera,
    motivo_espera_codigo: ventaBase.motivo_espera_codigo,
    autorizacion_espera: ventaBase.autorizacion_espera,
    respaldo_local: ventaBase.respaldo_local,

    fecha_regreso_espera: serverTimestamp(),
    fecha_regreso_espera_local_iso: new Date().toISOString(),
    fecha_sincronizacion: serverTimestamp(),
    sincronizado: true,

    cliente: ventaBase.cliente,
    cliente_info: ventaBase.cliente_info,
    recibido: 0,
    cambio: 0,
    resumen_financiero: {
      subtotal: ventaBase.subtotal,
      iva: ventaBase.iva,
      ieps: ventaBase.ieps,
      impuestos: ventaBase.impuestos,
      descuento: 0,
      total: ventaBase.total,
      costo_total: ventaBase.costo_total,
      utilidad_total: ventaBase.utilidad_total,
      margen_porcentaje: ventaBase.margen_porcentaje,
      comision_total: ventaBase.comision_total,
      cantidad_articulos: ventaBase.cantidad_articulos,
      cantidad_renglones: ventaBase.cantidad_renglones
    },
    detalle: ventaBase.detalle
  });

  return true;
}

export async function procesarVentaLocalInterrumpidaAlIniciar() {
  if (procesandoInicio) return;
  procesandoInicio = true;

  const snapshot = await obtenerDatoLocal(KEY_DRAFT, null);

  if (!snapshot || !Array.isArray(snapshot.detalle) || snapshot.detalle.length === 0) {
    await limpiarVentaLocalInterrumpida();
    procesandoInicio = false;
    return;
  }

  try {
    toast("Se detectó venta interrumpida. Enviando a ventas en espera...");

    if (snapshot?.venta_recuperada?.documento_id) {
      await regresarVentaRecuperadaOriginalAEspera(snapshot);
      await eliminarDatoLocal("ventaEnEsperaRecuperadaPOS");
    } else {
      const ventaBase = construirVentaBaseAutomatica(snapshot);
      await guardarVentaEnEsperaFirestore(ventaBase);
    }

    await limpiarVentaLocalInterrumpida();

    alert(
      "Se detectó una venta interrumpida por cierre/apagón/reinicio.\n\n" +
      "Ya fue enviada automáticamente a Ventas en Espera.\n" +
      "Recupérala desde Configuración > Operaciones de Venta > Recuperar Venta."
    );
  } catch (err) {
    console.error("No se pudo mandar la venta interrumpida a espera:", err);
    alert(
      "Se detectó una venta interrumpida, pero no se pudo mandar a Ventas en Espera.\n" +
      "Revisa la conexión y vuelve a abrir el POS."
    );
  } finally {
    procesandoInicio = false;
  }
}

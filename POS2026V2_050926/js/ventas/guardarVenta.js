import { db } from "../firebase/config.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getUsuarioLogueado,
  getRutaId
} from "../auth/login.js";

import {
  obtenerRutaVentaPorUsuario,
  obtenerSegmentosVentas
} from "../config/usuariosVentas.js";

import {
  guardarVentaPendiente,
  activarReenvioVentasPendientes,
  reenviarVentasPendientes,
  obtenerVentasPendientes,
  contarVentasPendientes,
  eliminarVentaPendiente
} from "../offline/ventasPendientes.js";
import { guardarDatoLocal, obtenerDatoLocal } from "../catalogo/indexeddb.js";

const VERSION_POS = "POSPDD26-2026.13";
activarReenvioVentasPendientes();

function obtenerDatosFolio() {
  const hoy = new Date();
  const fecha = hoy.toISOString().slice(0, 10).replace(/-/g, "");

  const usuario = getUsuarioLogueado();

  const usuarioTag = String(usuario?.usuario || usuario?.nombre || "POS")
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 10);

  const key = `folio_${usuarioTag}_${fecha}`;
  const contadorId = `${usuarioTag}_${fecha}`;

  return { fecha, usuarioTag, key, contadorId };
}

function obtenerRefContadorFolio(contadorId) {
  const usuario = getUsuarioLogueado();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

  return doc(
    db,
    "TIENDAS",
    rutaVenta.tienda,
    "FOLIOS_POS",
    contadorId
  );
}

export async function generarFolioVenta() {
  const { fecha, usuarioTag, key, contadorId } = obtenerDatosFolio();

  try {
    const ref = obtenerRefContadorFolio(contadorId);

    const nuevoConsecutivo = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);

      const ultimo = snap.exists()
        ? Number(snap.data()?.ultimo || 0)
        : 0;

      const siguiente = ultimo + 1;

      transaction.set(ref, {
        usuarioTag,
        fecha,
        ultimo: siguiente,
        actualizado: serverTimestamp()
      }, { merge: true });

      return siguiente;
    });

    await guardarDatoLocal(key, nuevoConsecutivo);

    return `${usuarioTag}-${fecha}-${String(nuevoConsecutivo).padStart(4, "0")}`;

  } catch (err) {
    console.warn("No se pudo generar folio desde Firestore. Usando IndexedDB:", err);

    const consecutivo = Number(await obtenerDatoLocal(key, 0)) + 1;
    await guardarDatoLocal(key, consecutivo);

    return `${usuarioTag}-${fecha}-${String(consecutivo).padStart(4, "0")}`;
  }
}

async function obtenerUltimoFolioDesdeVentas(rutaVenta, usuarioTag, fecha) {
  const ref = collection(
    db,
    ...obtenerSegmentosVentas(rutaVenta)
  );

  const q = query(
    ref,
    orderBy("fecha_local_iso", "desc"),
    limit(50)
  );

  const snap = await getDocs(q);

  let mayor = 0;
  const prefijo = `${usuarioTag}-${fecha}-`;

  snap.forEach(docSnap => {
    const data = docSnap.data();
    const folio = String(data?.folio || docSnap.id || "");

    if (!folio.startsWith(prefijo)) return;

    const match = folio.match(new RegExp(`^${prefijo}(\\d{4})`));
    if (!match) return;

    const consecutivo = Number(match[1] || 0);

    if (consecutivo > mayor) {
      mayor = consecutivo;
    }
  });

  return mayor;
}

export async function obtenerProximoFolioVenta() {
  const { fecha, usuarioTag, key, contadorId } = obtenerDatosFolio();

  try {
    const ref = obtenerRefContadorFolio(contadorId);
    const snap = await getDoc(ref);

    let ultimoFirebase = snap.exists()
      ? Number(snap.data()?.ultimo || 0)
      : 0;

    if (ultimoFirebase <= 0) {
      const usuario = getUsuarioLogueado();
      const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

      ultimoFirebase = await obtenerUltimoFolioDesdeVentas(
        rutaVenta,
        usuarioTag,
        fecha
      );

      if (ultimoFirebase > 0) {
        await setDoc(ref, {
          usuarioTag,
          fecha,
          ultimo: ultimoFirebase,
          reconstruido_desde_ventas: true,
          actualizado: serverTimestamp()
        }, { merge: true });
      }
    }

    await guardarDatoLocal(key, ultimoFirebase);

    const siguiente = ultimoFirebase + 1;

    return `${usuarioTag}-${fecha}-${String(siguiente).padStart(4, "0")}`;

  } catch (err) {
    console.warn("No se pudo leer próximo folio desde Firestore. Usando IndexedDB:", err);

    const ultimoLocal = Number(await obtenerDatoLocal(key, 0));
    const siguiente = ultimoLocal + 1;

    return `${usuarioTag}-${fecha}-${String(siguiente).padStart(4, "0")}`;
  }
}


export async function generarFolioVentaLocalRapido() {
  const { fecha, usuarioTag, key } = obtenerDatosFolio();
  const consecutivo = Number(await obtenerDatoLocal(key, 0)) + 1;
  await guardarDatoLocal(key, consecutivo);
  return `${usuarioTag}-${fecha}-${String(consecutivo).padStart(4, "0")}`;
}

export function generarFolioLocalUid(folio) {
  const hoy = new Date();

  const horaTag = hoy
    .toTimeString()
    .slice(0, 8)
    .replace(/:/g, "");

  const random = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  return `${folio}-${horaTag}-${random}`;
}

async function obtenerIdUnicoVenta(rutaVenta, folioLocalUid) {
  let idFinal = folioLocalUid;
  let intento = 0;

  while (true) {
    const ref = doc(
      db,
      ...obtenerSegmentosVentas(rutaVenta),
      idFinal
    );

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return idFinal;
    }

    intento++;
    idFinal = `${folioLocalUid}-DUP-${intento}`;
  }
}

async function guardarVentaDirectaFirestore(venta, rutaVenta) {
  const idDocumento = await obtenerIdUnicoVenta(
    rutaVenta,
    venta.folio_local_uid
  );

  const ref = doc(
    db,
    ...obtenerSegmentosVentas(rutaVenta),
    idDocumento
  );

  const ventaFirestore = {
    ...venta,
    documento_id: idDocumento,
    fecha: serverTimestamp(),
    sincronizado: true,
    fecha_sincronizacion: serverTimestamp(),
    error_sincronizacion: null,
    fecha_error: null
  };

  await setDoc(ref, ventaFirestore, { merge: false });

  return ventaFirestore;
}


function construirVentaCobrada(ventaBase, folio, folio_local_uid, rutaVenta, usuario, rutaIdLogin) {
  const hoy = new Date();

  return {
    folio,
    folio_local_uid,
    documento_id: folio_local_uid,

    fecha: null,
    fecha_local_iso: hoy.toISOString(),
    fecha_txt: hoy.toLocaleString("es-MX"),
    fecha_cobro_local_iso: hoy.toISOString(),

    estado_venta: "ACTIVA",
    status: "COBRADA",
    tipo_movimiento: "VENTA_COBRADA",
    cobrada: true,
    eliminada: false,
    cancelada: false,
    version_pos: VERSION_POS,

    usuarioId: usuario?.id || null,
    usuarioNombre: usuario?.nombre || usuario?.usuario || null,
    usuarioLogin: usuario?.usuario || null,

    autorizado_por: ventaBase.autorizado_por || null,

    rutaId: rutaVenta.tienda,
    sucursal: rutaVenta.tienda,

    rutaIdLogin: rutaIdLogin || null,
    venta_prueba: rutaVenta.esPrueba,

    cliente: ventaBase.cliente || "PÚBLICO EN GENERAL",
    cliente_info: ventaBase.cliente_info || {
      id: null,
      nombre: "PÚBLICO EN GENERAL",
      rfc: "XAXX010101000"
    },

    moneda: "MXN",
    tipoCambio: 1,
    cortado: false,

    recibido: ventaBase.recibido,
    cambio: ventaBase.cambio,
    metodo_pago: ventaBase.metodo_pago || "EFECTIVO_1",
    pagos: ventaBase.pagos || [],

    descuento_porcentaje: ventaBase.descuento_porcentaje || 0,
    descuento_monto: ventaBase.descuento_monto || 0,

    resumen_financiero: {
      subtotal: ventaBase.subtotal,
      iva: ventaBase.iva,
      ieps: ventaBase.ieps,
      impuestos: ventaBase.impuestos,
      descuento: ventaBase.descuento_monto || 0,
      total: ventaBase.total,
      costo_total: ventaBase.costo_total,
      utilidad_total: ventaBase.utilidad_total,
      margen_porcentaje: ventaBase.margen_porcentaje,
      comision_total: ventaBase.comision_total,
      cantidad_articulos: ventaBase.cantidad_articulos,
      cantidad_renglones: ventaBase.cantidad_renglones
    },

    detalle: ventaBase.detalle,

    bitacora_cancelaciones_partidas:
      ventaBase.bitacora_cancelaciones_partidas || [],

    bitacora_cambios_cantidad:
      ventaBase.bitacora_cambios_cantidad || [],

    sincronizado: false,
    pendiente_sincronizar: true,
    fecha_sincronizacion: null,
    error_sincronizacion: null,
    fecha_error: null
  };
}

export async function prepararVentaCobradaLocal(ventaBase) {
  const usuario = getUsuarioLogueado();
  const rutaIdLogin = getRutaId();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);
  const folio = await generarFolioVentaLocalRapido();
  const folio_local_uid = generarFolioLocalUid(folio);
  const venta = construirVentaCobrada(ventaBase, folio, folio_local_uid, rutaVenta, usuario, rutaIdLogin);

  await guardarVentaPendiente({
    venta,
    rutaVenta,
    error: "Pendiente de sincronización en segundo plano"
  });

  return { venta, rutaVenta };
}

export async function prepararVentaRecuperadaCobradaLocal(documentoId, ventaBase, ventaRecuperada = {}) {
  const usuario = getUsuarioLogueado();
  const rutaIdLogin = getRutaId();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);
  const folio = ventaRecuperada.folio || documentoId;
  const folioLocalUid = ventaRecuperada.folio_local_uid || documentoId;
  const venta = construirVentaCobrada(ventaBase, folio, folioLocalUid, rutaVenta, usuario, rutaIdLogin);

  venta.documento_id = documentoId;
  venta.id = documentoId;
  venta.folio = folio;
  venta.folio_local_uid = folioLocalUid;
  venta.tipo_movimiento = "VENTA_RECUPERADA_COBRADA";
  venta.recuperada_de_espera = true;

  await guardarVentaPendiente({
    venta,
    rutaVenta,
    error: "Venta recuperada pendiente de sincronización en segundo plano"
  });

  return { venta, rutaVenta };
}

export function sincronizarVentaCobradaSegundoPlano(venta, rutaVenta) {
  setTimeout(async () => {
    try {
      await guardarVentaDirectaFirestore(venta, rutaVenta);
      await eliminarVentaPendiente(venta.folio_local_uid || venta.folio);
      console.log("✅ Venta sincronizada en segundo plano:", venta.folio_local_uid || venta.folio);
    } catch (err) {
      console.warn("⚠️ Venta queda en cola offline:", venta.folio_local_uid || venta.folio, err);
    }
  }, 0);
}

export function sincronizarVentaRecuperadaSegundoPlano(documentoId, ventaBase, ventaLocal) {
  setTimeout(async () => {
    try {
      await cobrarVentaRecuperadaEnEsperaFirestore(documentoId, ventaBase);
      await eliminarVentaPendiente(ventaLocal.folio_local_uid || documentoId);
      console.log("✅ Venta recuperada sincronizada en segundo plano:", documentoId);
    } catch (err) {
      console.warn("⚠️ Venta recuperada queda en cola offline:", documentoId, err);
    }
  }, 0);
}

export async function guardarVentaFirestore(ventaBase) {
  const usuario = getUsuarioLogueado();
  const rutaIdLogin = getRutaId();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

  const folio = await generarFolioVenta();
  const folio_local_uid = generarFolioLocalUid(folio);

  const hoy = new Date();

  const venta = {
    folio,
    folio_local_uid,
    documento_id: null,

    fecha: null,
    fecha_local_iso: hoy.toISOString(),
    fecha_txt: hoy.toLocaleString("es-MX"),

    estado_venta: "ACTIVA",
    version_pos: VERSION_POS,

    usuarioId: usuario?.id || null,
    usuarioNombre: usuario?.nombre || usuario?.usuario || null,
    usuarioLogin: usuario?.usuario || null,

    autorizado_por: ventaBase.autorizado_por || null,

    rutaId: rutaVenta.tienda,
    sucursal: rutaVenta.tienda,

    rutaIdLogin: rutaIdLogin || null,
    venta_prueba: rutaVenta.esPrueba,

    cliente: ventaBase.cliente || "PÚBLICO EN GENERAL",
    cliente_info: ventaBase.cliente_info || {
      id: null,
      nombre: "PÚBLICO EN GENERAL",
      rfc: "XAXX010101000"
    },

    moneda: "MXN",
    tipoCambio: 1,

    cortado: false,

    recibido: ventaBase.recibido,
    cambio: ventaBase.cambio,
    metodo_pago: ventaBase.metodo_pago || "EFECTIVO_1",
    pagos: ventaBase.pagos || [],

    descuento_porcentaje: ventaBase.descuento_porcentaje || 0,
    descuento_monto: ventaBase.descuento_monto || 0,

    resumen_financiero: {
      subtotal: ventaBase.subtotal,
      iva: ventaBase.iva,
      ieps: ventaBase.ieps,
      impuestos: ventaBase.impuestos,
      descuento: ventaBase.descuento_monto || 0,
      total: ventaBase.total,

      costo_total: ventaBase.costo_total,
      utilidad_total: ventaBase.utilidad_total,
      margen_porcentaje: ventaBase.margen_porcentaje,
      comision_total: ventaBase.comision_total,

      cantidad_articulos: ventaBase.cantidad_articulos,
      cantidad_renglones: ventaBase.cantidad_renglones
    },

detalle: ventaBase.detalle,

bitacora_cancelaciones_partidas:
  ventaBase.bitacora_cancelaciones_partidas || [],

bitacora_cambios_cantidad:
  ventaBase.bitacora_cambios_cantidad || [],

sincronizado: false,
fecha_sincronizacion: null,
error_sincronizacion: null,
fecha_error: null
  };

  try {
    const ventaGuardada = await guardarVentaDirectaFirestore(venta, rutaVenta);

    return {
      ...ventaGuardada,
      pendiente_offline: false
    };

  } catch (err) {
    console.error("❌ No se pudo guardar en Firestore. Se manda a cola offline:", err);

    await guardarVentaPendiente({
      venta,
      rutaVenta,
      error: err
    });

    return {
      ...venta,
      sincronizado: false,
      pendiente_offline: true,
      error_sincronizacion: String(err?.message || err),
      fecha_error: new Date().toISOString()
    };
  }
}


export async function cobrarVentaRecuperadaEnEsperaFirestore(documentoId, ventaBase) {
  if (!documentoId) {
    throw new Error("Falta documentoId de venta en espera recuperada");
  }

  const usuario = getUsuarioLogueado();
  const rutaIdLogin = getRutaId();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);
  const hoy = new Date();

  const ref = doc(
    db,
    ...obtenerSegmentosVentas(rutaVenta),
    documentoId
  );

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error(`No existe la venta en espera recuperada: ${documentoId}`);
  }

  const ventaAnterior = snap.data() || {};

  const historialAnterior = Array.isArray(ventaAnterior.historial_estados)
    ? ventaAnterior.historial_estados
    : [];

  const updateData = {
    estado_venta: "ACTIVA",
    status: "COBRADA",
    tipo_movimiento: "VENTA_RECUPERADA_COBRADA",
    cobrada: true,
    eliminada: false,
    cancelada: false,
    bloqueada_por_admin: false,
    requiere_revision_admin: false,

    fecha_cobro: serverTimestamp(),
    fecha_cobro_local_iso: hoy.toISOString(),
    fecha_sincronizacion: serverTimestamp(),
    sincronizado: true,
    error_sincronizacion: null,
    fecha_error: null,

    usuario_cobro_id: usuario?.id || null,
    usuario_cobro_nombre: usuario?.nombre || usuario?.usuario || null,
    usuario_cobro_login: usuario?.usuario || null,

    usuarioId: usuario?.id || ventaAnterior.usuarioId || null,
    usuarioNombre: usuario?.nombre || usuario?.usuario || ventaAnterior.usuarioNombre || null,
    usuarioLogin: usuario?.usuario || ventaAnterior.usuarioLogin || null,

    rutaId: rutaVenta.tienda,
    sucursal: rutaVenta.tienda,
    rutaIdLogin: rutaIdLogin || ventaAnterior.rutaIdLogin || null,
    venta_prueba: rutaVenta.esPrueba,

    cliente: ventaBase.cliente || ventaAnterior.cliente || "PÚBLICO EN GENERAL",
    cliente_info: ventaBase.cliente_info || ventaAnterior.cliente_info || {
      id: null,
      nombre: "PÚBLICO EN GENERAL",
      rfc: "XAXX010101000"
    },

    moneda: "MXN",
    tipoCambio: 1,
    cortado: false,

    recibido: ventaBase.recibido,
    cambio: ventaBase.cambio,
    metodo_pago: ventaBase.metodo_pago || "EFECTIVO_1",
    pagos: ventaBase.pagos || [],

    descuento_porcentaje: ventaBase.descuento_porcentaje || 0,
    descuento_monto: ventaBase.descuento_monto || 0,

    autorizado_por: ventaBase.autorizado_por || ventaAnterior.autorizado_por || null,

    resumen_financiero: {
      subtotal: ventaBase.subtotal,
      iva: ventaBase.iva,
      ieps: ventaBase.ieps,
      impuestos: ventaBase.impuestos,
      descuento: ventaBase.descuento_monto || 0,
      total: ventaBase.total,
      costo_total: ventaBase.costo_total,
      utilidad_total: ventaBase.utilidad_total,
      margen_porcentaje: ventaBase.margen_porcentaje,
      comision_total: ventaBase.comision_total,
      cantidad_articulos: ventaBase.cantidad_articulos,
      cantidad_renglones: ventaBase.cantidad_renglones
    },

    detalle: ventaBase.detalle,

    bitacora_cancelaciones_partidas:
      ventaBase.bitacora_cancelaciones_partidas || [],

    bitacora_cambios_cantidad:
      ventaBase.bitacora_cambios_cantidad || [],

    historial_estados: [
      ...historialAnterior,
      {
        estado: "COBRADA_DESDE_ESPERA",
        fecha_local_iso: hoy.toISOString(),
        usuario: usuario?.nombre || usuario?.usuario || null,
        recibido: ventaBase.recibido,
        cambio: ventaBase.cambio
      }
    ]
  };

  await updateDoc(ref, updateData);

  return {
    ...ventaAnterior,
    ...updateData,
    documento_id: documentoId,
    id: documentoId,
    folio: ventaAnterior.folio || documentoId,
    folio_local_uid: ventaAnterior.folio_local_uid || documentoId,
    pendiente_offline: false
  };
}


export async function guardarVentaEnEsperaFirestore(ventaBase) {
  const usuario = getUsuarioLogueado();
  const rutaIdLogin = getRutaId();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

  const folio = await generarFolioVenta();
  const folio_local_uid = generarFolioLocalUid(folio);
  const hoy = new Date();

  const venta = {
    folio,
    folio_local_uid,
    documento_id: null,

    fecha: null,
    fecha_local_iso: hoy.toISOString(),
    fecha_txt: hoy.toLocaleString("es-MX"),

    estado_venta: "EN_ESPERA",
    status: "EN_ESPERA",
    tipo_movimiento: "VENTA_EN_ESPERA",
    cobrada: false,
    eliminada: false,
    cancelada: false,
    bloqueada_por_admin: false,
    requiere_revision_admin: false,
    requiere_autorizacion: ventaBase.requiere_autorizacion !== false,

    motivo_espera: ventaBase.motivo_espera || "VENTA EN ESPERA",
    motivo_espera_codigo: ventaBase.motivo_espera_codigo || null,
    autorizacion_espera: ventaBase.autorizacion_espera || null,
    respaldo_local: ventaBase.respaldo_local || null,
    historial_estados: [
      {
        estado: "EN_ESPERA",
        fecha_local_iso: hoy.toISOString(),
        usuario: usuario?.nombre || usuario?.usuario || null,
        autorizado_por: ventaBase.autorizado_por || null,
        motivo: ventaBase.motivo_espera || "VENTA EN ESPERA",
        motivo_codigo: ventaBase.motivo_espera_codigo || null
      }
    ],

    version_pos: VERSION_POS,

    usuarioId: usuario?.id || null,
    usuarioNombre: usuario?.nombre || usuario?.usuario || null,
    usuarioLogin: usuario?.usuario || null,
    autorizado_por: ventaBase.autorizado_por || null,

    rutaId: rutaVenta.tienda,
    sucursal: rutaVenta.tienda,
    rutaIdLogin: rutaIdLogin || null,
    venta_prueba: rutaVenta.esPrueba,

    cliente: ventaBase.cliente || "PÚBLICO EN GENERAL",
    cliente_info: ventaBase.cliente_info || {
      id: null,
      nombre: "PÚBLICO EN GENERAL",
      rfc: "XAXX010101000"
    },

    moneda: "MXN",
    tipoCambio: 1,

    cortado: false,
    recibido: 0,
    cambio: 0,

    descuento_porcentaje: ventaBase.descuento_porcentaje || 0,
    descuento_monto: ventaBase.descuento_monto || 0,

    resumen_financiero: {
      subtotal: ventaBase.subtotal || 0,
      iva: ventaBase.iva || 0,
      ieps: ventaBase.ieps || 0,
      impuestos: ventaBase.impuestos || 0,
      descuento: ventaBase.descuento_monto || 0,
      total: ventaBase.total || 0,
      costo_total: ventaBase.costo_total || 0,
      utilidad_total: ventaBase.utilidad_total || 0,
      margen_porcentaje: ventaBase.margen_porcentaje || 0,
      comision_total: ventaBase.comision_total || 0,
      cantidad_articulos: ventaBase.cantidad_articulos || 0,
      cantidad_renglones: ventaBase.cantidad_renglones || 0
    },

    detalle: ventaBase.detalle || [],

    bitacora_cancelaciones_partidas:
      ventaBase.bitacora_cancelaciones_partidas || [],

    bitacora_cambios_cantidad:
      ventaBase.bitacora_cambios_cantidad || [],

    sincronizado: false,
    fecha_sincronizacion: null,
    error_sincronizacion: null,
    fecha_error: null
  };

  try {
    const ventaGuardada = await guardarVentaDirectaFirestore(venta, rutaVenta);

    return {
      ...ventaGuardada,
      pendiente_offline: false
    };
  } catch (err) {
    console.error("❌ No se pudo guardar venta en espera. Se manda a cola offline:", err);

    await guardarVentaPendiente({
      venta,
      rutaVenta,
      error: err
    });

    return {
      ...venta,
      sincronizado: false,
      pendiente_offline: true,
      error_sincronizacion: String(err?.message || err),
      fecha_error: new Date().toISOString()
    };
  }
}

export async function cancelarVentaFirestore(documentoId, motivo = "", motivoCodigo = null) {
  const usuario = getUsuarioLogueado();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

  const ref = doc(
    db,
    ...obtenerSegmentosVentas(rutaVenta),
    documentoId
  );

  await updateDoc(ref, {
    estado_venta: "CANCELADA",
    cancelada: true,
    motivo_cancelacion: motivo || "Cancelación manual POS",
    motivo_cancelacion_codigo: motivoCodigo,
    cancelada_por: usuario?.nombre || usuario?.usuario || "SIN USUARIO",
    fecha_cancelacion: serverTimestamp()
  });

  return true;
}

export async function guardarVentaCanceladaCaptura(motivo, carritoSnapshot = [], motivoCodigo = null) {
  const usuario = getUsuarioLogueado();
  const rutaIdLogin = getRutaId();
  const rutaVenta = obtenerRutaVentaPorUsuario(usuario);

  const folio = await generarFolioVenta();
  const folio_local_uid = generarFolioLocalUid(folio);

  const hoy = new Date();

  const detalle = carritoSnapshot.map(x => ({
    id: x.id || null,
    codigo: x.codigo || x.codigoBarra || null,
    nombre: x.nombre || x.concepto || "",
    cantidad: Number(x.cantidad || 0),
    precio_unit: Number(x.precioUnit || 0),
    importe: Number(x.importe || 0),
    departamento_id: x.departamento_id || null,
    departamento_nombre: x.departamento || null
  }));

  const total = detalle.reduce((sum, x) => {
    return sum + Number(x.importe || 0);
  }, 0);

  const cantidad_articulos = detalle.reduce((sum, x) => {
    return sum + Number(x.cantidad || 0);
  }, 0);

  const venta = {
    folio,
    folio_local_uid,
    documento_id: null,

    fecha: null,
    fecha_local_iso: hoy.toISOString(),
    fecha_txt: hoy.toLocaleString("es-MX"),

    estado_venta: "CANCELADA",
    cancelada: true,
    tipo_movimiento: "CANCELACION_CAPTURA",
    motivo_cancelacion: motivo || "Cancelación de captura POS",
    motivo_cancelacion_codigo: motivoCodigo,
    fecha_cancelacion_local_iso: hoy.toISOString(),

    version_pos: VERSION_POS,

    usuarioId: usuario?.id || null,
    usuarioNombre: usuario?.nombre || usuario?.usuario || null,
    usuarioLogin: usuario?.usuario || null,

    cancelada_por: usuario?.nombre || usuario?.usuario || "SIN USUARIO",

    rutaId: rutaVenta.tienda,
    sucursal: rutaVenta.tienda,
    rutaIdLogin: rutaIdLogin || null,
    venta_prueba: rutaVenta.esPrueba,

    cliente: "PÚBLICO EN GENERAL",
    cliente_info: {
      id: null,
      nombre: "PÚBLICO EN GENERAL",
      rfc: "XAXX010101000"
    },

    moneda: "MXN",
    tipoCambio: 1,

    cortado: false,

    recibido: 0,
    cambio: 0,

    descuento_porcentaje: 0,
    descuento_monto: 0,

    resumen_financiero: {
      subtotal: 0,
      iva: 0,
      ieps: 0,
      impuestos: 0,
      descuento: 0,
      total: +total.toFixed(2),

      costo_total: 0,
      utilidad_total: 0,
      margen_porcentaje: 0,
      comision_total: 0,

      cantidad_articulos,
      cantidad_renglones: detalle.length
    },

    detalle,

    sincronizado: false,
    fecha_sincronizacion: null,
    error_sincronizacion: null,
    fecha_error: null
  };

  const ventaGuardada = await guardarVentaDirectaFirestore(venta, rutaVenta);

  return {
    ...ventaGuardada,
    pendiente_offline: false
  };
}

export {
  reenviarVentasPendientes,
  obtenerVentasPendientes,
  contarVentasPendientes
};

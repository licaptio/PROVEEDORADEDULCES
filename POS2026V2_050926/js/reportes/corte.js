import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../firebase/config.js";
import { getUsuarioLogueado } from "../auth/login.js";
import { money } from "../util/money.js";
import { imprimirTextoConfigurado } from "../ticket/impresionUniversal.js";
import { obtenerRutaVentaPorUsuario, obtenerSegmentosVentas } from "../config/usuariosVentas.js";

let TIENDA_CORTE = "RUTA1";
let COLECCION_VENTAS = "VENTASV20261";
let RUTA_VENTA_CORTE = null;

let ventasPendientesCorte = [];
let resumenPrevioActual = null;
let corteProcesando = false;
let ventasEnEsperaPendientesCorte = [];

export function iniciarCorteOperativo() {
  const btn = document.getElementById("btnCorteOperativo");
  if (!btn) {
    console.warn("No existe #btnCorteOperativo");
    return;
  }

  btn.addEventListener("click", async (event) => {
    event.stopPropagation();

    const panel = document.getElementById("panelConfig");
    if (panel) panel.classList.add("oculto");

    await abrirCorteOperativo();
  });
}

async function abrirCorteOperativo() {
  const contexto = obtenerRutaVentaPorUsuario(getUsuarioLogueado());
  RUTA_VENTA_CORTE = contexto;
  TIENDA_CORTE = contexto.tienda;
  COLECCION_VENTAS = contexto.coleccion;
  asegurarVistaCorte();

  const posContainer = document.querySelector(".pos-container");
  const vista = document.getElementById("vistaCorteOperativo");

  if (posContainer) posContainer.style.display = "none";
  if (vista) vista.classList.remove("oculto");

  await cargarResumenPrevioCorte();
}

function regresarAlPOS() {
  const posContainer = document.querySelector(".pos-container");
  const vista = document.getElementById("vistaCorteOperativo");

  if (vista) vista.classList.add("oculto");
  if (posContainer) posContainer.style.display = "";
}

function asegurarVistaCorte() {
  if (document.getElementById("vistaCorteOperativo")) return;

  const vista = document.createElement("section");
  vista.id = "vistaCorteOperativo";
  vista.className = "corte-operativo-view oculto";

  vista.innerHTML = `
    <div class="corte-header">
      <div>
        <h2>📊 Corte Operativo</h2>
        <small>PROVEEDORA DE DULCES Y DESECHABLES</small>
      </div>
      <button id="btnRegresarCorte" class="corte-btn gris" type="button">
        Regresar al POS
      </button>
    </div>

    <div id="corteResumenPrevio" class="corte-grid"></div>

    <div class="corte-actions">
      <button id="btnGenerarCorteOperativo" class="corte-btn rojo" type="button">
        GENERAR CORTE
      </button>
      <button id="btnRefrescarCorte" class="corte-btn gris" type="button">
        Actualizar
      </button>
    </div>

    <div id="corteResultado"></div>
  `;

 const posApp = document.getElementById("posApp");
(posApp || document.body).appendChild(vista);

  document.getElementById("btnRegresarCorte")
    .addEventListener("click", regresarAlPOS);

  document.getElementById("btnRefrescarCorte")
    .addEventListener("click", cargarResumenPrevioCorte);

  document.getElementById("btnGenerarCorteOperativo")
    .addEventListener("click", confirmarYGenerarCorte);

  asegurarOverlayCorte();
}

function asegurarOverlayCorte() {
  if (document.getElementById("overlayCorteOperativo")) return;

  const overlay = document.createElement("div");
  overlay.id = "overlayCorteOperativo";
  overlay.className = "corte-status";
  overlay.innerHTML = `
    <div class="corte-spinner"></div>
    <div id="overlayCorteTexto">Procesando corte...</div>
  `;

  document.body.appendChild(overlay);
}

function setOverlayCorte(visible, texto = "Procesando corte...") {
  const overlay = document.getElementById("overlayCorteOperativo");
  const txt = document.getElementById("overlayCorteTexto");

  if (txt) txt.textContent = texto;
  if (overlay) overlay.classList.toggle("visible", !!visible);
}

async function cargarResumenPrevioCorte() {
  const cont = document.getElementById("corteResumenPrevio");
  const resultado = document.getElementById("corteResultado");

  if (resultado) resultado.innerHTML = "";

  if (cont) {
    cont.innerHTML = `
      <div class="corte-card">
        <div class="lbl">Estado</div>
        <div class="val">Cargando...</div>
      </div>
    `;
  }

  const usuario = getUsuarioLogueado();

  console.log("📊 Usuario corte:", usuario);
  console.log("📊 Ruta ventas corte:", obtenerSegmentosVentas(RUTA_VENTA_CORTE).join("/"));

  const ref = collection(
    db,
    ...obtenerSegmentosVentas(RUTA_VENTA_CORTE)
  );

  const qv = query(
    ref,
    where("cortado", "==", false),
    where("estado_venta", "==", "ACTIVA"),
    where("usuarioLogin", "==", usuario?.usuario || "")
  );

  const snap = await getDocs(qv);

  console.log("📊 Tickets encontrados para corte:", snap.size);

  ventasPendientesCorte = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  console.log("📊 Ventas cargadas:", ventasPendientesCorte);

  ventasEnEsperaPendientesCorte = await buscarVentasEnEsperaPendientesCorte();
  console.log("⏳ Ventas en espera pendientes:", ventasEnEsperaPendientesCorte);

  resumenPrevioActual = calcularResumenCorte(ventasPendientesCorte);

  pintarResumenPrevio(resumenPrevioActual);
}

async function buscarVentasEnEsperaPendientesCorte() {
  const usuario = getUsuarioLogueado();
  const ref = collection(
    db,
    ...obtenerSegmentosVentas(RUTA_VENTA_CORTE)
  );

  const estadosPendientes = [
    "EN_ESPERA",
    "EN_REVISION_ADMIN",
    "REGRESADA_A_CAJA"
  ];

  const resultados = [];

  for (const estado of estadosPendientes) {
    const qv = query(
      ref,
      where("estado_venta", "==", estado),
      where("cortado", "==", false),
      where("usuarioLogin", "==", usuario?.usuario || "")
    );

    const snap = await getDocs(qv);

    snap.forEach(d => {
      const v = d.data();
      if (v.cobrada === true) return;
      if (v.eliminada === true) return;
      if (v.cancelada === true) return;

      resultados.push({
        id: d.id,
        ...v
      });
    });
  }

  return resultados;
}

function validarVentasEnEsperaAntesDeCorte() {
  if (!ventasEnEsperaPendientesCorte.length) return true;

  const lista = ventasEnEsperaPendientesCorte
    .slice(0, 10)
    .map(v => {
      const total = v.resumen_financiero?.total || v.total || 0;
      return `• ${v.folio || v.id} | ${v.estado_venta} | ${money(total)}`;
    })
    .join("\n");

  alert(
    "No puedes realizar el corte.\n\n" +
    "Tienes ventas en espera/revisión pendientes.\n" +
    "Cobra, elimina o cancela esas ventas antes de cerrar turno.\n\n" +
    lista
  );

  return false;
}

function calcularResumenCorte(ventas) {
  const porDepto = {};
  const porArticulo = {};

  let totalVentas = 0;
  let totalImpuestos = 0;
  let totalDescuento = 0;
  let totalCosto = 0;
  let totalUtilidad = 0;
  let totalArticulos = 0;
  const porFormaPago = { EFECTIVO_1: 0, EFECTIVO_2: 0, TARJETA: 0, TRANSFERENCIA: 0 };

  for (const v of ventas) {
    const rf = v.resumen_financiero || {};

    totalVentas += Number(rf.total || v.total || 0);
    totalImpuestos += Number(rf.impuestos || v.impuestos || 0);
    totalDescuento += Number(rf.descuento || v.descuento_monto || 0);
    totalCosto += Number(rf.costo_total || v.costo_total || 0);
    totalUtilidad += Number(rf.utilidad_total || v.utilidad_total || 0);

    const pagos = Array.isArray(v.pagos) && v.pagos.length
      ? v.pagos
      : [{ tipo: "EFECTIVO_1", importe: Number(rf.total || v.total || 0) }];
    pagos.forEach(p => {
      const tipo = String(p.tipo || "EFECTIVO_1").toUpperCase();
      porFormaPago[tipo] = Number(porFormaPago[tipo] || 0) + Number(p.importe || 0);
    });
    let cambio = Number(v.cambio || 0);
    if (cambio > 0) {
      const descuenta1 = Math.min(cambio, porFormaPago.EFECTIVO_1);
      porFormaPago.EFECTIVO_1 -= descuenta1;
      cambio -= descuenta1;
      porFormaPago.EFECTIVO_2 = Math.max(0, porFormaPago.EFECTIVO_2 - cambio);
    }

    for (const d of (v.detalle || [])) {
      const cantidad = Number(d.cantidad || 0);
      const importe = Number(d.importe || 0);
      const iva = Number(d.iva_calculado || 0);
      const ieps = Number(d.ieps_calculado || 0);
      const impuestos = iva + ieps;
      const ventaSinImp = importe - impuestos;

      const costo = Number(
        d.costo_total_linea ||
        d.costo_total ||
        (Number(d.costo_unit || 0) * cantidad) ||
        0
      );

      const utilidad = Number(
        d.utilidad_linea ||
        (ventaSinImp - costo)
      );

      totalArticulos += cantidad;

      const dep = String(
        d.departamento_info?.nombre ||
        d.departamento ||
        d.departamento_nombre ||
        "SIN DEPTO"
      ).toUpperCase();

      if (!porDepto[dep]) {
        porDepto[dep] = {
          venta: 0,
          impuestos: 0,
          total: 0,
          costo: 0,
          utilidad: 0
        };
      }

      porDepto[dep].venta += ventaSinImp;
      porDepto[dep].impuestos += impuestos;
      porDepto[dep].total += importe;
      porDepto[dep].costo += costo;
      porDepto[dep].utilidad += utilidad;

      const codigo = String(d.codigo || d.id || "").trim();
      const nombre = String(d.nombre || "SIN NOMBRE").toUpperCase();
      const key = codigo ? `${codigo}__${nombre}` : nombre;

      if (!porArticulo[key]) {
        porArticulo[key] = {
          codigo,
          nombre,
          cantidad: 0,
          importe: 0
        };
      }

      porArticulo[key].cantidad += cantidad;
      porArticulo[key].importe += importe;
    }
  }

  const top10 = Object.values(porArticulo)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  const ventaSinImpuestos = totalVentas - totalImpuestos;

  const margen = ventaSinImpuestos > 0
    ? (totalUtilidad / ventaSinImpuestos) * 100
    : 0;

  return {
    tickets: ventas.length,
    totalVentas,
    totalImpuestos,
    totalDescuento,
    totalEfectivoEntregar: porFormaPago.EFECTIVO_1 + porFormaPago.EFECTIVO_2,
    porFormaPago,
    totalCosto,
    totalUtilidad,
    totalArticulos,
    margen,
    porDepto,
    top10
  };
}

function pintarResumenPrevio(r) {
  const usuario = getUsuarioLogueado();
  const cont = document.getElementById("corteResumenPrevio");
  if (!cont) return;

  cont.className = "corte-panel-admin";

  cont.innerHTML = `
    <div class="corte-admin-box">
      <div class="corte-admin-title">Resumen pendiente de corte</div>

      <table class="corte-admin-table">
        <tbody>
          <tr>
            <td>Usuario</td>
            <td>${usuario?.nombre || usuario?.usuario || "—"}</td>
          </tr>
          <tr>
            <td>Sucursal</td>
            <td>${TIENDA_CORTE}</td>
          </tr>
          <tr>
            <td>Tickets pendientes</td>
            <td>${r.tickets}</td>
          </tr>
          <tr>
            <td>Ventas en espera/revisión</td>
            <td>${ventasEnEsperaPendientesCorte.length}</td>
          </tr>
          <tr class="total">
            <td>Total pendiente</td>
            <td>${money(r.totalVentas)}</td>
          </tr>
          <tr class="total">
            <td>Efectivo a entregar</td>
            <td>${money(r.totalEfectivoEntregar)}</td>
          </tr>
          <tr><td>Efectivo 1</td><td>${money(r.porFormaPago?.EFECTIVO_1 || 0)}</td></tr>
          <tr><td>Efectivo 2</td><td>${money(r.porFormaPago?.EFECTIVO_2 || 0)}</td></tr>
          <tr><td>Tarjeta</td><td>${money(r.porFormaPago?.TARJETA || 0)}</td></tr>
          <tr><td>Transferencia</td><td>${money(r.porFormaPago?.TRANSFERENCIA || 0)}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function cardCorte(label, value, extra = "") {
  return `
    <div class="corte-card ${extra}">
      <div class="lbl">${label}</div>
      <div class="val">${value}</div>
    </div>
  `;
}

async function confirmarYGenerarCorte() {
  if (corteProcesando) return;

  ventasEnEsperaPendientesCorte = await buscarVentasEnEsperaPendientesCorte();
  if (!validarVentasEnEsperaAntesDeCorte()) return;

  if (!ventasPendientesCorte.length) {
    alert("No hay tickets pendientes de corte.");
    return;
  }

  const total = money(resumenPrevioActual?.totalVentas || 0);
  const tickets = resumenPrevioActual?.tickets || 0;

  if (!confirm(`¿Seguro que deseas generar el corte?\n\nTickets: ${tickets}\nTotal: ${total}`)) return;

  if (!confirm("Esta acción NO se puede deshacer.\n\nLos tickets quedarán marcados como cortados.")) return;

  if (!confirm(`Última confirmación.\n\nSe cerrarán ${tickets} tickets por ${total}.`)) return;

  await generarCorteOperativo();
}

async function generarCorteOperativo() {
  corteProcesando = true;

  const btn = document.getElementById("btnGenerarCorteOperativo");
  if (btn) btn.disabled = true;

  setOverlayCorte(true, "Generando corte operativo...");

  try {
    const usuario = getUsuarioLogueado();
    const r = calcularResumenCorte(ventasPendientesCorte);

    const corte = {
      tipo: "CORTE_OPERATIVO_POSPDD26",
      estado: "CERRADO",

      sucursal: TIENDA_CORTE,
      coleccion_ventas: COLECCION_VENTAS,

      usuarioId: usuario?.id || null,
      usuarioLogin: usuario?.usuario || null,
      usuarioNombre: usuario?.nombre || usuario?.usuario || null,
      rutaIdLogin: usuario?.rutaId || usuario?.ruta_id || null,

      fecha_local_iso: new Date().toISOString(),
      creado_en: serverTimestamp(),

      tickets: r.tickets,
      totalVentas: +r.totalVentas.toFixed(2),
      totalImpuestos: +r.totalImpuestos.toFixed(2),
      totalDescuento: +r.totalDescuento.toFixed(2),
      totalEfectivoEntregar: +r.totalEfectivoEntregar.toFixed(2),
      totalCosto: +r.totalCosto.toFixed(2),
      totalUtilidad: +r.totalUtilidad.toFixed(2),
      totalArticulos: +r.totalArticulos.toFixed(3),
      margen: +r.margen.toFixed(2),
      porFormaPago: Object.fromEntries(
        Object.entries(r.porFormaPago).map(([k, v]) => [k, +Number(v || 0).toFixed(2)])
      ),

      porDepto: redondearObjetoDeptos(r.porDepto),

      top10: r.top10.map(a => ({
        codigo: a.codigo || "",
        nombre: a.nombre,
        cantidad: +Number(a.cantidad || 0).toFixed(3),
        importe: +Number(a.importe || 0).toFixed(2)
      })),

      ventas_ids: ventasPendientesCorte.map(v => v.id)
    };

    setOverlayCorte(true, "Guardando corte...");

    const corteRef = await addDoc(
      collection(db, "TIENDAS", TIENDA_CORTE, "CORTES_POS"),
      corte
    );

    setOverlayCorte(true, "Marcando tickets como cortados...");

    await marcarVentasCortadas(ventasPendientesCorte, corteRef.id);

    corte.corte_id = corteRef.id;

    pintarResultadoCorte(corte);
    imprimirCorteOperativo(corte);

    ventasPendientesCorte = [];
    resumenPrevioActual = calcularResumenCorte([]);
    pintarResumenPrevio(resumenPrevioActual);

    alert("Corte generado correctamente.");
  } catch (err) {
    console.error("Error generando corte:", err);
    alert("Error al generar el corte. Revisa consola.");
  } finally {
    setOverlayCorte(false);
    corteProcesando = false;
    if (btn) btn.disabled = false;
  }
}

function redondearObjetoDeptos(porDepto) {
  const out = {};

  for (const [dep, d] of Object.entries(porDepto || {})) {
    out[dep] = {
      venta: +Number(d.venta || 0).toFixed(2),
      impuestos: +Number(d.impuestos || 0).toFixed(2),
      total: +Number(d.total || 0).toFixed(2),
      costo: +Number(d.costo || 0).toFixed(2),
      utilidad: +Number(d.utilidad || 0).toFixed(2),
      margen: Number(d.venta || 0) > 0
        ? +((Number(d.utilidad || 0) / Number(d.venta || 0)) * 100).toFixed(2)
        : 0
    };
  }

  return out;
}

async function marcarVentasCortadas(ventas, corteId) {
  const lotes = [];
  let batch = writeBatch(db);
  let contador = 0;

  for (const v of ventas) {
    const ref = doc(
      db,
      ...obtenerSegmentosVentas(RUTA_VENTA_CORTE),
      v.id
    );

    batch.update(ref, {
      cortado: true,
      corte_id: corteId,
      fecha_corte: serverTimestamp()
    });

    contador++;

    if (contador === 450) {
      lotes.push(batch.commit());
      batch = writeBatch(db);
      contador = 0;
    }
  }

  if (contador > 0) lotes.push(batch.commit());

  await Promise.all(lotes);
}

function pintarResultadoCorte(c) {
  const cont = document.getElementById("corteResultado");
  if (!cont) return;

  cont.innerHTML = `
    <div class="corte-section">
      <h3>Resumen del Corte</h3>
      <div class="corte-grid">
        ${cardCorte("Total ventas", money(c.totalVentas), "total")}
        ${cardCorte("Impuestos", money(c.totalImpuestos))}
        ${cardCorte("Efectivo a entregar", money(c.totalEfectivoEntregar), "total")}
        ${cardCorte("Tarjeta", money(c.porFormaPago?.TARJETA || 0))}
        ${cardCorte("Transferencia", money(c.porFormaPago?.TRANSFERENCIA || 0))}
        ${cardCorte("Utilidad", money(c.totalUtilidad))}
        ${cardCorte("Margen", `${c.margen}%`)}
        ${cardCorte("Tickets cortados", c.tickets)}
      </div>
    </div>

    <div class="corte-section">
      <h3>Análisis por Departamento</h3>
      <div class="corte-table-wrap">
        <table class="corte-table">
          <thead>
            <tr>
              <th>Departamento</th>
              <th>Venta</th>
              <th>Imp.</th>
              <th>Total</th>
              <th>Costo</th>
              <th>Utilidad</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(c.porDepto).map(([dep,d]) => `
              <tr>
                <td>${dep}</td>
                <td class="num">${money(d.venta)}</td>
                <td class="num">${money(d.impuestos)}</td>
                <td class="num">${money(d.total)}</td>
                <td class="num">${money(d.costo)}</td>
                <td class="num">${money(d.utilidad)}</td>
                <td class="num">${d.margen}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <div class="corte-section">
      <h3>Top 10 Artículos más vendidos</h3>
      <div class="corte-table-wrap">
        <table class="corte-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Artículo</th>
              <th>Cantidad</th>
              <th>Importe</th>
            </tr>
          </thead>
          <tbody>
            ${c.top10.map((a,i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${a.nombre}</td>
                <td class="num">${a.cantidad}</td>
                <td class="num">${money(a.importe)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function imprimirCorteOperativo(c) {
  let txt = "";

  txt += "==============================\n";
  txt += "      CORTE OPERATIVO\n";
  txt += "        POSPDD26\n";
  txt += "==============================\n";
  txt += `Corte: ${c.corte_id || "—"}\n`;
  txt += `Usuario: ${c.usuarioNombre || c.usuarioLogin || "—"}\n`;
  txt += `Sucursal: ${c.sucursal}\n`;
  txt += `Fecha: ${new Date().toLocaleString("es-MX")}\n`;
  txt += "------------------------------\n";
  txt += `Tickets: ${c.tickets}\n`;
  txt += `Total ventas: ${money(c.totalVentas)}\n`;
  txt += `Impuestos: ${money(c.totalImpuestos)}\n`;
  txt += `Efectivo: ${money(c.totalEfectivoEntregar)}\n`;
  txt += `Efectivo 1: ${money(c.porFormaPago?.EFECTIVO_1 || 0)}\n`;
  txt += `Efectivo 2: ${money(c.porFormaPago?.EFECTIVO_2 || 0)}\n`;
  txt += `Tarjeta: ${money(c.porFormaPago?.TARJETA || 0)}\n`;
  txt += `Transferencia: ${money(c.porFormaPago?.TRANSFERENCIA || 0)}\n`;
  txt += `Utilidad: ${money(c.totalUtilidad)}\n`;
  txt += `Margen: ${c.margen}%\n`;

  txt += "\nDEPARTAMENTOS\n";
  txt += "------------------------------\n";

  for (const [dep, d] of Object.entries(c.porDepto || {})) {
    txt += `${dep.substring(0, 28)}\n`;
    txt += `Venta: ${money(d.total)}\n`;
    txt += `Util:  ${money(d.utilidad)}\n`;
  }

  txt += "\nTOP 10 ARTICULOS\n";
  txt += "------------------------------\n";

  (c.top10 || []).forEach((a, i) => {
    txt += `${i + 1}. ${a.nombre.substring(0, 25)}\n`;
    txt += `Cant: ${a.cantidad}  Imp: ${money(a.importe)}\n`;
  });

  txt += "\n==============================\n";
  txt += "        CORTE CERRADO\n";
  txt += "==============================\n\n\n";

  imprimirTextoConfigurado(txt, "Corte Operativo");
}

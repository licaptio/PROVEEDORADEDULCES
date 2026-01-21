/************************************************************
 * PROVSOFT · FACTURA GLOBAL DIARIA R1
 * ARCHIVO ÚNICO TEMPORAL
 * 
 * 👉 TODO JUNTO PARA VELOCIDAD DE DESARROLLO
 * 👉 SE SEPARARÁ DESPUÉS POR EL EQUIPO
 ************************************************************/

/* =========================================================
   IMPORTS EXTERNOS (NO SE TOCAN)
   ========================================================= */
import { db, obtenerVentasRuta, tomarFolio } from "./firebase.js";
import { FISCAL_EMISOR } from "./configFiscal.js";

/* =========================================================
   CONFIGURACIÓN GENERAL DE LA APP
   ========================================================= */
const CONFIG = {
  rutaId: "Almacen_Ruta_1",
  serieFiscal: "RM1",
  rfcEmisor: "PDD031204KL5"
};

let generandoGlobal = false;
let ventaSeleccionadaId = null; // 👈 ESTA ES LA CLAVE

/* =========================================================
   UTILIDADES MATEMÁTICAS (SAT)
   ========================================================= */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round6(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}


/* =========================================================
   UI · TABLA DE VENTAS
   ========================================================= */
function pintarVentas(ventas) {
  const tbody = document.getElementById("ventas");
  tbody.innerHTML = "";

  ventas.forEach(v => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${v.fecha.toDate().toLocaleString()}</td>
      <td>${v.cliente || "-"}</td>
      <td>$${Number(v.resumen_financiero.total).toFixed(2)}</td>
      <td>
        <input 
          type="radio" 
          name="ventaSeleccionada" 
          value="${v.id}"
        >
      </td>
    `;

    // 👇 AQUÍ CAPTURAS CUÁL SE SELECCIONÓ
    tr.querySelector('input[type="radio"]').addEventListener("change", e => {
      ventaSeleccionadaId = e.target.value;
      console.log("🧪 Venta seleccionada:", ventaSeleccionadaId);
    });

    tbody.appendChild(tr);
  });
}


/* =========================================================
   FECHA (RANGO DIARIO LOCAL)
   ========================================================= */
function rangoDiaDesdeInput() {
  const input = document.getElementById("fecha").value;
  if (!input) return null;

  return {
    inicio: new Date(input + "T00:00:00"),
    fin:    new Date(input + "T23:59:59")
  };
}

/* =========================================================
   GENERACIÓN DE FACTURA GLOBAL
   ========================================================= */
window.generarTXTSifeiGlobal = async function (event) {

  if (generandoGlobal) {
    alert("⏳ Ya se está generando la factura global");
    return;
  }

  if (!document.getElementById("confirmo").checked) {
    alert("Debes confirmar el cierre fiscal");
    return;
  }

  generandoGlobal = true;
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Generando...";
  }

  try {

    /* === 1. RANGO === */
    const rango = rangoDiaDesdeInput();
    if (!rango) throw "Selecciona fecha";

    /* === 2. VENTAS === */
    const ventas = await obtenerVentasRuta(
      CONFIG.rutaId,
      rango.inicio,
      rango.fin
    );

let ventasGlobal = ventas.filter(v =>
  v.estado !== "FACTURADA" &&
  !v.facturada_global
);

// 🧪 MODO DEPURACIÓN: SOLO UNA VENTA
if (ventaSeleccionadaId) {
  ventasGlobal = ventasGlobal.filter(
    v => v.id === ventaSeleccionadaId
  );
}
if (ventaSeleccionadaId && ventasGlobal.length !== 1) {
  throw "Error: no se pudo aislar la venta seleccionada";
}

    if (!ventasGlobal.length) {
      throw "No hay ventas para facturar";
    }

    /* === 3. FOLIO ATÓMICO === */
    const folio = String(
      await tomarFolio(CONFIG.serieFiscal)
    ).padStart(6, "0");

// ===============================
// BASE GLOBAL REAL (TODO)
// ===============================
let baseIVA16 = 0;
let iva16Importe = 0;
let iepsImporte = 0;

ventasGlobal.forEach(v => {
  (v.detalle || []).forEach(d => {

    const importe = Number(d.importe || 0);

    // IVA 16 %
    if (Number(d.ivaTasa) === 0.16) {
      baseIVA16 += importe;
      iva16Importe += Number(d.iva_calculado || 0);
    }

    // IEPS
    if (Number(d.ieps_calculado) > 0) {
      iepsImporte += Number(d.ieps_calculado);
    }

  });
});

baseIVA16   = round2(baseIVA16);
iva16Importe = round2(iva16Importe);
iepsImporte  = round2(iepsImporte);

// 👇 SUBTOTAL GLOBAL REAL (TODO lo vendido)
let subtotalGlobal = 0;

ventasGlobal.forEach(v => {
  subtotalGlobal += Number(v.resumen_financiero.subtotal || 0);
});

subtotalGlobal = round2(subtotalGlobal);
// BASE IVA 0 % (lo que NO llevó IVA 16)

    /* === 5. PRORRATEO + SAT === */
const conceptosCFDI = [];

ventasGlobal.forEach(v => {
  (v.detalle || []).forEach(d => {

    const base = round2(Number(d.importe || 0));
    if (base <= 0) return;

conceptosCFDI.push({
  ticketFolio: v.folio,

  Cantidad: 1,
  ClaveUnidad: "ACT",
  ClaveProdServ: "01010101",
  NoIdentificacion: v.folio,
  Descripcion: d.nombre || "Venta",
  ValorUnitario: base,
  Importe: base,

  impuestos: [
    ...(Number(d.ivaTasa) > 0 ? [{
      tipo: "IVA",
      base: base,
      tasa: Number(d.ivaTasa),
      importe: Number(d.iva_calculado || 0)
    }] : [{
      tipo: "IVA",
      base: base,
      tasa: 0,
      importe: 0
    }]),

    ...(Number(d.ieps_calculado) > 0 ? [{
      tipo: "IEPS",
      base: base,
      tasa: Number(d.iepsTasa) / 100,
      importe: Number(d.ieps_calculado)
    }] : [])
  ]
});


  });
});


const totalGlobal = round2(subtotalGlobal + iva16Importe + iepsImporte);
const cfdiObj = {
  Serie: CONFIG.serieFiscal,
  Folio: folio,
  Fecha: new Date().toISOString().slice(0,19),
  FormaPago: "01",
  MetodoPago: "PUE",
  Moneda: "MXN",

  Subtotal: subtotalGlobal,
  Total: totalGlobal,

 
  Conceptos: conceptosCFDI
};



    const txtSifei = convertirCFDIGlobalASifei(cfdiObj);

const nombreArchivo =
  `CFDI_GLOBAL_${CONFIG.serieFiscal}_${folio}.txt`;

descargarTXT(txtSifei, nombreArchivo);


    alert(`✅ FACTURA GLOBAL GENERADA\nSerie ${CONFIG.serieFiscal} Folio ${folio}`);

  } catch (e) {
    console.error(e);
    alert("❌ Error en factura global");
  } finally {
    generandoGlobal = false;
    if (btn) {
      btn.disabled = false;
      btn.innerText = "GENERAR TXT GLOBAL";
    }
  }
};

/* =========================================================
   BOTÓN CARGAR VENTAS
   ========================================================= */
document.getElementById("btnCargar").addEventListener("click", async () => {

  const rango = rangoDiaDesdeInput();
  if (!rango) return alert("Selecciona fecha");

  const ventas = await obtenerVentasRuta(
    CONFIG.rutaId,
    rango.inicio,
    rango.fin
  );

  pintarVentas(ventas);

  document.getElementById("cnt").innerText = ventas.length;
  document.getElementById("total").innerText =
    ventas.reduce((s,v)=>s+Number(v.resumen_financiero.total||0),0).toFixed(2);
});
function generarImpuestosConceptoSifei(out, concepto) {

  (concepto.impuestos || []).forEach(imp => {

    if (imp.tipo === "IVA") {
      out.push([
        "03-IMP",
        "TRASLADO",
        round6(imp.base).toFixed(6),
        "002",
        "Tasa",
        imp.tasa.toFixed(6),
        round6(imp.importe).toFixed(6)
      ].join("|"));
    }

    if (imp.tipo === "IEPS") {
      out.push([
        "03-IMP",
        "TRASLADO",
        round6(imp.base).toFixed(6),
        "003",
        "Tasa",
        imp.tasa.toFixed(6),
        round6(imp.importe).toFixed(6)
      ].join("|"));
    }

  });
}

/* =========================================================
   SIFEI · CONVERSIÓN CFDI → TXT
   ========================================================= */

/**
 * Convierte un CFDI Global a layout TXT SIFEI
 * TODO LOCAL — SIN IMPORTS
 */
function convertirCFDIGlobalASifei(cfdi) {

  if (!cfdi || !Array.isArray(cfdi.Conceptos)) {
    throw new Error("CFDI inválido");
  }

  const out = [];

out.push([
  "01",
  "FA",
  "4.0",
  cfdi.Serie,
  cfdi.Folio,
  cfdi.FormaPago,
  FISCAL_EMISOR.numeroCertificado,
  "CONTADO",
  round2(cfdi.Subtotal).toFixed(2),
  "0.00",
  cfdi.Moneda,
  "1",
  round2(cfdi.Total).toFixed(2),
  "Ingreso",
  cfdi.MetodoPago,
  "67700",
  "", // 17 Confirmacion
  "EMISOR",
  FISCAL_EMISOR.rfc,
  FISCAL_EMISOR.razonSocial,
  FISCAL_EMISOR.regimenFiscal,
  "RECEPTOR",
  "XAXX010101000",
  "PUBLICO EN GENERAL",
  "", // 25 UsoCFDI
  "", // 26 ResidenciaFiscal
  "S01",
  "admonproveedora@infinitummail.com",
  "", // 29 RFC extranjero
  round2((cfdi.IVA16Importe || 0) + (cfdi.IEPSImporte || 0)).toFixed(2),
  "INFO_ADIC",
  "", // 32
  "MADERO 690 CENTRO LINARES NUEVO LEON MEXICO",
  " 690 CENTRO LINARES NUEVO LEON MEXICO",
  "CONOCIDO S/N CENTRO LINARES 67700 NUEVO LEON MEXICO",
  "", // 36
  "N"
].join("|"));

out.push([
  "01",
  "CFDI40",
  "01",              // Tipo global
  "INFO_GLOBAL",
  "01",              // Periodicidad (Diaria)
  "01",              // Mes
  new Date().getFullYear(),
  "EMISOR",
  "",
  "RECEPTOR",
  "67700",           // CP receptor
  "616"              // Régimen receptor (Público en general)
].join("|"));
// =====================
// CFDI40 · RESUMEN POR TICKET (OBLIGATORIO SIFEI)
// =====================
const tickets = {};

cfdi.Conceptos.forEach(c => {
  // extraemos el folio del ticket desde la descripción
  const folio = c.ticketFolio;

  if (!tickets[folio]) {
    tickets[folio] = {
      subtotal: 0,
      iva16: 0,
      iva0: 0,
      ieps: 0
    };
  }

  tickets[folio].subtotal += c.Importe;
});

Object.entries(tickets).forEach(([folio, t]) => {
  out.push([
    "01",
    "CFDI40",
    "02",                // POR TICKET
    folio,
    round2(t.subtotal).toFixed(2),
    round2(t.iva16).toFixed(2),
    round2(t.iva0).toFixed(2),
    round2(t.ieps).toFixed(2)
  ].join("|"));
});

  // CONCEPTOS
cfdi.Conceptos.forEach((c,i)=>{

  out.push([
    "03",
    i+1,
    "1.000",
    "ACT",
    "",
    "01010101",
    "",
    c.Descripcion,
    round2(c.Importe).toFixed(2),
    "0.00",
    round2(c.Importe).toFixed(2),
    "",
    "02"
  ].join("|"));

  generarImpuestosConceptoSifei(out, c);

});

let iva16Base = 0;
let iva16Importe = 0;
let iva0Base = 0;
let iepsPorTasa = {};

cfdi.Conceptos.forEach(c => {
  (c.impuestos || []).forEach(imp => {

    if (imp.tipo === "IVA" && imp.tasa === 0.16) {
      iva16Base += imp.base;
      iva16Importe += imp.importe;
    }

    if (imp.tipo === "IVA" && imp.tasa === 0) {
      iva0Base += imp.base;
    }

    if (imp.tipo === "IEPS") {
      if (!iepsPorTasa[imp.tasa]) {
        iepsPorTasa[imp.tasa] = { base: 0, importe: 0 };
      }
      iepsPorTasa[imp.tasa].base += imp.base;
      iepsPorTasa[imp.tasa].importe += imp.importe;
    }

  });
});


    /* =====================================================
     SECCIÓN 04 · IMPUESTOS GLOBALES (COMO SIFEI REAL)
     ===================================================== */
// IVA 16 %
if (iva16Importe > 0) {
  out.push([
    "04",
    "TRASLADO",
    "002",
    "Tasa",
    "0.160000",
    round2(iva16Importe).toFixed(2),
    round2(iva16Base).toFixed(2)
  ].join("|"));
}

  // IVA 0 % (obligatorio aunque sea cero)
  out.push([
    "04",
    "TRASLADO",
    "002",
    "Tasa",
    "0.000000",
    "0.00",
    round2(iva0Base).toFixed(2)
  ].join("|"));

// =====================
// IEPS GLOBAL (AGRUPADO POR TASA – SAT REAL)
// =====================
Object.entries(iepsPorTasa).forEach(([tasa, v]) => {
  out.push([
    "04",
    "TRASLADO",
    "003",
    "Tasa",
    Number(tasa).toFixed(6),
    round2(v.importe).toFixed(2),
    round2(v.base).toFixed(2)
  ].join("|"));
});


   const txt = out.join("\n");

  console.log("📄 TXT SIFEI GENERADO:\n", txt);

  return txt;
}

/* =========================================================
   DESCARGA DE TXT (BROWSER)
   ========================================================= */
function descargarTXT(contenido, nombreArchivo) {

  const blob = new Blob([contenido], {
    type: "text/plain;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.style.display = "none";

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

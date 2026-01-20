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
    `;
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

    const ventasGlobal = ventas.filter(v =>
      v.estado !== "FACTURADA" &&
      !v.facturada_global
    );

    if (!ventasGlobal.length) {
      throw "No hay ventas para facturar";
    }

    /* === 3. FOLIO ATÓMICO === */
    const folio = String(
      await tomarFolio(CONFIG.serieFiscal)
    ).padStart(6, "0");

    /* === 4. TOTALES GLOBALES === */
    const tickets = ventasGlobal.map(v => ({
      folio: v.folio,
      total: Number(v.resumen_financiero.total)
    }));

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
const baseIVA0 = round2(subtotalGlobal - baseIVA16);

    /* === 5. PRORRATEO + SAT === */
const conceptosCFDI = tickets.map(t => ({
  Cantidad: 1,
  ClaveUnidad: "ACT",
  ClaveProdServ: "01010101",
  Descripcion: `Venta ${t.folio}`,
  ValorUnitario: round6(t.total),
  Importe: round6(t.total),
  Base: round6(t.total / (1 + 0.16)) // aproximación segura
}));


const cfdiObj = {
  Serie: CONFIG.serieFiscal,
  Folio: folio,
  Fecha: new Date().toISOString().slice(0,19),
  FormaPago: "01",
  MetodoPago: "PUE",
  Moneda: "MXN",

  Subtotal: round2(subtotalGlobal),
  Total: round2(subtotalGlobal + iva16Importe + iepsImporte),

  IVA16Base: baseIVA16,
  IVA16Importe: iva16Importe,
  IEPSImporte: iepsImporte,
  IVA0Base: baseIVA0,   // 👈 ESTA LÍNEA NUEVA 
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
// ===============================
// BASE TOTAL PARA PRORRATEO IEPS
// ===============================
const totalBaseProrrateo = cfdi.Conceptos.reduce(
  (s, c) => s + Number(c.Base || 0),
  0
);

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
  "67700", // CP expedición
  "",      // Email
  "EMISOR",
  FISCAL_EMISOR.rfc,
  FISCAL_EMISOR.razonSocial,
  FISCAL_EMISOR.regimenFiscal,
  "RECEPTOR",
  "XAXX010101000",
  "PUBLICO EN GENERAL",
  "",
  "",
  "S01",
  "",
  "",
  round2((cfdi.IVA16Importe || 0) + (cfdi.IEPSImporte || 0)).toFixed(2),
  "INFO_ADIC",
  "MADERO 690 CENTRO LINARES NUEVO LEON MEXICO",
  "SUCURSAL",
  "PUBLICO EN GENERAL",
  "",
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

  // CONCEPTOS
cfdi.Conceptos.forEach((c,i)=>{

  // =====================
  // LINEA 03 (CONCEPTO)
  // =====================
  out.push([
    "03",
    i+1,
    "1.000",
    "ACT",
    "",
    "01010101",
    "",
    c.Descripcion,
    round6(c.Base).toFixed(6),
    "0.00",
    round6(c.Base).toFixed(6),
    "",
    "02" // 👈 OBLIGATORIO SI HAY IMPUESTOS
  ].join("|"));

  // =====================
  // 03-IMP IVA 0 %
  // =====================
  out.push([
    "03-IMP",
    "TRASLADO",
    round6(c.Base).toFixed(6),
    "002",
    "Tasa",
    "0.000000",
    "0.000000"
  ].join("|"));

  // =====================
  // 03-IMP IVA 16 %
  // (PRORRATEADO SIMPLE)
  // =====================
  if (cfdi.IVA16Importe > 0 && cfdi.IVA16Base > 0) {

    const factorIVA = c.Base / cfdi.Subtotal;
    const baseIVAConcepto = round6(cfdi.IVA16Base * factorIVA);
    const ivaConcepto = round6(cfdi.IVA16Importe * factorIVA);

    out.push([
      "03-IMP",
      "TRASLADO",
      baseIVAConcepto.toFixed(6),
      "002",
      "Tasa",
      "0.160000",
      ivaConcepto.toFixed(6)
    ].join("|"));
  }
// =====================
// 03-IMP IEPS (PRORRATEADO CORRECTO)
// =====================
if (cfdi.IEPSImporte > 0 && totalBaseProrrateo > 0) {

  const factorIEPS = c.Base / totalBaseProrrateo;
  const baseIEPSConcepto = round6(c.Base);
  const iepsConcepto = round6(cfdi.IEPSImporte * factorIEPS);
  const tasaIEPS = baseIEPSConcepto > 0
    ? round6(iepsConcepto / baseIEPSConcepto)
    : 0;

  out.push([
    "03-IMP",
    "TRASLADO",
    baseIEPSConcepto.toFixed(6), // ✅ BASE
    "003",
    "Tasa",
    tasaIEPS.toFixed(6),
    iepsConcepto.toFixed(6)      // ✅ IMPORTE
  ].join("|"));
}

    /* =====================================================
     SECCIÓN 04 · IMPUESTOS GLOBALES (COMO SIFEI REAL)
     ===================================================== */
// IVA 16 %
if (cfdi.IVA16Importe > 0) {
  out.push([
    "04",
    "TRASLADO",
    "002",
    "Tasa",
    "0.160000",
    round2(cfdi.IVA16Importe).toFixed(2),
    round2(cfdi.IVA16Base).toFixed(2)
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
    round2(cfdi.IVA0Base).toFixed(2)
  ].join("|"));

  // IEPS (si aplica)
  if (cfdi.IEPSImporte > 0) {
    const tasaIEPS =
      cfdi.Subtotal > 0
        ? round6(cfdi.IEPSImporte / cfdi.Subtotal)
        : 0;

    out.push([
      "04",
      "TRASLADO",
      "003",
      "Tasa",
      tasaIEPS.toFixed(6),
      round2(cfdi.IEPSImporte).toFixed(2),
      round2(cfdi.Subtotal + cfdi.IEPSImporte).toFixed(2)
    ].join("|"));
  }

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



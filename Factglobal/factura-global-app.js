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
import { convertirCFDIGlobalASifei } from "./sifei/generarTxt.js";

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
   PRORRATEO GLOBAL SAT
   ========================================================= */

/**
 * Prorratea base/IVA/IEPS por ticket
 * ⚠️ SIN redondear aquí
 */
function prorratearGlobal({ tickets, baseGlobal, ivaGlobal, iepsGlobal }) {
  const totalGlobal = tickets.reduce((s, t) => s + t.total, 0);

  return tickets.map(t => {
    const factor = totalGlobal > 0 ? t.total / totalGlobal : 0;
    return {
      ...t,
      baseCalc: baseGlobal * factor,
      ivaCalc: ivaGlobal * factor,
      iepsCalc: iepsGlobal * factor
    };
  });
}

/**
 * Aplica redondeo SAT y ajusta el último concepto
 */
function aplicarRedondeoSAT({ conceptos, baseGlobal, ivaGlobal, iepsGlobal }) {

  const sumBase = conceptos.reduce((s,c)=>s+c.baseCalc,0);
  const sumIVA  = conceptos.reduce((s,c)=>s+c.ivaCalc,0);
  const sumIEPS = conceptos.reduce((s,c)=>s+c.iepsCalc,0);

  const baseSAT = round2(baseGlobal);
  const ivaSAT  = round2(ivaGlobal);
  const iepsSAT = round2(iepsGlobal);

  const ajusteBase = baseSAT - round2(sumBase);
  const ajusteIVA  = ivaSAT  - round2(sumIVA);
  const ajusteIEPS = iepsSAT - round2(sumIEPS);

  const out = conceptos.map(c => ({
    ...c,
    base: round6(c.baseCalc),
    iva: round6(c.ivaCalc),
    ieps: round6(c.iepsCalc)
  }));

  const last = out.length - 1;
  if (last >= 0) {
    out[last].base += ajusteBase;
    out[last].iva  += ajusteIVA;
    out[last].ieps += ajusteIEPS;
  }

  return out;
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

    const baseGlobal = ventasGlobal.reduce(
      (s,v)=>s+Number(v.resumen_financiero.subtotal||0),0
    );
    const ivaGlobal = ventasGlobal.reduce(
      (s,v)=>s+Number(v.resumen_financiero.iva||0),0
    );
    const iepsGlobal = ventasGlobal.reduce(
      (s,v)=>s+Number(v.resumen_financiero.ieps||0),0
    );

    /* === 5. PRORRATEO + SAT === */
    const conceptosFinales = aplicarRedondeoSAT({
      conceptos: prorratearGlobal({
        tickets,
        baseGlobal,
        ivaGlobal,
        iepsGlobal
      }),
      baseGlobal,
      ivaGlobal,
      iepsGlobal
    });

    /* === 6. CFDI OBJ === */
    const conceptosCFDI = conceptosFinales.map(c => ({
      Cantidad: 1,
      ClaveUnidad: "ACT",
      ClaveProdServ: "01010101",
      Descripcion: `Venta ${c.folio}`,
      ValorUnitario: c.base,
      Importe: c.base,
      Base: c.base,
      TasaIVA: c.iva > 0 ? 0.16 : 0,
      IVAImporte: c.iva,
      IEPSTasa: c.base > 0 ? round6(c.ieps / c.base) : 0,
      IEPSImporte: c.ieps
    }));

    const Subtotal = round2(conceptosCFDI.reduce((s,c)=>s+c.Base,0));
    const IVA16Importe = round2(conceptosCFDI.reduce((s,c)=>s+c.IVAImporte,0));
    const IEPSImporte = round2(conceptosCFDI.reduce((s,c)=>s+c.IEPSImporte,0));
    const Total = round2(Subtotal + IVA16Importe + IEPSImporte);

    const cfdiObj = {
      Serie: CONFIG.serieFiscal,
      Folio: folio,
      Fecha: new Date().toISOString().slice(0,19),
      FormaPago: "01",
      MetodoPago: "PUE",
      Moneda: "MXN",
      Subtotal,
      Total,
      IVA16Importe,
      IEPSImporte,
      Conceptos: conceptosCFDI
    };

    convertirCFDIGlobalASifei(cfdiObj);

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

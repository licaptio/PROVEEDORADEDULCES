import {
  prorratearGlobal,
  aplicarRedondeoSAT,
  round2,
  round6
} from "./prorrateoSAT.js";

import { convertirCFDIGlobalASifei } from "./sifei/generarTxt.js";
import { db, obtenerVentasRuta, tomarFolio } from "./firebase.js";

let generandoGlobal = false;

// 🔒 CONFIG ÚNICA DE ESTA APP
const CONFIG = {
  rutaId: "Almacen_Ruta_1",
  serieFiscal: "RM1",
  rfcEmisor: "PDD031204KL5"
};

// ===============================
// PINTAR TABLA DE VENTAS
// ===============================
function pintarVentas(ventas) {
  const tbody = document.getElementById("ventas");
  tbody.innerHTML = "";

  ventas.forEach(v => {
    const estado = v.estado === "FACTURADA";
    const iconoEstado = estado
      ? "🟢 FACTURADA"
      : "🔴 PENDIENTE";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${v.fecha.toDate().toLocaleString()}</td>
      <td>${v.cliente}</td>
      <td>$${v.resumen_financiero.total.toFixed(2)}</td>
    `;

    tbody.appendChild(tr);
  });
}
// ===============================
// GENERAR CFDI (BASE + SIFEI)
// ===============================
window.generarTXTSifeiGlobal = async function (event) {

  // 🔒 BLOQUEO TOTAL ANTI DOBLE CLICK
  if (generandoGlobal) {
    alert("⏳ Ya se está generando la factura global");
    return;
  }

  const chk = document.getElementById("confirmo");
  if (!chk.checked) {
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

    const rango = rangoDiaDesdeInput();
    if (!rango) throw "Selecciona fecha";

    const { inicio, fin } = rango;

    // 1️⃣ Traer ventas
    const ventas = await obtenerVentasRuta(CONFIG.rutaId, inicio, fin);

    const ventasGlobal = ventas.filter(v =>
      v.estado !== "FACTURADA" &&
      !v.facturada_global
    );

    if (!ventasGlobal.length) {
      throw "No hay ventas para factura global";
    }

    // 2️⃣ Folio ATÓMICO
    const folioRaw = await tomarFolio(CONFIG.serieFiscal);
    const folio = String(folioRaw).padStart(6, "0");

    console.log("🧾 Folio tomado:", folio);

    // 🔽 DE AQUÍ PARA ABAJO NO CAMBIA NADA 🔽

    const ahora = new Date();
    const fechaCFDI = ahora.toISOString().slice(0,19);

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

    const prorrateados = prorratearGlobal({
      tickets,
      baseGlobal,
      ivaGlobal,
      iepsGlobal
    });

    const conceptosFinales = aplicarRedondeoSAT({
      conceptos: prorrateados,
      baseGlobal,
      ivaGlobal,
      iepsGlobal
    });

    const conceptosCFDI = conceptosFinales.map(c => {
      const tieneIVA  = c.iva > 0;
      const tieneIEPS = c.ieps > 0;

      return {
        Cantidad: 1,
        ClaveUnidad: "ACT",
        ClaveProdServ: "01010101",
        Descripcion: `Venta ${c.folio}`,
        ValorUnitario: c.base,
        Importe: c.base,
        Base: c.base,
        TasaIVA: tieneIVA ? 0.16 : 0,
        IVAImporte: tieneIVA ? c.iva : 0,
        IEPSTasa: (tieneIEPS && c.base > 0)
          ? round6(c.ieps / c.base)
          : 0,
        IEPSImporte: tieneIEPS ? c.ieps : 0
      };
    });

    const BaseIVA16 = round2(
      conceptosCFDI.reduce((s,c)=>s+(c.TasaIVA>0?c.Base:0),0)
    );
    const IVA16Importe = round2(
      conceptosCFDI.reduce((s,c)=>s+c.IVAImporte,0)
    );

    const BaseIEPS = round2(
      conceptosCFDI.reduce((s,c)=>s+(c.IEPSTasa>0?c.Base:0),0)
    );
    const IEPSImporte = round2(
      conceptosCFDI.reduce((s,c)=>s+c.IEPSImporte,0)
    );

    const Subtotal = round2(
      conceptosCFDI.reduce((s,c)=>s+c.Base,0)
    );
    const Total = round2(Subtotal + IVA16Importe + IEPSImporte);

    const cfdiObj = {
      Serie: CONFIG.serieFiscal,
      Folio: folio,
      Fecha: fechaCFDI,
      FormaPago: "01",
      MetodoPago: "PUE",
      Moneda: "MXN",
      Subtotal,
      Total,
      BaseIVA16,
      IVA16Importe,
      BaseIEPS,
      IEPSImporte,
      IEPSTasa: BaseIEPS > 0
        ? round6(IEPSImporte / BaseIEPS)
        : 0,
      Conceptos: conceptosCFDI
    };

    console.assert(
      round2(Subtotal + IVA16Importe + IEPSImporte) === round2(Total),
      "❌ Totales inconsistentes"
    );

    const txtSifei = convertirCFDIGlobalASifei(cfdiObj);

alert(
  `✅ CIERRE FISCAL COMPLETADO\n\n` +
  `Serie: ${CONFIG.serieFiscal}\n` +
  `Folio: ${folio}\n` +
  `Fecha: ${fechaCFDI}`
);

  } catch (err) {
    console.error("❌ Error global:", err);
    alert("⚠️ Error al generar la factura global");
  } finally {

    generandoGlobal = false;

    if (btn) {
      btn.disabled = false;
      btn.innerText = "GENERAR TXT GLOBAL";
    }
  }
};

function rangoDiaDesdeInput() {
  const input = document.getElementById("fecha").value;
  if (!input) return null;

  // 🔥 IMPORTANTE: usar hora local
  const inicio = new Date(input + "T00:00:00");
  const fin = new Date(input + "T23:59:59");

  return { inicio, fin };
}

// ===============================
// CARGAR VENTAS DEL DÍA (UI)
// ===============================
document.getElementById("btnCargar").addEventListener("click", async () => {
  try {
    const rango = rangoDiaDesdeInput();
    if (!rango) {
      alert("Selecciona una fecha");
      return;
    }

    const { inicio, fin } = rango;

    console.log("🔍 Buscando ventas:", inicio, fin);

    const ventas = await obtenerVentasRuta(CONFIG.rutaId, inicio, fin);

    console.log("📦 Ventas encontradas:", ventas);

    pintarVentas(ventas);

    document.getElementById("cnt").innerText = ventas.length;

    const total = ventas.reduce(
      (s, v) => s + Number(v.resumen_financiero?.total || 0),
      0
    );

    document.getElementById("total").innerText = total.toFixed(2);

  } catch (err) {
    console.error("❌ Error cargando ventas:", err);
    alert("Error al cargar ventas");
  }
});

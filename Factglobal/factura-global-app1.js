/************************************************************
 * PROVSOFT · FACTURA GLOBAL DIARIA R1
 * MODELO SIFEI GLOBAL REAL (1 CONCEPTO)
 ************************************************************/

/* =========================================================
   IMPORTS
   ========================================================= */
import { obtenerVentasRuta, tomarFolio } from "./firebase.js";
import { FISCAL_EMISOR } from "./configFiscal.js";

/* =========================================================
   CONFIG
   ========================================================= */
const CONFIG = {
  rutaId: "Almacen_Ruta_1",
  serieFiscal: "RM1"
};

let ventaSeleccionadaId = null;
let generandoGlobal = false;

/* =========================================================
   UTILIDADES
   ========================================================= */
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r6 = n => Math.round((Number(n) + Number.EPSILON) * 1e6) / 1e6;

/* =========================================================
   UI
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
        <input type="radio" name="ventaSel" value="${v.id}">
      </td>
    `;
    tr.querySelector("input").addEventListener("change", e => {
      ventaSeleccionadaId = e.target.value;
    });
    tbody.appendChild(tr);
  });
}

function rangoDia() {
  const f = document.getElementById("fecha").value;
  if (!f) return null;
  return {
    inicio: new Date(f + "T00:00:00"),
    fin: new Date(f + "T23:59:59")
  };
}

/* =========================================================
   GENERAR FACTURA GLOBAL
   ========================================================= */
window.generarTXTSifeiGlobal = async function () {

  if (generandoGlobal) return;
  if (!document.getElementById("confirmo").checked)
    return alert("Confirma el cierre fiscal");

  const rango = rangoDia();
  if (!rango) return alert("Selecciona fecha");

  generandoGlobal = true;

  try {

    const ventas = await obtenerVentasRuta(
      CONFIG.rutaId,
      rango.inicio,
      rango.fin
    );

    let ventasGlobal = ventas.filter(v =>
      v.estado !== "FACTURADA" &&
      !v.facturada_global
    );

    if (ventaSeleccionadaId) {
      ventasGlobal = ventasGlobal.filter(v => v.id === ventaSeleccionadaId);
    }

    if (ventasGlobal.length !== 1) {
      throw "Debe seleccionarse UNA venta para prueba";
    }

    const venta = ventasGlobal[0];

    /* =====================================================
       BASES FISCALES (MODELO REAL)
       ===================================================== */
    let subtotal = r2(venta.resumen_financiero.subtotal);

    let iva16Base = 0;
    let iva16Importe = 0;
    let iva0Base = 0;
    let iepsPorTasa = {}; // tasa -> { base, importe }

    venta.detalle.forEach(d => {
      const imp = Number(d.importe || 0);

      // IVA 16
      if (Number(d.ivaTasa) === 0.16) {
        iva16Base += imp;
        iva16Importe += Number(d.iva_calculado || 0);
      }

      // IVA 0
      if (Number(d.ivaTasa) === 0) {
        iva0Base += imp;
      }

      // IEPS
      if (Number(d.ieps_calculado) > 0) {
        const tasa = Number(d.iepsTasa) / 100;
        if (!iepsPorTasa[tasa]) {
          iepsPorTasa[tasa] = { base: 0, importe: 0 };
        }
        iepsPorTasa[tasa].base += imp;
        iepsPorTasa[tasa].importe += Number(d.ieps_calculado);
      }
    });

    iva16Base = r2(iva16Base);
    iva16Importe = r2(iva16Importe);
    iva0Base = r2(iva0Base);

    Object.values(iepsPorTasa).forEach(v => {
      v.base = r2(v.base);
      v.importe = r2(v.importe);
    });

    const total = r2(
      subtotal +
      iva16Importe +
      Object.values(iepsPorTasa).reduce((s,v)=>s+v.importe,0)
    );

    /* =====================================================
       CONCEPTO ÚNICO (SIFEI)
       ===================================================== */
    const concepto = {
      ticketFolio: venta.folio,
      Importe: subtotal,
      impuestos: [
        ...(iva16Base > 0 ? [{
          tipo: "IVA", base: iva16Base, tasa: 0.16, importe: iva16Importe
        }] : []),
        ...(iva0Base > 0 ? [{
          tipo: "IVA", base: iva0Base, tasa: 0, importe: 0
        }] : []),
        ...Object.entries(iepsPorTasa).map(([t,v]) => ({
          tipo: "IEPS",
          base: v.base,
          tasa: Number(t),
          importe: v.importe
        }))
      ]
    };

    /* =====================================================
       TXT SIFEI
       ===================================================== */
    const folio = String(await tomarFolio(CONFIG.serieFiscal)).padStart(6,"0");
    const out = [];

    out.push([
      "01","FA","4.0",CONFIG.serieFiscal,folio,"01",
      FISCAL_EMISOR.numeroCertificado,"CONTADO",
      subtotal.toFixed(2),"0.00","MXN","1",
      total.toFixed(2),"Ingreso","PUE","67700","",
      "EMISOR",FISCAL_EMISOR.rfc,FISCAL_EMISOR.razonSocial,FISCAL_EMISOR.regimenFiscal,
      "RECEPTOR","XAXX010101000","PUBLICO EN GENERAL","","","S01",
      "admonproveedora@infinitummail.com","",
      (total - subtotal).toFixed(2),
      "INFO_ADIC","","","","","N"
    ].join("|"));

    out.push([
      "01","CFDI40","01","INFO_GLOBAL","01","01",
      new Date().getFullYear(),"EMISOR","","RECEPTOR","67700","616"
    ].join("|"));

    out.push([
      "03","1","1.000","ACT","","01010101",
      venta.folio,"Venta",
      subtotal.toFixed(6),"0.00",subtotal.toFixed(6),"","02"
    ].join("|"));

    concepto.impuestos.forEach(i => {
      out.push([
        "03-IMP","TRASLADO",
        r6(i.base).toFixed(6),
        i.tipo === "IVA" ? "002" : "003",
        "Tasa",
        r6(i.tasa).toFixed(6),
        r6(i.importe).toFixed(6)
      ].join("|"));
    });

    if (iva16Base > 0)
      out.push(["04","TRASLADO","002","Tasa","0.160000",iva16Importe.toFixed(2),iva16Base.toFixed(2)].join("|"));

    out.push(["04","TRASLADO","002","Tasa","0.000000","0.00",iva0Base.toFixed(2)].join("|"));

    Object.entries(iepsPorTasa).forEach(([t,v])=>{
      out.push(["04","TRASLADO","003","Tasa",Number(t).toFixed(6),v.importe.toFixed(2),v.base.toFixed(2)].join("|"));
    });

    descargarTXT(out.join("\n"), `CFDI_GLOBAL_${CONFIG.serieFiscal}_${folio}.txt`);

    alert("✅ FACTURA GLOBAL LISTA PARA TIMBRAR");

  } catch (e) {
    console.error(e);
    alert("❌ Error en generación");
  } finally {
    generandoGlobal = false;
  }
};

/* =========================================================
   DESCARGA
   ========================================================= */
function descargarTXT(txt, nombre) {
  const blob = new Blob([txt], { type:"text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}

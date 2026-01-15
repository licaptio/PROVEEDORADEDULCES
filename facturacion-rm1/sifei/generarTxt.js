import {
  FISCAL_EMISOR,
  RECEPTOR_PUBLICO_GENERAL
} from "./configFiscal.js";

/**
 * Construye un objeto CFDI base desde la venta
 * Aquí se calculan TODAS las bases e impuestos
 */
export function armarObjetoCFDIDesdeVenta(venta, folio, fechaCFDI) {
  let subtotal = 0;

  let BaseIVA0 = 0;
  let BaseIVA16 = 0;
  let BaseIEPS = 0;

  let IVA16Importe = 0;
  let IEPSImporte = 0;
  let IEPSTasa = 0;

  const Conceptos = venta.detalle.map((item) => {
    const importe = Number(item.importe);
    subtotal += importe;
    // ===============================
// IEPS FISCAL (NO comercial)
// ===============================
const tasaIEPS = Number(item.iepsTasa || 0) / 100;
const iepsFiscal = tasaIEPS > 0
  ? +(importe * tasaIEPS).toFixed(2)
  : 0;

    // IVA
    if (Number(item.iva) === 16) {
      BaseIVA16 += importe;
      IVA16Importe += Number(item.iva_calculado || 0);
    } else if (Number(item.iepsTasa) === 0) {
      BaseIVA0 += importe;
    }

    // IEPS
// IEPS
if (tasaIEPS > 0) {
  BaseIEPS += importe;
  IEPSImporte += iepsFiscal;
  IEPSTasa = tasaIEPS; // solo una tasa global
}


    return {
      Cantidad: Number(item.cantidad),
      ClaveUnidad: item.unidadSat || "H87",
      ClaveProdServ: item.claveSat || "01010101",
      Descripcion: item.nombre,
      ValorUnitario: Number(item.precio_unit),
      Importe: importe,

      Base: importe,

      // IVA
      TasaIVA: Number(item.iva) === 16 ? 0.16 : 0,
      IVAImporte: Number(item.iva_calculado || 0),

      // IEPS
IEPSTasa: tasaIEPS,
IEPSImporte: iepsFiscal
    };
  });

  return {
    Serie: "RM1",
    Folio: folio,
    Fecha: fechaCFDI,
    FormaPago: "01",
    MetodoPago: "PUE",
    Moneda: "MXN",

    Subtotal: subtotal,
    Total: subtotal + IVA16Importe + IEPSImporte,

    BaseIVA0,
    BaseIVA16,
    BaseIEPS,

    IVA16Importe,
    IEPSImporte,
    IEPSTasa,

    Conceptos
  };
}

/**
 * Convierte el CFDI base al TXT SIFEI FINAL
 */
export function convertirCFDIBaseASifei(cfdi) {
  const out = [];

  // ===============================
  // REGISTRO 01 — CABECERA COMPLETA
  // ===============================
  out.push([
    "01",
    "FA",
    "4.0",
    cfdi.Serie,
    cfdi.Folio,
    cfdi.FormaPago,
    FISCAL_EMISOR.numeroCertificado,
    "CONTADO",
    cfdi.Subtotal.toFixed(2),
    "0.00",
    cfdi.Moneda,
    "1",
    cfdi.Total.toFixed(2),
    "Ingreso",
    cfdi.MetodoPago,
    FISCAL_EMISOR.cpExpedicion,
    "",
    "EMISOR",
    FISCAL_EMISOR.rfc,
    FISCAL_EMISOR.razonSocial,
    FISCAL_EMISOR.regimenFiscal,
    "RECEPTOR",
    RECEPTOR_PUBLICO_GENERAL.rfc,
    RECEPTOR_PUBLICO_GENERAL.nombre,
    "",
    "",
    RECEPTOR_PUBLICO_GENERAL.usoCFDI,
    "",
    "",
    (cfdi.IVA16Importe + cfdi.IEPSImporte).toFixed(2),
    "INFO_ADIC",
    "",
    FISCAL_EMISOR.direccion,
    FISCAL_EMISOR.direccion,
    "",
    "",
    "N"
  ].join("|"));

  // ===============================
  // REGISTRO 01 — CFDI40 INFO_GLOBAL
  // ===============================
  out.push([
    "01",
    "CFDI40",
    "01",
    "INFO_GLOBAL",
    "",
    "",
    "",
    "EMISOR",
    "",
    "RECEPTOR",
    RECEPTOR_PUBLICO_GENERAL.cp,
    RECEPTOR_PUBLICO_GENERAL.regimenFiscal
  ].join("|"));

  // ===============================
  // REGISTROS 03 — CONCEPTOS
  // ===============================
  cfdi.Conceptos.forEach((c, idx) => {
    out.push([
      "03",
      idx + 1,
      c.Cantidad.toFixed(3),
      c.ClaveUnidad,
      "PZA",
      c.ClaveProdServ,
      "",
      c.Descripcion,
      c.ValorUnitario.toFixed(4),
      "0.00",
      c.Importe.toFixed(4),
      "",
      "02"
    ].join("|"));

    // IVA por concepto
    if (c.TasaIVA > 0) {
      out.push([
        "03-IMP",
        "TRASLADO",
        c.Base.toFixed(6),
        "002",
        "Tasa",
        c.TasaIVA.toFixed(6),
        c.IVAImporte.toFixed(6)
      ].join("|"));
    }

    // IEPS por concepto
    if (c.IEPSTasa > 0) {
      out.push([
        "03-IMP",
        "TRASLADO",
        c.Base.toFixed(6),
        "003",
        "Tasa",
        c.IEPSTasa.toFixed(6),
        c.IEPSImporte.toFixed(6)
      ].join("|"));
    }
  });

  // ===============================
  // REGISTROS 04 — IMPUESTOS GLOBALES
  // ===============================

  // IVA 0%
  if (cfdi.BaseIVA0 > 0) {
    out.push([
      "04",
      "TRASLADO",
      "002",
      "Tasa",
      "0.000000",
      "0.00",
      cfdi.BaseIVA0.toFixed(2)
    ].join("|"));
  }

  // IVA 16%
  if (cfdi.IVA16Importe > 0) {
    out.push([
      "04",
      "TRASLADO",
      "002",
      "Tasa",
      "0.160000",
      cfdi.IVA16Importe.toFixed(2),
      cfdi.BaseIVA16.toFixed(2)
    ].join("|"));
  }

  // IEPS
  if (cfdi.IEPSImporte > 0) {
    out.push([
      "04",
      "TRASLADO",
      "003",
      "Tasa",
      cfdi.IEPSTasa.toFixed(6),
      cfdi.IEPSImporte.toFixed(2),
      cfdi.BaseIEPS.toFixed(2)
    ].join("|"));
  }

  return out.join("\n");
}


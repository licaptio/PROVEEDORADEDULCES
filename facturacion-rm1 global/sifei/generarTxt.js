import {
  FISCAL_EMISOR,
  RECEPTOR_PUBLICO_GENERAL
} from "./configFiscal.js";

/**
 * ============================================
 * VALIDADOR CFDI GLOBAL (PG)
 * ============================================
 * - NO valida contra impuestos globales
 * - SOLO valida conceptos
 */
function validarCFDI(cfdi) {

  if (!Array.isArray(cfdi.Conceptos) || !cfdi.Conceptos.length) {
    throw new Error("CFDI sin conceptos");
  }

  const ivaConceptos = cfdi.Conceptos
    .filter(c => c.TasaIVA > 0)
    .reduce((s, c) => s + c.IVAImporte, 0);

  if (ivaConceptos < 0) {
    throw new Error(`IVA inválido en conceptos: ${ivaConceptos}`);
  }

  const iepsConceptos = cfdi.Conceptos
    .filter(c => c.IEPSTasa > 0)
    .reduce((s, c) => s + c.IEPSImporte, 0);

  if (iepsConceptos < 0) {
    throw new Error(`IEPS inválido en conceptos: ${iepsConceptos}`);
  }
}

/**
 * ============================================
 * ARMAR CFDI GLOBAL DESDE TICKETS
 * 1 CONCEPTO = 1 TICKET
 * ============================================
 */
export function armarCFDIGlobalDesdeTickets({
  serie,
  folio,
  fechaCFDI,
  tickets
}) {

  let subtotal = 0;
  let total = 0;

  let BaseIVA16 = 0;
  let IVA16Importe = 0;

  let BaseIEPS = 0;
  let IEPSImporte = 0;
  let IEPSTasa = 0;

  const Conceptos = tickets.map((t, idx) => {

    subtotal += t.base;
    total += t.total;

    // IVA
    if (t.iva > 0) {
      BaseIVA16 += t.base;
      IVA16Importe += t.iva;
    }

    // IEPS
    if (t.ieps > 0) {
      BaseIEPS += t.base;
      IEPSImporte += t.ieps;
      IEPSTasa = t.iepsTasa;
    }

    return {
      Cantidad: 1,
      ClaveUnidad: "ACT",
      ClaveProdServ: "01010101",
      Descripcion: t.descripcion,
      ValorUnitario: t.base,
      Importe: t.base,
      Base: t.base,

      TasaIVA: t.iva > 0 ? 0.16 : 0,
      IVAImporte: t.iva || 0,

      IEPSTasa: t.ieps > 0 ? t.iepsTasa : 0,
      IEPSImporte: t.ieps || 0
    };
  });

  return {
    Serie: serie,
    Folio: folio,
    Fecha: fechaCFDI,
    FormaPago: "01",
    MetodoPago: "PUE",
    Moneda: "MXN",

    Subtotal: subtotal,
    Total: total,

    BaseIVA16,
    IVA16Importe,

    BaseIEPS,
    IEPSImporte,
    IEPSTasa,

    Conceptos
  };
}

/**
 * ============================================
 * CFDI GLOBAL → TXT SIFEI
 * ============================================
 */
export function convertirCFDIGlobalASifei(cfdi) {

  validarCFDI(cfdi);
  const out = [];

  // ===============================
  // 01 | CABECERA
  // ===============================
  out.push([
    "01","FA","4.0",
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
    (
      (cfdi.IVA16Importe || 0) +
      (cfdi.IEPSImporte || 0)
    ).toFixed(2),
    "INFO_ADIC",
    "",
    FISCAL_EMISOR.direccion,
    FISCAL_EMISOR.direccion,
    "",
    "",
    "N"
  ].join("|"));

  // ===============================
  // INFO_GLOBAL
  // ===============================
  const fecha = new Date(cfdi.Fecha);
  out.push([
    "01","CFDI40","01","INFO_GLOBAL",
    "01",
    String(fecha.getMonth() + 1).padStart(2, "0"),
    fecha.getFullYear(),
    "EMISOR","",
    "RECEPTOR",
    RECEPTOR_PUBLICO_GENERAL.cp,
    RECEPTOR_PUBLICO_GENERAL.regimenFiscal
  ].join("|"));

  // ===============================
  // 03 | CONCEPTOS (1 = 1 ticket)
  // ===============================
  cfdi.Conceptos.forEach((c, idx) => {

    const tieneImpuestos = (c.TasaIVA > 0 || c.IEPSTasa > 0);

    out.push([
      "03",
      idx + 1,
      "1.000",
      c.ClaveUnidad,
      "PZA",
      c.ClaveProdServ,
      "",
      c.Descripcion,
      c.ValorUnitario.toFixed(4),
      "0.00",
      c.Importe.toFixed(4),
      "",
      tieneImpuestos ? "02" : "01"
    ].join("|"));

    // IVA
if (c.TasaIVA >= 0 && (c.TasaIVA > 0 || c.IEPSTasa > 0)) {
  out.push([
    "03-IMP","TRASLADO",
    c.Base.toFixed(6),
    "002","Tasa",
    (c.TasaIVA || 0).toFixed(6),
    (c.IVAImporte || 0).toFixed(6)
  ].join("|"));
}

    // IEPS
    if (c.IEPSTasa > 0) {
      out.push([
        "03-IMP","TRASLADO",
        c.Base.toFixed(6),
        "003","Tasa",
        c.IEPSTasa.toFixed(6),
        c.IEPSImporte.toFixed(6)
      ].join("|"));
    }
  });

  // ===============================
  // 04 | IMPUESTOS GLOBALES (AGREGADOS)
  // ===============================
  if (cfdi.IEPSImporte > 0) {
    out.push([
      "04","TRASLADO","003","Tasa",
      cfdi.IEPSTasa.toFixed(6),
      cfdi.IEPSImporte.toFixed(2),
      cfdi.BaseIEPS.toFixed(2)
    ].join("|"));
  }

  if (cfdi.IVA16Importe > 0) {
    out.push([
      "04","TRASLADO","002","Tasa","0.160000",
      cfdi.IVA16Importe.toFixed(2),
      cfdi.BaseIVA16.toFixed(2)
    ].join("|"));
  }

  return out.join("\n");
}


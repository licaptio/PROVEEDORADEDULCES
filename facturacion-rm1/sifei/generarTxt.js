import {
  FISCAL_EMISOR,
  RECEPTOR_PUBLICO_GENERAL
} from "./configFiscal.js";
function validarCFDI(cfdi) {

  // ===== IVA =====
  const ivaConceptos = cfdi.Conceptos
    .filter(c => c.TasaIVA > 0)
    .reduce((s, c) => s + c.IVAImporte, 0);

  if (cfdi.IVA16Importe.toFixed(2) !== ivaConceptos.toFixed(2)) {
    throw new Error(
      `Descuadre IVA: Global=${cfdi.IVA16Importe} vs Conceptos=${ivaConceptos}`
    );
  }

  // ===== IEPS =====
  const iepsConceptos = cfdi.Conceptos
    .filter(c => c.IEPSTasa > 0)
    .reduce((s, c) => s + c.IEPSImporte, 0);

  if (cfdi.IEPSImporte.toFixed(2) !== iepsConceptos.toFixed(2)) {
    throw new Error(
      `Descuadre IEPS: Global=${cfdi.IEPSImporte} vs Conceptos=${iepsConceptos}`
    );
  }
}

/**
 * ============================================
 * 1️⃣ ARMAR CFDI BASE (FUENTE ÚNICA DE VERDAD)
 * ============================================
 */
export function armarObjetoCFDIDesdeVenta(venta, folio, fechaCFDI) {
  let subtotal = 0;

  let BaseIVA16 = 0;
  let IVA16Importe = 0;

  let BaseIEPS = 0;
  let IEPSImporte = 0;
  let IEPSTasa = 0;

  const Conceptos = venta.detalle.map(item => {

    const importe = Number(item.importe);
    subtotal += importe;

    // ===== IVA =====
const tasaIVA =
  Number(item.iva) === 16 ||
  Number(item.ivaTasa) === 0.16 ||
  Number(item.iva_calculado) > 0
    ? 0.16
    : 0;

const ivaImporte = tasaIVA > 0
  ? Number(item.iva_calculado || 0)
  : 0;

    if (tasaIVA > 0) {
      BaseIVA16 += importe;
      IVA16Importe += ivaImporte;
    }

    // ===== IEPS (USAR EL YA CALCULADO) =====
    const tasaIEPS = Number(item.iepsTasa || 0) / 100;
    const iepsImporte = Number(item.ieps_calculado || 0);

    if (tasaIEPS > 0) {
      BaseIEPS += importe;
      IEPSImporte += iepsImporte;
      IEPSTasa = tasaIEPS;
    }

    return {
      Cantidad: Number(item.cantidad),
      ClaveUnidad: item.unidadSat || "H87",
      ClaveProdServ: item.claveSat || "01010101",
      Descripcion: item.nombre,
      ValorUnitario: Number(item.precio_unit),
      Importe: importe,
      Base: importe,

      TasaIVA: tasaIVA,
      IVAImporte: ivaImporte,

      IEPSTasa: tasaIEPS,
      IEPSImporte: iepsImporte
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
 * 2️⃣ CFDI BASE → TXT SIFEI (VALIDADO)
 * ============================================
 */
export function convertirCFDIBaseASifei(cfdi) {
    // 🔒 BLINDAJE FINAL ANTI-SAT / ANTI-SIFEI
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
  // INFO_GLOBAL (OBLIGATORIO PG)
  // ===============================
  const fecha = new Date(cfdi.Fecha);
  out.push([
    "01","CFDI40","01","INFO_GLOBAL",
    "01",
    String(fecha.getMonth()+1).padStart(2,"0"),
    fecha.getFullYear(),
    "EMISOR","",
    "RECEPTOR",
    RECEPTOR_PUBLICO_GENERAL.cp,
    RECEPTOR_PUBLICO_GENERAL.regimenFiscal
  ].join("|"));

  // ===============================
  // 03 | CONCEPTOS
  // ===============================
  cfdi.Conceptos.forEach((c, idx) => {

    const tieneImpuestos = (c.TasaIVA > 0 || c.IEPSTasa > 0);
    const objetoImp = tieneImpuestos ? "02" : "01";

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
      objetoImp
    ].join("|"));

    // IVA
    if (c.TasaIVA > 0) {
      out.push([
        "03-IMP","TRASLADO",
        c.Base.toFixed(6),
        "002","Tasa","0.160000",
        c.IVAImporte.toFixed(6)
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
  // 04 | IMPUESTOS GLOBALES
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




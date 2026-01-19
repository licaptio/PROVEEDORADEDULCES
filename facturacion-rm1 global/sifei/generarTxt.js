export function convertirCFDIGlobalASifei(cfdi) {
  validarCFDI(cfdi);
  const out = [];

  // 01 | CABECERA
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
    ((cfdi.IVA16Importe || 0) + (cfdi.IEPSImporte || 0)).toFixed(2),
    "INFO_ADIC",
    "",
    FISCAL_EMISOR.direccion,
    FISCAL_EMISOR.direccion,
    "",
    "",
    "N"
  ].join("|"));

  // INFO_GLOBAL
  const fecha = new Date(cfdi.Fecha);
  out.push([
    "01","CFDI40","01","INFO_GLOBAL",
    "01",
    String(fecha.getMonth() + 1).padStart(2,"0"),
    fecha.getFullYear(),
    "EMISOR","",
    "RECEPTOR",
    RECEPTOR_PUBLICO_GENERAL.cp,
    RECEPTOR_PUBLICO_GENERAL.regimenFiscal
  ].join("|"));

  // 03 | CONCEPTOS
  cfdi.Conceptos.forEach((c, idx) => {
    const tieneImp = c.TasaIVA > 0 || c.IEPSTasa > 0;

    out.push([
      "03",
      idx + 1,
      "1.000",
      "ACT",
      "",
      "01010101",
      "",
      c.Descripcion,
      c.ValorUnitario.toFixed(6),
      "0.00",
      c.Importe.toFixed(6),
      "",
      tieneImp ? "02" : "01"
    ].join("|"));

    if (c.TasaIVA > 0) {
      out.push([
        "03-IMP","TRASLADO",
        c.Base.toFixed(6),
        "002","Tasa","0.160000",
        c.IVAImporte.toFixed(6)
      ].join("|"));
    }

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

  // 04 | IMPUESTOS GLOBALES
  if (cfdi.IVA16Importe > 0) {
    out.push([
      "04","TRASLADO","002","Tasa","0.160000",
      cfdi.IVA16Importe.toFixed(2),
      cfdi.BaseIVA16.toFixed(2)
    ].join("|"));
  }

  if (cfdi.IEPSImporte > 0) {
    out.push([
      "04","TRASLADO","003","Tasa",
      cfdi.IEPSTasa.toFixed(6),
      cfdi.IEPSImporte.toFixed(2),
      cfdi.BaseIEPS.toFixed(2)
    ].join("|"));
  }

  return out.join("\n");
}

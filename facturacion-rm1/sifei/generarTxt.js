export function convertirCFDIBaseASifei(cfdi) {
  const out = [];

  // ===== CABECERA =====
  out.push([
    "01",
    "FA",
    cfdi.Version,
    cfdi.Serie,
    cfdi.Folio,
    cfdi.FormaPago,
    "NO_CERT",
    "CONTADO",
    cfdi.Subtotal.toFixed(2),
    "0.00",
    cfdi.Moneda,
    "1",
    cfdi.Total.toFixed(2),
    "Ingreso",
    cfdi.MetodoPago,
    cfdi.LugarExpedicion
  ].join("|"));

  // ===== EMISOR =====
  out.push([
    "EMISOR",
    cfdi.Emisor.Rfc,
    cfdi.Emisor.Nombre,
    cfdi.Emisor.RegimenFiscal
  ].join("|"));

  // ===== RECEPTOR =====
  out.push([
    "RECEPTOR",
    cfdi.Receptor.Rfc,
    cfdi.Receptor.Nombre,
    "",
    "",
    cfdi.Receptor.UsoCFDI
  ].join("|"));

  // ===== CONCEPTOS =====
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

    // IMPUESTO POR CONCEPTO
    out.push([
      "03-IMP",
      "TRASLADO",
      c.Base.toFixed(6),
      "002",
      "Tasa",
      c.Tasa.toFixed(6),
      c.Impuesto.toFixed(6)
    ].join("|"));
  });

  // ===== IMPUESTOS GLOBALES =====
  out.push([
    "04",
    "TRASLADO",
    "002",
    "Tasa",
    cfdi.TasaGlobal.toFixed(6),
    cfdi.Impuestos.toFixed(2),
    cfdi.BaseImpuestos.toFixed(2)
  ].join("|"));

  return out.join("\n");
}

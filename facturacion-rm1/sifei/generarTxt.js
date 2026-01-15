export function generarTXTSifeiCompleto(venta, folio, fechaCFDI) {
  const sep = "|";
  const lines = [];

  lines.push("[CFDI]");
  lines.push([
    "Version=4.0",
    "Serie=RM1",
    `Folio=${folio}`,
    `Fecha=${fechaCFDI}`,
    "FormaPago=01",
    "MetodoPago=PUE",
    "Moneda=MXN",
    "TipoDeComprobante=I",
    "Exportacion=01",
    "LugarExpedicion=64000"
  ].join(sep));

  lines.push("[EMISOR]");
  lines.push([
    "Rfc=PDD031204KL5",
    "Nombre=PROVEEDORA DE DULCES Y DESECHABLES SA DE CV",
    "RegimenFiscal=601"
  ].join(sep));

  lines.push("[RECEPTOR]");
  lines.push([
    "Rfc=XAXX010101000",
    "Nombre=PUBLICO EN GENERAL",
    "DomicilioFiscalReceptor=64000",
    "RegimenFiscalReceptor=616",
    "UsoCFDI=S01"
  ].join(sep));

  lines.push("[CONCEPTOS]");

  let subtotal = 0;
  let totalIVA = 0;
  let totalIEPS = 0;

  venta.detalle.forEach(item => {
    const cantidad = Number(item.cantidad);
    const valorUnitario = Number(item.precio_unit);
    const importe = Number(item.importe);

    subtotal += importe;

    let impuestoIVA = "Impuesto=002,TipoFactor=Exento";
    if (Number(item.iva) === 16) {
      totalIVA += Number(item.iva_calculado);
      impuestoIVA =
        `Impuesto=002,TipoFactor=Tasa,TasaOCuota=0.160000,` +
        `Base=${importe.toFixed(2)},Importe=${Number(item.iva_calculado).toFixed(2)}`;
    }

    let impuestoIEPS = "";
    if (Number(item.iepsTasa) > 0) {
      totalIEPS += Number(item.ieps_calculado);
      impuestoIEPS =
        `;Impuesto=003,TipoFactor=Tasa,TasaOCuota=${(item.iepsTasa / 100).toFixed(6)},` +
        `Base=${importe.toFixed(2)},Importe=${Number(item.ieps_calculado).toFixed(2)}`;
    }

    lines.push([
      `ClaveProdServ=${item.claveSat || "01010101"}`,
      `Cantidad=${cantidad}`,
      `ClaveUnidad=${item.unidadSat || "H87"}`,
      `Descripcion=${item.nombre}`,
      `ValorUnitario=${valorUnitario.toFixed(2)}`,
      `Importe=${importe.toFixed(2)}`,
      impuestoIVA + impuestoIEPS
    ].join(sep));
  });

  lines.push("[IMPUESTOS]");
  lines.push(`TotalImpuestosTrasladados=${(totalIVA + totalIEPS).toFixed(2)}`);
  lines.push(`Total=${(subtotal + totalIVA + totalIEPS).toFixed(2)}`);

  return lines.join("\n");
}

export function armarObjetoCFDIDesdeVenta(venta, folio, fechaCFDI) {
  let subtotal = 0;
  let impuestos = 0;

  const conceptos = venta.detalle.map(item => {
    subtotal += Number(item.importe);
    impuestos += Number(item.iva_calculado || 0) + Number(item.ieps_calculado || 0);

    return {
      Cantidad: Number(item.cantidad),
      ClaveUnidad: item.unidadSat || "H87",
      ClaveProdServ: item.claveSat || "01010101",
      Descripcion: item.nombre,
      ValorUnitario: Number(item.precio_unit),
      Importe: Number(item.importe),
      Base: Number(item.importe),
      Tasa: Number(item.iva) === 16 ? 0.16 : 0,
      Impuesto: Number(item.iva_calculado || 0)
    };
  });

  return {
    Version: "4.0",
    Serie: "RM1",
    Folio: folio,
    FormaPago: "01",
    MetodoPago: "PUE",
    Moneda: "MXN",
    TipoDeComprobante: "Ingreso",
    LugarExpedicion: "64000",
    Fecha: fechaCFDI,

    Emisor: {
      Rfc: "PDD031204KL5",
      Nombre: "PROVEEDORA DE DULCES Y DESECHABLES SA DE CV",
      RegimenFiscal: "601"
    },

    Receptor: {
      Rfc: "XAXX010101000",
      Nombre: "PUBLICO EN GENERAL",
      UsoCFDI: "S01"
    },

    Conceptos: conceptos,
    Subtotal: subtotal,
    Impuestos: impuestos,
    Total: subtotal + impuestos,
    TasaGlobal: impuestos > 0 ? 0.16 : 0,
    BaseImpuestos: subtotal
  };
}
export function convertirCFDIBaseASifei(cfdi) {
  const out = [];

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
    cfdi.TipoDeComprobante,
    cfdi.MetodoPago,
    cfdi.LugarExpedicion
  ].join("|"));

  out.push([
    "EMISOR",
    cfdi.Emisor.Rfc,
    cfdi.Emisor.Nombre,
    cfdi.Emisor.RegimenFiscal
  ].join("|"));

  out.push([
    "RECEPTOR",
    cfdi.Receptor.Rfc,
    cfdi.Receptor.Nombre,
    "",
    "",
    cfdi.Receptor.UsoCFDI
  ].join("|"));

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

// ===============================
// IMPUESTOS POR CONCEPTO (CORREGIDO)
// ===============================

// IVA
if (c.Tasa > 0) {
  out.push([
    "03-IMP",
    "TRASLADO",
    c.Base.toFixed(6),
    "002",                  // IVA
    "Tasa",
    c.Tasa.toFixed(6),      // 0.160000
    c.Impuesto.toFixed(6)
  ].join("|"));
}

// IEPS
if (c.IEPSTasa && c.IEPSTasa > 0) {
  out.push([
    "03-IMP",
    "TRASLADO",
    c.Base.toFixed(6),
    "003",                  // IEPS
    "Tasa",
    c.IEPSTasa.toFixed(6),  // tasa real (ej. 0.137857)
    c.IEPSImporte.toFixed(6)
  ].join("|"));
}

  });

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


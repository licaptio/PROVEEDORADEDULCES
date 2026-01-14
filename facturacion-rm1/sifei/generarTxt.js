export function generarTXTSifeiCompleto(venta, folio, fechaCFDI) {
  const sep = "|";
  const lines = [];

  // ======================
  // [CFDI]
  // ======================
  lines.push("[CFDI]");
  lines.push([
    "Version=4.0",
    "Serie=RM1",
    `Folio=${folio}`,
    `Fecha=${fechaCFDI}`,                // YYYY-MM-DDTHH:mm:ss
    "FormaPago=01",                      // Efectivo (ajusta si aplica)
    "MetodoPago=PUE",
    "Moneda=MXN",
    "TipoDeComprobante=I",
    "Exportacion=01",
    "LugarExpedicion=64000"              // CP emisor
  ].join(sep));

  // ======================
  // [EMISOR]
  // ======================
  lines.push("[EMISOR]");
  lines.push([
    "Rfc=PDD031204KL5",
    "Nombre=PROVEEDORA DE DULCES Y DESECHABLES SA DE CV",
    "RegimenFiscal=601"
  ].join(sep));

  // ======================
  // [RECEPTOR] — Público en general
  // ======================
  lines.push("[RECEPTOR]");
  lines.push([
    "Rfc=XAXX010101000",
    "Nombre=PUBLICO EN GENERAL",
    "DomicilioFiscalReceptor=64000",
    "RegimenFiscalReceptor=616",
    "UsoCFDI=S01"
  ].join(sep));

  // ======================
  // [CONCEPTOS]
  // ======================
  lines.push("[CONCEPTOS]");

  let subtotal = 0;
  let totalIVA16 = 0;
  let totalIEPS = 0;

  venta.detalle.forEach((item, idx) => {
    const cantidad = Number(item.cantidad);
    const valorUnitario = Number(item.precio_unitario);
    const importe = +(cantidad * valorUnitario).toFixed(2);
    subtotal += importe;

    // IVA
    let impuestoIVA = "";
    if (item.iva === 16) {
      const baseIVA = importe;
      const ivaImporte = +(baseIVA * 0.16).toFixed(2);
      totalIVA16 += ivaImporte;
      impuestoIVA = `Impuesto=002,TipoFactor=Tasa,TasaOCuota=0.160000,Base=${baseIVA.toFixed(2)},Importe=${ivaImporte.toFixed(2)}`;
    } else {
      impuestoIVA = `Impuesto=002,TipoFactor=Exento`;
    }

    // IEPS (si aplica)
    let impuestoIEPS = "";
    if (item.ieps && Number(item.ieps) > 0) {
      const baseIEPS = importe;
      const tasaIEPS = Number(item.ieps) / 100;
      const iepsImporte = +(baseIEPS * tasaIEPS).toFixed(2);
      totalIEPS += iepsImporte;
      impuestoIEPS = `;Impuesto=003,TipoFactor=Tasa,TasaOCuota=${tasaIEPS.toFixed(6)},Base=${baseIEPS.toFixed(2)},Importe=${iepsImporte.toFixed(2)}`;
    }

    lines.push([
      `ClaveProdServ=${item.clave_prod_serv || "01010101"}`,
      `Cantidad=${cantidad}`,
      `ClaveUnidad=${item.clave_unidad || "H87"}`,
      `Descripcion=${item.descripcion}`,
      `ValorUnitario=${valorUnitario.toFixed(2)}`,
      `Importe=${importe.toFixed(2)}`,
      impuestoIVA + impuestoIEPS
    ].join(sep));
  });

  // ======================
  // [IMPUESTOS] — Globales
  // ======================
  lines.push("[IMPUESTOS]");
  const totalImpuestosTrasladados = +(totalIVA16 + totalIEPS).toFixed(2);

  lines.push([
    `TotalImpuestosTrasladados=${totalImpuestosTrasladados.toFixed(2)}`,
    totalIVA16 > 0 ? `IVA16=${totalIVA16.toFixed(2)}` : "",
    totalIEPS > 0 ? `IEPS=${totalIEPS.toFixed(2)}` : ""
  ].filter(Boolean).join(sep));

  // ======================
  // TOTAL
  // ======================
  const total = +(subtotal + totalImpuestosTrasladados).toFixed(2);
  lines.push(`Total=${total.toFixed(2)}`);

  return lines.join("\n");
}


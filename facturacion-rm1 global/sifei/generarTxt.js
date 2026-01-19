/**
 * Prorratea BASE / IVA / IEPS globales por ticket
 * SIN redondear hasta el final
 */
function prorratearGlobal({
  tickets,           // [{ total }]
  baseGlobal,
  ivaGlobal,
  iepsGlobal
}) {
  const totalGlobal = tickets.reduce((s, t) => s + t.total, 0);

  return tickets.map(t => {
    const factor = t.total / totalGlobal;

    return {
      ...t,
      baseCalc:  baseGlobal  * factor,
      ivaCalc:   ivaGlobal   * factor,
      iepsCalc:  iepsGlobal  * factor
    };
  });
}
/**
 * Aplica redondeo SAT y ajusta el último concepto
 */
function aplicarRedondeoSAT({
  conceptos,
  baseGlobal,
  ivaGlobal,
  iepsGlobal
}) {

  // acumulados SIN redondear
  const sumBase  = conceptos.reduce((s,c)=>s+c.baseCalc,0);
  const sumIVA   = conceptos.reduce((s,c)=>s+c.ivaCalc,0);
  const sumIEPS  = conceptos.reduce((s,c)=>s+c.iepsCalc,0);

  // redondeo SAT (solo aquí)
  const baseSAT  = round2(baseGlobal);
  const ivaSAT   = round2(ivaGlobal);
  const iepsSAT  = round2(iepsGlobal);

  // ajustes
  const ajusteBase  = baseSAT  - round2(sumBase);
  const ajusteIVA   = ivaSAT   - round2(sumIVA);
  const ajusteIEPS  = iepsSAT  - round2(sumIEPS);

  // clonar conceptos
  const out = conceptos.map(c => ({
    ...c,
    base:  round6(c.baseCalc),
    iva:   round6(c.ivaCalc),
    ieps:  round6(c.iepsCalc)
  }));

  // 🔥 el último paga los centavos
  const last = out.length - 1;
  out[last].base  = round6(out[last].base  + ajusteBase);
  out[last].iva   = round6(out[last].iva   + ajusteIVA);
  out[last].ieps  = round6(out[last].ieps  + ajusteIEPS);

  return out;
}
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round6(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}
// tickets del día
const tickets = ventasGlobal.map(v => ({
  folio: v.folio,
  total: Number(v.resumen_financiero.total)
}));

// totales globales
const baseGlobal = ventasGlobal.reduce((s,v)=>s+v.resumen_financiero.subtotal,0);
const ivaGlobal  = ventasGlobal.reduce((s,v)=>s+(v.resumen_financiero.iva||0),0);
const iepsGlobal = ventasGlobal.reduce((s,v)=>s+(v.resumen_financiero.ieps||0),0);

// 1️⃣ prorrateo
const prorrateados = prorratearGlobal({
  tickets,
  baseGlobal,
  ivaGlobal,
  iepsGlobal
});

// 2️⃣ redondeo SAT
const conceptosFinales = aplicarRedondeoSAT({
  conceptos: prorrateados,
  baseGlobal,
  ivaGlobal,
  iepsGlobal
});
const conceptosCFDI = conceptosFinales.map((c, idx) => {
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

    IEPSTasa: (tieneIEPS && c.base > 0) ? (c.ieps / c.base) : 0,
    IEPSImporte: tieneIEPS ? c.ieps : 0
  };
});
const BaseIVA16     = round2(
  conceptosCFDI.reduce((s,c)=>s+(c.TasaIVA>0?c.Base:0),0)
);
const IVA16Importe = round2(
  conceptosCFDI.reduce((s,c)=>s+c.IVAImporte,0)
);

const BaseIEPS     = round2(
  conceptosCFDI.reduce((s,c)=>s+(c.IEPSTasa>0?c.Base:0),0)
);
const IEPSImporte  = round2(
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
  IEPSTasa: BaseIEPS > 0 ? round6(IEPSImporte / BaseIEPS) : 0,

  Conceptos: conceptosCFDI
};
console.assert(
  round2(Subtotal + IVA16Importe + IEPSImporte) === round2(Total),
  "❌ Totales inconsistentes"
);
const txtSifei = convertirCFDIGlobalASifei(cfdiObj);


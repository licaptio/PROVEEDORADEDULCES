export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round6(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

/**
 * Prorratea BASE / IVA / IEPS globales por ticket
 * SIN redondear hasta el final
 */
export function prorratearGlobal({
  tickets,
  baseGlobal,
  ivaGlobal,
  iepsGlobal
}) {
  const totalGlobal = tickets.reduce((s, t) => s + t.total, 0);

  return tickets.map(t => {
    const factor = totalGlobal > 0 ? t.total / totalGlobal : 0;

    return {
      ...t,
      baseCalc: baseGlobal * factor,
      ivaCalc: ivaGlobal * factor,
      iepsCalc: iepsGlobal * factor
    };
  });
}

/**
 * Redondeo SAT + ajuste al último concepto
 */
export function aplicarRedondeoSAT({
  conceptos,
  baseGlobal,
  ivaGlobal,
  iepsGlobal
}) {
  const sumBase = conceptos.reduce((s,c)=>s+c.baseCalc,0);
  const sumIVA  = conceptos.reduce((s,c)=>s+c.ivaCalc,0);
  const sumIEPS = conceptos.reduce((s,c)=>s+c.iepsCalc,0);

  const baseSAT = round2(baseGlobal);
  const ivaSAT  = round2(ivaGlobal);
  const iepsSAT = round2(iepsGlobal);

  const ajusteBase = baseSAT - round2(sumBase);
  const ajusteIVA  = ivaSAT  - round2(sumIVA);
  const ajusteIEPS = iepsSAT - round2(sumIEPS);

  const out = conceptos.map(c => ({
    ...c,
    base: round6(c.baseCalc),
    iva: round6(c.ivaCalc),
    ieps: round6(c.iepsCalc)
  }));

  const last = out.length - 1;
  if (last >= 0) {
    out[last].base = round6(out[last].base + ajusteBase);
    out[last].iva  = round6(out[last].iva  + ajusteIVA);
    out[last].ieps = round6(out[last].ieps + ajusteIEPS);
  }

  return out;
}

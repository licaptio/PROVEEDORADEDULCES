import { round2, round6 } from "../prorrateoSAT.js";

/**
 * EXPORT ÚNICO
 */
export function convertirCFDIGlobalASifei(cfdi) {

  if (!cfdi || !Array.isArray(cfdi.Conceptos)) {
    throw new Error("CFDI inválido");
  }

  const out = [];

  // 01 CABECERA
  out.push([
    "01","FA","4.0",
    cfdi.Serie,
    cfdi.Folio,
    cfdi.FormaPago,
    cfdi.NumCertificado || "",
    "CONTADO",
    round2(cfdi.Subtotal).toFixed(2),
    "0.00",
    cfdi.Moneda,
    "1",
    round2(cfdi.Total).toFixed(2),
    "Ingreso",
    cfdi.MetodoPago,
    cfdi.CPExpedicion || "",
    "",
    "EMISOR",
    cfdi.RfcEmisor || "",
    cfdi.RazonEmisor || "",
    cfdi.RegimenFiscal || "",
    "RECEPTOR",
    cfdi.RfcReceptor || "XAXX010101000",
    cfdi.NombreReceptor || "PUBLICO EN GENERAL",
    "",
    "",
    "S01",
    "",
    "",
    round2((cfdi.IVA16Importe||0)+(cfdi.IEPSImporte||0)).toFixed(2),
    "INFO_ADIC",
    "",
    "",
    "",
    "",
    "",
    "N"
  ].join("|"));

  // INFO_GLOBAL
  const f = new Date(cfdi.Fecha);
  out.push([
    "01","CFDI40","01","INFO_GLOBAL",
    "01",
    String(f.getMonth()+1).padStart(2,"0"),
    f.getFullYear(),
    "EMISOR","",
    "RECEPTOR",
    cfdi.CPReceptor || "",
    cfdi.RegimenReceptor || ""
  ].join("|"));

  // CONCEPTOS
  cfdi.Conceptos.forEach((c,i)=>{
    const tieneImp = c.TasaIVA>0 || c.IEPSTasa>0;

    out.push([
      "03",
      i+1,
      "1.000",
      "ACT",
      "",
      "01010101",
      "",
      c.Descripcion,
      round6(c.Base).toFixed(6),
      "0.00",
      round6(c.Base).toFixed(6),
      "",
      tieneImp ? "02" : "01"
    ].join("|"));

    if (c.TasaIVA>0){
      out.push([
        "03-IMP","TRASLADO",
        round6(c.Base).toFixed(6),
        "002","Tasa","0.160000",
        round6(c.IVAImporte).toFixed(6)
      ].join("|"));
    }

    if (c.IEPSTasa>0){
      out.push([
        "03-IMP","TRASLADO",
        round6(c.Base).toFixed(6),
        "003","Tasa",
        round6(c.IEPSTasa).toFixed(6),
        round6(c.IEPSImporte).toFixed(6)
      ].join("|"));
    }
  });

  return out.join("\n");
}


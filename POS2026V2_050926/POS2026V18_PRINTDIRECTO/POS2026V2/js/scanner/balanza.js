export function decodificarBalanza(codigo) {

  if (!codigo.startsWith("2")) {
    return { esBalanza:false };
  }

  const codigoProducto = codigo.substring(0,7);
  const pesoKg = parseFloat(
    codigo.substring(7,12)
  ) / 1000;

  return {
    esBalanza:true,
    codigoProducto,
    pesoKg
  };
}

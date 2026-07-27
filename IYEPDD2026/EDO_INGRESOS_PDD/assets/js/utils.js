window.AppUtils = (() => {
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril",
    "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const moneda = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const entero = new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 0
  });

  function numero(valor) {
    const resultado = Number(valor);
    return Number.isFinite(resultado) ? resultado : 0;
  }

  function formatoMoneda(valor) {
    return moneda.format(numero(valor));
  }

  function formatoEntero(valor) {
    return entero.format(numero(valor));
  }

  function nombreMes(mes) {
    return meses[Number(mes) - 1] || "";
  }

  return {
    meses,
    numero,
    formatoMoneda,
    formatoEntero,
    nombreMes
  };
})();

window.AppApi = (() => {
  let cliente = null;

  function validarConfiguracion() {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      SUPABASE_URL.includes("PEGA_AQUI") ||
      SUPABASE_ANON_KEY.includes("PEGA_AQUI")
    ) {
      throw new Error(
        "Configura SUPABASE_URL y SUPABASE_ANON_KEY en assets/js/config.js"
      );
    }
  }

  function obtenerCliente() {
    validarConfiguracion();

    if (!cliente) {
      cliente = window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );
    }

    return cliente;
  }

  async function consultarIngresosMensuales(anio, mes) {
    const supabase = obtenerCliente();

    const { data, error } = await supabase.rpc(
      "obtener_ingresos_mensuales",
      {
        p_anio: anio,
        p_mes: mes
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return Array.isArray(data) ? data : [];
  }

  /*
   * El acumulado anual se forma consultando la función mensual mes por mes.
   * Así se evita que PostgreSQL expanda en una sola consulta todos los conceptos
   * del año y alcance el statement timeout.
   *
   * Se ejecutan máximo 3 meses a la vez para no saturar la base.
   */
  async function consultarIngresosAnuales(anio, alProgreso = null) {
    const meses = Array.from({ length: 12 }, (_, indice) => indice + 1);
    const resultados = [];
    const concurrencia = 3;

    for (let inicio = 0; inicio < meses.length; inicio += concurrencia) {
      const lote = meses.slice(inicio, inicio + concurrencia);

      const respuestas = await Promise.all(
        lote.map(mes => consultarIngresosMensuales(anio, mes))
      );

      respuestas.forEach(datosMes => resultados.push(...datosMes));

      if (typeof alProgreso === "function") {
        alProgreso(Math.min(inicio + lote.length, 12), 12);
      }
    }

    return acumularPorTipo(resultados, anio);
  }

  function acumularPorTipo(registros, anio) {
    const camposNumericos = [
      "cantidad_facturas",
      "cantidad_conceptos",
      "ventas_al_0",
      "ventas_con_iva",
      "ventas_con_ieps",
      "ventas_con_iva_ieps",
      "venta_neta_total",
      "iva_total",
      "ieps_total",
      "impuestos_total",
      "total_facturado"
    ];

    const acumulados = new Map();

    for (const registro of registros) {
      const tipo = registro.tipo_venta || "POR_REVISAR";

      if (!acumulados.has(tipo)) {
        acumulados.set(tipo, {
          anio,
          tipo_venta: tipo,
          cantidad_facturas: 0,
          cantidad_conceptos: 0,
          ventas_al_0: 0,
          ventas_con_iva: 0,
          ventas_con_ieps: 0,
          ventas_con_iva_ieps: 0,
          venta_neta_total: 0,
          iva_total: 0,
          ieps_total: 0,
          impuestos_total: 0,
          total_facturado: 0
        });
      }

      const destino = acumulados.get(tipo);

      for (const campo of camposNumericos) {
        const valor = Number(registro[campo]);
        destino[campo] += Number.isFinite(valor) ? valor : 0;
      }
    }

    return Array.from(acumulados.values());
  }

  return {
    consultarIngresosMensuales,
    consultarIngresosAnuales
  };
})();

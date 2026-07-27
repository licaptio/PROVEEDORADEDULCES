window.AppUI = (() => {
  const U = window.AppUtils;

  const filas = [
    ["Ventas al 0", "ventas_al_0"],
    ["Ventas con IVA", "ventas_con_iva"],
    ["Ventas con IEPS", "ventas_con_ieps"],
    ["Ventas con IVA + IEPS", "ventas_con_iva_ieps"],
    ["Venta neta", "venta_neta_total", "separador total"],
    ["IVA trasladado", "iva_total"],
    ["IEPS trasladado", "ieps_total"],
    ["Total impuestos", "impuestos_total", "total"],
    ["Total facturado", "total_facturado", "total-final"]
  ];

  const idsPeriodo = {
    Mensual: {
      facturas: "facturasMensuales",
      ventaNeta: "ventaNetaMensual",
      iva: "ivaMensual",
      ieps: "iepsMensual",
      total: "totalMensual",
      facturasContado: "facturasMensualContado",
      facturasCredito: "facturasMensualCredito",
      tablaContado: "tablaMensualContado",
      tablaCredito: "tablaMensualCredito"
    },
    Anual: {
      facturas: "facturasAnuales",
      ventaNeta: "ventaNetaAnual",
      iva: "ivaAnual",
      ieps: "iepsAnual",
      total: "totalAnual",
      facturasContado: "facturasAnualContado",
      facturasCredito: "facturasAnualCredito",
      tablaContado: "tablaAnualContado",
      tablaCredito: "tablaAnualCredito"
    }
  };

  function elemento(id) {
    const nodo = document.getElementById(id);

    if (!nodo) {
      throw new Error(`No se encontró el elemento HTML #${id}`);
    }

    return nodo;
  }

  function mostrarEstado(mensaje = "", tipo = "") {
    const nodo = elemento("estado");
    nodo.textContent = mensaje;
    nodo.className = "estado";

    if (tipo) {
      nodo.classList.add(`estado--${tipo}`);
    }
  }

  function activarCarga(cargando) {
    const boton = elemento("btnConsultar");
    boton.disabled = cargando;
    boton.textContent = cargando ? "Consultando..." : "Consultar ingresos";
  }

  function llenarFiltros() {
    const ahora = new Date();
    const anioActual = ahora.getFullYear();
    const mesActual = ahora.getMonth() + 1;
    const selectAnio = elemento("anio");
    const selectMes = elemento("mes");

    for (let anio = anioActual; anio >= anioActual - 8; anio -= 1) {
      const option = document.createElement("option");
      option.value = anio;
      option.textContent = anio;
      selectAnio.appendChild(option);
    }

    U.meses.forEach((nombre, indice) => {
      const option = document.createElement("option");
      option.value = indice + 1;
      option.textContent = nombre;
      selectMes.appendChild(option);
    });

    selectAnio.value = anioActual;
    selectMes.value = mesActual;
  }

  function registroVacio(tipoVenta) {
    return {
      tipo_venta: tipoVenta,
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
    };
  }

  function obtenerTipo(datos, tipoVenta) {
    return datos.find(item => item.tipo_venta === tipoVenta)
      || registroVacio(tipoVenta);
  }

  function crearTabla(registro) {
    const tieneDatos =
      U.numero(registro.cantidad_facturas) > 0 ||
      U.numero(registro.total_facturado) !== 0;

    if (!tieneDatos) {
      return '<div class="sin-datos">Sin movimientos en este periodo.</div>';
    }

    const cuerpo = filas.map(([etiqueta, campo, clase = ""]) => `
      <tr class="${clase}">
        <td>${etiqueta}</td>
        <td>${U.formatoMoneda(registro[campo])}</td>
      </tr>
    `).join("");

    return `
      <table class="tabla-ingresos">
        <tbody>${cuerpo}</tbody>
      </table>
    `;
  }

  function sumar(registros, campo) {
    return registros.reduce(
      (total, registro) => total + U.numero(registro[campo]),
      0
    );
  }

  function renderizarPeriodo(datos, tipoPeriodo) {
    const ids = idsPeriodo[tipoPeriodo];

    if (!ids) {
      throw new Error(`Periodo no reconocido: ${tipoPeriodo}`);
    }

    const contado = obtenerTipo(datos, "CONTADO");
    const credito = obtenerTipo(datos, "CREDITO");
    const visibles = [contado, credito];

    elemento(ids.facturas).textContent = U.formatoEntero(
      sumar(visibles, "cantidad_facturas")
    );

    elemento(ids.ventaNeta).textContent = U.formatoMoneda(
      sumar(visibles, "venta_neta_total")
    );

    elemento(ids.iva).textContent = U.formatoMoneda(
      sumar(visibles, "iva_total")
    );

    elemento(ids.ieps).textContent = U.formatoMoneda(
      sumar(visibles, "ieps_total")
    );

    elemento(ids.total).textContent = U.formatoMoneda(
      sumar(visibles, "total_facturado")
    );

    elemento(ids.facturasContado).textContent =
      `${U.formatoEntero(contado.cantidad_facturas)} facturas`;

    elemento(ids.facturasCredito).textContent =
      `${U.formatoEntero(credito.cantidad_facturas)} facturas`;

    elemento(ids.tablaContado).innerHTML = crearTabla(contado);
    elemento(ids.tablaCredito).innerHTML = crearTabla(credito);
  }

  function renderizar({ mensual, anual, anio, mes }) {
    elemento("tituloMensual").textContent = U.nombreMes(mes);
    elemento("periodoMensual").textContent = `${U.nombreMes(mes)} de ${anio}`;
    elemento("periodoAnual").textContent = `Enero a diciembre de ${anio}`;

    renderizarPeriodo(mensual, "Mensual");
    renderizarPeriodo(anual, "Anual");

    elemento("contenido").classList.remove("oculto");
  }

  function ocultarContenido() {
    elemento("contenido").classList.add("oculto");
  }

  return {
    mostrarEstado,
    activarCarga,
    llenarFiltros,
    renderizar,
    ocultarContenido
  };
})();

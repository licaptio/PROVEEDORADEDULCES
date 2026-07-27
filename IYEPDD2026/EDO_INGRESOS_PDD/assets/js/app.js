document.addEventListener("DOMContentLoaded", () => {
  const UI = window.AppUI;
  const API = window.AppApi;

  UI.llenarFiltros();

  const selectAnio = document.getElementById("anio");
  const selectMes = document.getElementById("mes");
  const boton = document.getElementById("btnConsultar");

  async function consultar() {
    const anio = Number(selectAnio.value);
    const mes = Number(selectMes.value);

    UI.activarCarga(true);
    UI.mostrarEstado("Consultando el mes seleccionado...");
    UI.ocultarContenido();

    try {
      const mensual = await API.consultarIngresosMensuales(anio, mes);

      UI.mostrarEstado("Calculando acumulado anual: 0 de 12 meses...");

      const anual = await API.consultarIngresosAnuales(
        anio,
        (procesados, total) => {
          UI.mostrarEstado(
            `Calculando acumulado anual: ${procesados} de ${total} meses...`
          );
        }
      );

      UI.renderizar({ mensual, anual, anio, mes });

      if (mensual.length === 0 && anual.length === 0) {
        UI.mostrarEstado("No se encontraron ingresos para el periodo seleccionado.");
      } else {
        UI.mostrarEstado("Consulta completada.", "ok");
      }
    } catch (error) {
      console.error(error);
      UI.mostrarEstado(
        error.message || "No fue posible consultar los ingresos.",
        "error"
      );
    } finally {
      UI.activarCarga(false);
    }
  }

  boton.addEventListener("click", consultar);
  consultar();
});

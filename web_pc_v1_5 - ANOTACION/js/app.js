import {
  actualizarRecordatorio,
  crearRecordatorio,
  guardarImagenesRecordatorio,
  marcarRecordatorioAtendido,
  obtenerRecordatoriosPendientes
} from "./firestore.js";
import { eliminarImagenes, subirImagenes } from "./storage.js";
import {
  cerrarEditorForzado,
  establecerFechaHoraPredeterminada,
  establecerGuardando,
  establecerGuardandoEditor,
  inicializarCapturaImagenes,
  inicializarEditor,
  inicializarVisor,
  limpiarFormulario,
  marcarEditorLimpio,
  mostrarEstadoConexion,
  mostrarMensaje,
  mostrarMensajeEditor,
  obtenerArchivosSeleccionados,
  obtenerDatosEditor,
  obtenerDatosFormulario,
  renderizarRecordatorios,
  validarFormulario
} from "./ui.js";

formRecordatorio.addEventListener("submit", async e => {
  e.preventDefault();
  mostrarMensaje("");

  const datos = obtenerDatosFormulario();
  const error = validarFormulario(datos);
  if (error) {
    mostrarMensaje(error, "error");
    return;
  }

  establecerGuardando(true);

  try {
    const archivos = obtenerArchivosSeleccionados();
    const id = await crearRecordatorio(datos);

    if (archivos.length) {
      const imagenes = await subirImagenes(id, archivos, (actual, total) => {
        establecerGuardando(true, `Subiendo ${actual} de ${total}...`);
      });
      await guardarImagenesRecordatorio(id, imagenes);
    }

    mostrarMensaje(`Recordatorio guardado correctamente. ID: ${id}`, "success");
    limpiarFormulario();
    await cargarListado();
  } catch (error) {
    console.error("app.js | Error al guardar:", error);
    const ayuda = error.code === "storage/unauthorized"
      ? " Revisa las reglas de Storage incluidas en storage.rules."
      : "";
    mostrarMensaje(`No se pudo guardar: ${error.message}.${ayuda}`, "error");
  } finally {
    establecerGuardando(false);
  }
});

formEditor.addEventListener("submit", async e => {
  e.preventDefault();
  mostrarMensajeEditor("");

  const datos = obtenerDatosEditor();
  const cantidadFinal = datos.imagenesExistentes.length + datos.archivosNuevos.length;
  const error = validarFormulario(datos, cantidadFinal);

  if (error) {
    mostrarMensajeEditor(error, "error");
    return;
  }

  establecerGuardandoEditor(true);

  try {
    let nuevasImagenes = [];

    if (datos.archivosNuevos.length) {
      nuevasImagenes = await subirImagenes(datos.id, datos.archivosNuevos, (actual, total) => {
        establecerGuardandoEditor(true, `Subiendo ${actual} de ${total}...`);
      });
    }

    await actualizarRecordatorio(datos.id, {
      fecha: datos.fecha,
      hora: datos.hora,
      contenido: datos.contenido,
      imagenes: [...datos.imagenesExistentes, ...nuevasImagenes]
    });

    if (datos.imagenesEliminadas.length) {
      await eliminarImagenes(datos.imagenesEliminadas);
    }

    marcarEditorLimpio();
    cerrarEditorForzado();
    mostrarMensaje("Recordatorio actualizado correctamente.", "success");
    await cargarListado();
  } catch (error) {
    console.error("app.js | Error al editar:", error);
    mostrarMensajeEditor(`No se pudo guardar: ${error.message}`, "error");
  } finally {
    establecerGuardandoEditor(false);
  }
});

btnAtendido.addEventListener("click", async () => {
  const datos = obtenerDatosEditor();
  if (!datos.id) return;

  if (!confirm("¿Marcar este recordatorio como atendido?")) return;

  establecerGuardandoEditor(true, "Marcando...");
  mostrarMensajeEditor("");

  try {
    await marcarRecordatorioAtendido(datos.id);
    marcarEditorLimpio();
    cerrarEditorForzado();
    mostrarMensaje("Recordatorio marcado como atendido.", "success");
    await cargarListado();
  } catch (error) {
    console.error("app.js | Error al marcar atendido:", error);
    mostrarMensajeEditor(`No se pudo marcar como atendido: ${error.message}`, "error");
  } finally {
    establecerGuardandoEditor(false);
  }
});

btnLimpiar.addEventListener("click", () => {
  limpiarFormulario();
  mostrarMensaje("");
});

btnRecargar.addEventListener("click", cargarListado);

async function cargarListado() {
  mostrarEstadoConexion("Consultando Firebase...");

  try {
    const recordatorios = await obtenerRecordatoriosPendientes();
    renderizarRecordatorios(recordatorios);
    mostrarEstadoConexion("Firebase conectado", "ok");
  } catch (error) {
    console.error("app.js | Error al consultar:", error);
    mostrarEstadoConexion("Error de conexión", "error");
    mostrarMensaje(`Error al consultar: ${error.message}`, "error");
  }
}

inicializarCapturaImagenes();
inicializarEditor();
inicializarVisor();
establecerFechaHoraPredeterminada();
cargarListado();

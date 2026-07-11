import { procesar } from "./procesador.js";

const estado = {
  articulosHandle: null,
  preciosHandle: null,
  equivalentesHandle: null
};

const $ = selector => document.querySelector(selector);

const btnArticulos = $("#btnArticulos");
const btnPrecios = $("#btnPrecios");
const btnEquiv = $("#btnEquiv");
const btnSeleccionarTodos = $("#btnSeleccionarTodos");
const btnProcesar = $("#btnProcesar");

const overlay = $("#overlay");
const mensaje = $("#mensaje");
const estadoGeneral = $("#estadoGeneral");

function soportado() {
  return "showOpenFilePicker" in window;
}

function nombreCorrecto(handle, esperado) {
  return String(handle?.name || "").toLowerCase() === esperado.toLowerCase();
}

function actualizarUI() {
  $("#estadoArticulos").textContent =
    estado.articulosHandle?.name || "No seleccionado";

  $("#estadoPrecios").textContent =
    estado.preciosHandle?.name || "No seleccionado";

  $("#estadoEquiv").textContent =
    estado.equivalentesHandle?.name || "No seleccionado";

  btnProcesar.disabled = !(
    estado.articulosHandle &&
    estado.preciosHandle &&
    estado.equivalentesHandle
  );
}

async function seleccionarArchivo(esperado) {
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [
      {
        description: "Archivo TXT",
        accept: {
          "text/plain": [".txt"]
        }
      }
    ]
  });

  if (!nombreCorrecto(handle, esperado)) {
    throw new Error(
      `Seleccionaste "${handle.name}", pero se esperaba "${esperado}".`
    );
  }

  const permiso = await handle.requestPermission({
    mode: "readwrite"
  });

  if (permiso !== "granted") {
    throw new Error(
      `No se concedió permiso de lectura y escritura para ${esperado}.`
    );
  }

  return handle;
}

async function seleccionarArticulos() {
  estado.articulosHandle = await seleccionarArchivo("articulos.txt");
  actualizarUI();
}

async function seleccionarPrecios() {
  estado.preciosHandle = await seleccionarArchivo("precant.txt");
  actualizarUI();
}

async function seleccionarEquiv() {
  estado.equivalentesHandle = await seleccionarArchivo("equiv.txt");
  actualizarUI();
}

async function ejecutarSeleccionSegura(fn) {
  try {
    await fn();
  } catch (error) {
    if (error?.name !== "AbortError") {
      window.alert(error.message);
    }
  }
}

async function seleccionarTodos() {
  try {
    estado.articulosHandle = await seleccionarArchivo("articulos.txt");
    actualizarUI();

    estado.preciosHandle = await seleccionarArchivo("precant.txt");
    actualizarUI();

    estado.equivalentesHandle = await seleccionarArchivo("equiv.txt");
    actualizarUI();
  } catch (error) {
    if (error?.name !== "AbortError") {
      window.alert(error.message);
    }
  }
}

function pintarResultado(resultado) {
  const resumen = resultado?.resumen || {};

  $("#productosLeidos").textContent =
    Number(resumen.productosLeidos || 0).toLocaleString("es-MX");

  $("#productosNuevos").textContent =
    Number(resumen.productosNuevos || 0).toLocaleString("es-MX");

  $("#productosReactivados").textContent =
    Number(resumen.productosReactivados || 0).toLocaleString("es-MX");

  $("#actualizados").textContent =
    Number(resumen.actualizados || 0).toLocaleString("es-MX");

  mensaje.textContent = resultado?.mensaje || "Proceso terminado.";
  mensaje.className = `mensaje ${resultado?.ok === false ? "error" : "success"}`;

  estadoGeneral.textContent =
    resultado?.ok === false ? "Error" : "Completado";

  estadoGeneral.className =
    `badge ${resultado?.ok === false ? "error" : "success"}`;

  $("#detalle").textContent = JSON.stringify(resultado, null, 2);
}

async function ejecutarProceso() {
  const confirmar = window.confirm(
    "¿Deseas procesar los tres archivos y vaciarlos a 0 bytes al finalizar correctamente?"
  );

  if (!confirmar) return;

  overlay.classList.remove("oculto");
  btnProcesar.disabled = true;

  estadoGeneral.textContent = "Procesando";
  estadoGeneral.className = "badge warning";

  mensaje.textContent = "Procesando información...";
  mensaje.className = "mensaje warning";

  try {
    const resultado = await procesar({
      articulosHandle: estado.articulosHandle,
      preciosHandle: estado.preciosHandle,
      equivalentesHandle: estado.equivalentesHandle
    });

    pintarResultado(resultado);
  } catch (error) {
    const resultadoError = {
      ok: false,
      mensaje: "No fue posible completar el proceso.",
      error: error?.message || String(error)
    };

    pintarResultado(resultadoError);
  } finally {
    overlay.classList.add("oculto");
    actualizarUI();
  }
}

btnArticulos.addEventListener(
  "click",
  () => ejecutarSeleccionSegura(seleccionarArticulos)
);

btnPrecios.addEventListener(
  "click",
  () => ejecutarSeleccionSegura(seleccionarPrecios)
);

btnEquiv.addEventListener(
  "click",
  () => ejecutarSeleccionSegura(seleccionarEquiv)
);

btnSeleccionarTodos.addEventListener("click", seleccionarTodos);
btnProcesar.addEventListener("click", ejecutarProceso);

if (!soportado()) {
  estadoGeneral.textContent = "No compatible";
  estadoGeneral.className = "badge error";

  mensaje.textContent =
    "Este navegador no soporta selección de archivos con escritura. Usa Chrome o Edge actualizado.";

  mensaje.className = "mensaje error";

  btnArticulos.disabled = true;
  btnPrecios.disabled = true;
  btnEquiv.disabled = true;
  btnSeleccionarTodos.disabled = true;
}

actualizarUI();

import { obtenerFotosProducto } from "../catalogo/catalogo.js";

let fotosActuales = [];
let indiceActual = 0;
let timerFotos = null;

const LOGO_DEFAULT = "./assets/logo_proveedora.webp";

export function mostrarFotosPorCodigoLocal(codigo) {

  const fotos = obtenerFotosProducto(codigo);

  mostrarFotos(fotos);
}

export function limpiarFotoProducto() {

  detenerRotacion();

  const img =
    document.getElementById("fotoProductoActual");

  const contador =
    document.getElementById("contadorFotosProducto");

  if (img) {
    img.src = LOGO_DEFAULT;
  }

  if (contador) {
    contador.classList.add("oculto");
    contador.textContent = "";
  }
}

function mostrarFotos(fotos = []) {

  const img =
    document.getElementById("fotoProductoActual");

  const contador =
    document.getElementById("contadorFotosProducto");

  if (!img) return;

  detenerRotacion();

  fotosActuales = Array.isArray(fotos)
    ? fotos.filter(Boolean)
    : [];

  indiceActual = 0;

  if (fotosActuales.length === 0) {

    img.src = LOGO_DEFAULT;

    if (contador) {
      contador.classList.add("oculto");
      contador.textContent = "";
    }

    return;
  }

  img.src = fotosActuales[0];

  if (contador) {

    contador.textContent =
      `1/${fotosActuales.length}`;

    if (fotosActuales.length > 1) {
      contador.classList.remove("oculto");
    } else {
      contador.classList.add("oculto");
    }

  }

  if (fotosActuales.length > 1) {

    timerFotos = setInterval(() => {

      indiceActual++;

      if (indiceActual >= fotosActuales.length) {
        indiceActual = 0;
      }

      img.src = fotosActuales[indiceActual];

      if (contador) {

        contador.textContent =
          `${indiceActual + 1}/${fotosActuales.length}`;

      }

    }, 2500);

  }
}

function detenerRotacion() {

  if (timerFotos) {
    clearInterval(timerFotos);
    timerFotos = null;
  }

}
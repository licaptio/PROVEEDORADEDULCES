import { obtenerProximoFolioVenta } from "../ventas/guardarVenta.js";

export function actualizarFolioVisible(folio) {
  const lblFolio = document.getElementById("folioVenta");

  if (lblFolio) {
    lblFolio.textContent = folio || "SIN FOLIO";
  }
}

export async function pintarProximoFolio() {
  try {

    actualizarFolioVisible("Cargando...");

    const proximo = await obtenerProximoFolioVenta();

    actualizarFolioVisible(proximo);

  } catch (err) {

    console.error("Error obteniendo próximo folio:", err);

    actualizarFolioVisible("ERROR");
  }
}
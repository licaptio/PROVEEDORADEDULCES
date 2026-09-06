import { obtenerDatoLocal } from "../catalogo/indexeddb.js";

export async function obtenerUsuarioActivo() {
  return obtenerDatoLocal("usuario_ruta", null);
}

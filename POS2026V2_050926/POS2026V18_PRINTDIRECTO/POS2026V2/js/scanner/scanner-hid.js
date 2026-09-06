let buffer = "";

export function procesarHID(tecla) {
  buffer += tecla;
  return buffer;
}

export function limpiarHID() {
  buffer = "";
}

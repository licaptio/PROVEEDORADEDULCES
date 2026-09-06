export function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "flex";
}

export function cerrarModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

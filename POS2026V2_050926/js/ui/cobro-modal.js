export function abrirCobro(modalId="modalCobro") {

  const modal = document.getElementById(modalId);

  if (modal) {
    modal.style.display = "flex";
  }
}

export function cerrarCobro(modalId="modalCobro") {

  const modal = document.getElementById(modalId);

  if (modal) {
    modal.style.display = "none";
  }
}

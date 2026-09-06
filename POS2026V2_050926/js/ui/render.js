export function renderTabla(tbodyId, html) {
  const tbody = document.getElementById(tbodyId);

  if (!tbody) return;

  tbody.innerHTML = html;
}

export function limpiarContenedor(id) {
  const el = document.getElementById(id);

  if (el) el.innerHTML = "";
}

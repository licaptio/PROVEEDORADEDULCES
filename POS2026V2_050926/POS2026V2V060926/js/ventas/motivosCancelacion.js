export const MOTIVOS_CANCELACION = [
  { codigo: "CLIENTE_CANCELO", texto: "Cliente canceló la compra" },
  { codigo: "PAGO_NO_COMPLETADO", texto: "Cliente no completó el pago" },
  { codigo: "ERROR_CAPTURA", texto: "Error de captura" },
  { codigo: "PRODUCTO_CANTIDAD_INCORRECTA", texto: "Producto o cantidad incorrecta" },
  { codigo: "PRECIO_INCORRECTO", texto: "Precio incorrecto" }
];

export function seleccionarMotivoCancelacion(titulo = "Motivo de cancelación") {
  return new Promise(resolve => {
    document.getElementById("modalMotivoCancelacion")?.remove();

    const modal = document.createElement("div");
    modal.id = "modalMotivoCancelacion";
    modal.className = "modal visible";
    modal.innerHTML = `
      <div class="modal-contenido modal-motivo-espera">
        <h2>${titulo}</h2>
        <p>Selecciona una opción:</p>

        <div class="motivos-espera-grid">
          ${MOTIVOS_CANCELACION.map(m => `
            <button type="button" class="btnMotivoEspera btnMotivoCancelacion" data-codigo="${m.codigo}">
              ${m.texto}
            </button>
          `).join("")}
        </div>

        <div class="modal-acciones">
          <button type="button" id="btnCerrarMotivoCancelacion">Regresar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cerrar = valor => {
      modal.remove();
      resolve(valor);
    };

    modal.querySelectorAll(".btnMotivoCancelacion").forEach(btn => {
      btn.addEventListener("click", () => {
        cerrar(MOTIVOS_CANCELACION.find(m => m.codigo === btn.dataset.codigo) || null);
      });
    });

    modal.querySelector("#btnCerrarMotivoCancelacion")
      ?.addEventListener("click", () => cerrar(null));
  });
}

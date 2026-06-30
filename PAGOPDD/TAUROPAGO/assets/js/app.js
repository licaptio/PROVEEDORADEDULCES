import { initSecciones } from './secciones.js';
import { diagnostico, cargarListas, cargarFacturas } from './facturasSeleccion.js';
import { initModal } from './modalEnlace.js';
import { setFechaHoy, initPago } from './aplicacionPago.js';

(async function init(){
  initSecciones();
  initModal();
  initPago();
  setFechaHoy();
  await diagnostico();
  await cargarListas();
  await cargarFacturas();
})();

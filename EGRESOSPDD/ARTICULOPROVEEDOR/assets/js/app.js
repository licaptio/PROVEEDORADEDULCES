import {iniciarBuscadorConceptos} from './buscadorConceptos.js';
import {abrirDetalleFactura} from './facturaDetalle.js';
const vb=document.getElementById('vistaBuscador');
const vd=document.getElementById('vistaDetalleFactura');
document.getElementById('btnRegresarBuscador').onclick=()=>{vd.classList.remove('activa');vb.classList.add('activa');};
iniciarBuscadorConceptos({onSeleccionarFactura:async(id)=>{vb.classList.remove('activa');vd.classList.add('activa');await abrirDetalleFactura(id);}});

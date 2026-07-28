import { cargarProveedores } from './proveedores.js';
import './facturas.js';
import './calculos.js';
import './descuentos.js';
import './pagos.js';
import { mostrarLoader, ocultarLoader, setFechaHoy, toast, mostrarPantalla } from './ui.js';

async function init(){
  try{
    mostrarLoader('Cargando proveedores activos...');
    setFechaHoy();
    await cargarProveedores();
    mostrarLoader('Preparando módulo de pago a proveedores...');
    setTimeout(()=>{
      ocultarLoader();
      mostrarPantalla('pantallaInicio');
    }, 350);
  }catch(err){
    ocultarLoader();
    toast('Error al cargar datos iniciales');
    console.error(err);
    alert('Error al cargar datos iniciales:\n\n' + (err?.message || err));
  }
}

window.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape'){
    ['modalProveedor','modalDescOverlay','modalNotas'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.style.display = 'none';
    });
  }
});

window.mostrarPantalla = mostrarPantalla;
init();

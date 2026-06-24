export function $(id){ return document.getElementById(id); }

export function mostrarLoader(texto='Cargando datos...'){
  const loaderTexto = $('loaderTexto');
  if(loaderTexto) loaderTexto.textContent = texto;
  const loader = $('loader');
  if(loader) loader.classList.add('activo');
  const app = $('app');
  if(app) app.classList.add('oculto');
}

export function ocultarLoader(){
  const loader = $('loader');
  if(loader) loader.classList.remove('activo');
  const app = $('app');
  if(app) app.classList.remove('oculto');
}

export function mostrarPantalla(id){
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  const pantalla = $(id);
  if(pantalla) pantalla.classList.add('activa');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function toast(msg, ms=2800){
  const t = $('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('activo');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> t.classList.remove('activo'), ms);
}

export function money(n){
  return new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:2 }).format(Number(n || 0));
}

export function escapeHtml(str){
  return String(str || '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

export function formatearFechaCorta(fechaISO){
  if(!fechaISO) return '';
  const d = new Date(fechaISO);
  const dia = String(d.getDate()).padStart(2,'0');
  const mes = String(d.getMonth()+1).padStart(2,'0');
  const anio = String(d.getFullYear()).slice(-2);
  return `${dia}/${mes}/${anio}`;
}

export function diasTranscurridos(fechaISO){
  if(!fechaISO) return '';
  const hoy = new Date();
  const f = new Date(fechaISO);
  hoy.setHours(0,0,0,0); f.setHours(0,0,0,0);
  const dias = Math.floor((hoy - f) / (1000*60*60*24));
  return dias >= 0 ? `${dias} días` : '0 días';
}

export function setFechaHoy(){
  const d = new Date();
  const fechaPago = $('fechaPago');
  if(fechaPago) fechaPago.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

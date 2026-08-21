export function mostrarSeccion(nombre){
  document.querySelectorAll('.app-section').forEach(s=>s.classList.remove('activo'));
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('activo'));
  document.getElementById(`section-${nombre}`)?.classList.add('activo');
  document.querySelector(`.tab[data-section="${nombre}"]`)?.classList.add('activo');
}
export function initSecciones(){
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>mostrarSeccion(btn.dataset.section)));
  document.getElementById('btnIrRevision')?.addEventListener('click',()=>mostrarSeccion('revision'));
  document.getElementById('btnIrPago')?.addEventListener('click',()=>mostrarSeccion('pago'));
}

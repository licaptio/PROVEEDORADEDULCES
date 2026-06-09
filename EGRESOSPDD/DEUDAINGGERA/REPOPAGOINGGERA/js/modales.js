document.addEventListener('click', e=>{
  const cerrar=e.target.dataset?.cerrar;
  if(cerrar) cerrarModal(cerrar);
  if(e.target.classList.contains('modal')) e.target.classList.add('oculto');
});

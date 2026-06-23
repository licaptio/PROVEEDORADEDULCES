function toISODate(d){ return d.toISOString().slice(0,10); }
function sumarDias(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function inicioSemana(fecha, inicio=1){
  const d=new Date(fecha+'T00:00:00');
  const dia=d.getDay();
  const diff=(dia - inicio + 7) % 7;
  d.setDate(d.getDate()-diff);
  return d;
}
function finSemana(fecha, inicio=1){ return sumarDias(inicioSemana(fecha,inicio),6); }
function generarSemanas(cantidad=26){
  const inicio=Number(localStorage.getItem('provsoft_inicio_semana') ?? window.PROVSOFT_CONFIG.INICIO_SEMANA);
  const base=inicioSemana(hoyISO(), inicio);
  const semanas=[];
  for(let i=0;i<cantidad;i++){
    const ini=sumarDias(base, -7*i);
    const fin=sumarDias(ini, 6);
    semanas.push({ inicio:toISODate(ini), fin:toISODate(fin), texto:`${fechaMx(toISODate(ini))} al ${fechaMx(toISODate(fin))}` });
  }
  return semanas;
}
function cargarSelectorSemanas(){
  const sel=document.getElementById('selectorSemana');
  sel.innerHTML='';
  generarSemanas(40).forEach((s,i)=>{
    const op=document.createElement('option');
    op.value=`${s.inicio}|${s.fin}`;
    op.textContent=`Semana ${i===0?'actual - ':''}${s.texto}`;
    sel.appendChild(op);
  });
}
function obtenerSemanaSeleccionada(){
  const [inicio,fin]=document.getElementById('selectorSemana').value.split('|');
  return {inicio,fin};
}

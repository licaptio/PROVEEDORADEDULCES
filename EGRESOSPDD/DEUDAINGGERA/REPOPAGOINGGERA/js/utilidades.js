const MXN = new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'});
function dinero(v){ return MXN.format(Number(v||0)); }
function fechaMx(v){ if(!v) return ''; const [y,m,d]=String(v).slice(0,10).split('-'); return `${d}/${m}/${y}`; }
function escapeHtml(str){ return String(str ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalizar(str){ return String(str||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.remove('oculto'); setTimeout(()=>el.classList.add('oculto'),2800); }
function hoyISO(){ return new Date().toISOString().slice(0,10); }
function esPagoManual(p){ return String(p.tipo_pago || '').toUpperCase()==='MANUAL' || (Array.isArray(p.facturas_info) && p.facturas_info.length===0 && Number(p.importe_pagado||0)===Number(p.total_facturas||0)); }
function asegurarArray(valor){
  if(Array.isArray(valor)) return valor;
  if(!valor) return [];

  if(typeof valor === "string"){
    try{
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    }catch(e){
      return [];
    }
  }

  return [];
}


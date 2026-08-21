export function money(n){const x=Number(n||0);return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:2}).format(x)}
export function hoyISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function safeJson(v){if(v==null)return[];if(Array.isArray(v))return v;if(typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return[]}}return[]}
export function getIvaRate(){const x=Number(document.getElementById('ivaRate').value||0.16);return isFinite(x)?x:0.16}
export function getValorUnitario(con,cantidad){const cand=[con.valor_unitario,con.ValorUnitario,con.valorUnitario].find(v=>v!=null&&v!=='');if(cand!=null){const n=Number(cand);return isFinite(n)?n:0}const imp=con.importe??con.Importe;const impN=Number(imp||0);const qty=Number(cantidad||0)||0;if(qty>0&&isFinite(impN))return impN/qty;return 0}
export function normalizarBusqueda(txt){return String(txt||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim()}

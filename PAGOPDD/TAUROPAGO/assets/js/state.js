export const state = {
  facturas: [],
  lista: [],
  listaMapByCFDI: new Map(),
  listaMapByDesc: new Map(),
  articulosSeleccionados: [],
  modalConceptoIdx: -1,
  modalConceptoTxt: '',
  listaFechaActual: ''
};
export function buildListaMaps(rows){
  state.listaMapByCFDI = new Map();
  state.listaMapByDesc = new Map();
  (rows||[]).forEach(r=>{
    if(r.descripcion_cfdi) state.listaMapByCFDI.set(String(r.descripcion_cfdi), r);
    if(r.descripcion) state.listaMapByDesc.set(String(r.descripcion), r);
  });
}
export function findMatch(textoCFDI){
  return state.listaMapByCFDI.get(String(textoCFDI)) || state.listaMapByDesc.get(String(textoCFDI)) || null;
}

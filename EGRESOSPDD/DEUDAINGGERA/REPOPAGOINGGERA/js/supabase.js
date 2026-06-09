let supabaseClient = null;
function iniciarSupabase(){
  const cfg = window.PROVSOFT_CONFIG;
  if(!cfg.SUPABASE_URL.includes('supabase.co') || cfg.SUPABASE_ANON_KEY.includes('TU-ANON')){
    console.warn('Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js');
  }
  supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}
async function consultarPagos(fechaInicio, fechaFin){
  const { data, error } = await supabaseClient
    .from(window.PROVSOFT_CONFIG.TABLA_PAGOS)
    .select('*')
    .gte('fecha_pago', fechaInicio)
    .lte('fecha_pago', fechaFin)
    .order('banco', { ascending:true })
    .order('fecha_pago', { ascending:true })
    .order('proveedor_nombre', { ascending:true });
  if(error) throw error;
  return data || [];
}
async function insertarPagoManual(payload){
  const { data, error } = await supabaseClient
    .from(window.PROVSOFT_CONFIG.TABLA_PAGOS)
    .insert(payload)
    .select()
    .single();
  if(error) throw error;
  return data;
}

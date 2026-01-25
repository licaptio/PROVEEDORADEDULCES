// js/client.js
(function () {
  if (typeof supabase === 'undefined') {
    console.error('No cargó el SDK de Supabase');
    return;
  }
  if (!window.RUNTIME || !window.RUNTIME.endpoint || !window.RUNTIME.key) {
    console.error('No cargó runtime.js o está incompleto');
    return;
  }

  window.db = supabase.createClient(
    window.RUNTIME.endpoint,
    window.RUNTIME.key
  );
})();

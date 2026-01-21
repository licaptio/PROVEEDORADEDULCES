<!-- supabase.js -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
  const SUPABASE_KEY = 'TU_PUBLIC_ANON_KEY';

  window.supabase = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
</script>

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

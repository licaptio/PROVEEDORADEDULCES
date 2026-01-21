// supabase.js
const SUPABASE_URL = 'https://cvpbtjlupswbyxenugpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cGJ0amx1cHN3Ynl4ZW51Z3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3MDIxOTQsImV4cCI6MjA2MzI3ODE5NH0.iiJsYM3TtaGPdeCtPcEXwAz3LfFc1uJGECEvOErvrqY';

window.supabaseClient = window.supabaseClient || null;

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);



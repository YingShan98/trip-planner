import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const hasConfig = Boolean(
  supabaseUrl && supabaseKey && !String(supabaseUrl).includes('YOUR_') && !String(supabaseKey).includes('YOUR_'),
);

export const sb = hasConfig ? createClient(supabaseUrl, supabaseKey) : null;

import { createClient } from '@supabase/supabase-js';

var url = process.env.SUPABASE_URL || '';
var key = process.env.SUPABASE_SERVICE_KEY || '';

/* Clear, non-crashing diagnosis of the most common misconfigurations. */
export const configError =
  !url ? 'SUPABASE_URL is not set'
  : url.indexOf('supabase.com/dashboard') !== -1
      ? 'SUPABASE_URL is the dashboard URL — use the API URL, e.g. https://<project-ref>.supabase.co'
  : !/^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(url)
      ? 'SUPABASE_URL does not look like an API URL (https://<project-ref>.supabase.co)'
  : !key ? 'SUPABASE_SERVICE_KEY is not set'
  : null;

/* Use placeholders when unset so importing this module never throws at load
   time; queries then fail with a catchable error instead of a blank 500. */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-key'
);

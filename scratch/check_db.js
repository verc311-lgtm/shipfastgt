import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cseswkiayedqpfmtcoce.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7XGmzW5jLlvhdrFPnh8QJA_07LqL9hE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data, error } = await supabase.from('shipments').select('*').limit(3);
if (error) {
  console.error(error);
} else {
  console.log(JSON.stringify(data, null, 2));
}

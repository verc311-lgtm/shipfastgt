import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cseswkiayedqpfmtcoce.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7XGmzW5jLlvhdrFPnh8QJA_07LqL9hE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const res1 = await supabase.from('shipments').select('*').limit(1);
const res2 = await supabase.from('pre_alerts').select('*').limit(1);

console.log("Shipments columns:", Object.keys(res1.data[0] || {}));
console.log("Pre_alerts columns:", Object.keys(res2.data[0] || {}));

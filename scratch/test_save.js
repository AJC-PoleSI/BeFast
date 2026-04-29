import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const updates = {
    poles_liste: JSON.stringify(["Test1"]),
    pole_permissions: JSON.stringify({})
  };
  const rows = Object.entries(updates).map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from("parametres").upsert(rows, { onConflict: "key" });
  console.log("Upsert error:", error);

  const { data } = await supabase.from('parametres').select('*');
  console.log('poles_liste:', data.find(d => d.key === 'poles_liste').value);
}
run();

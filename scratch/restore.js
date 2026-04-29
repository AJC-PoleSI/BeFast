import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const updates = {
    poles_liste: JSON.stringify(["Tresorerie","Presidence","Secretariat","Qualite","RH","SI","Developpement","Commercial","Communication"]),
    pole_permissions: JSON.stringify({})
  };
  const rows = Object.entries(updates).map(([key, value]) => ({ key, value }));
  await supabase.from("parametres").upsert(rows, { onConflict: "key" });
}
run();

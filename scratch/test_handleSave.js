import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setParametres(updates) {
  const rows = Object.entries(updates).map(([key, value]) => ({ key, value }))
  const { error } = await supabase.from("parametres").upsert(rows, { onConflict: "key" })
  console.log("Upsert error:", error);
}

async function run() {
  const form = {}; // Initially empty or has some keys
  const poles = ["Commercial", "Communication"];
  const polePerms = {};
  
  const payload = {
    ...form,
    poles_liste: JSON.stringify(poles),
    pole_permissions: JSON.stringify(polePerms),
  }
  
  console.log("Payload to save:", payload);
  await setParametres(payload);
  
  const { data } = await supabase.from("parametres").select("key, value").in("key", ["poles_liste"]);
  console.log("After save DB:", data);
}
run();

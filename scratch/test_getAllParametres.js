import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from("parametres").select("key, value, description").order("key")
  const map = {}
  for (const p of data ?? []) map[p.key] = p.value ?? ""
  console.log("poles_liste in DB:", map["poles_liste"]);
  
  const keyExists = "poles_liste" in map;
  const raw = map["poles_liste"];
  
  const DEFAULT_POLES = [
    "Developpement", "Commercial", "Communication", "Tresorerie", 
    "Presidence", "Secretariat", "Qualite", "RH", "SI"
  ];
  
  function parsePoles(raw, keyExists) {
    if (!keyExists) return DEFAULT_POLES
    if (!raw) return []
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((v) => typeof v === "string")
    } catch {
      return raw.split(",").map(s => s.trim()).filter(Boolean)
    }
    return []
  }
  
  console.log("Parsed:", parsePoles(raw, keyExists));
}
run();

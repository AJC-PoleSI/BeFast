import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('parametres').select('key, value').in('key', ['poles_liste', 'pole_permissions']);
  console.log("Current DB:", data);
  if (data.length === 0) {
    await supabase.from('parametres').insert([
      { key: 'poles_liste', value: '[]' },
      { key: 'pole_permissions', value: '{}' }
    ]);
    console.log("Inserted empty poles_liste");
  }
}
run();

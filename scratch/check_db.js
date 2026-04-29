import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('parametres').select('*');
  console.log('poles_liste:', data.find(d => d.key === 'poles_liste'));
  console.log('pole_permissions:', data.find(d => d.key === 'pole_permissions'));
}
run();

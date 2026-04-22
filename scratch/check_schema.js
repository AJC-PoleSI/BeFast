const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .rpc('get_schema'); // Or just fetch first row of personnes

  const { data: pData, error: pError } = await supabase.from('personnes').select('*').limit(1);
  console.log(Object.keys(pData[0]));
}

check();

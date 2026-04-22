
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('candidatures')
    .select('*, personnes(id, prenom, nom)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("DB Error:", error);
  } else {
    console.log(`Found ${data.length} candidatures:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

check();
